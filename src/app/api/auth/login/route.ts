import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword, createSession, normalizeUsername } from "@/lib/auth";
import { writeLoginLog } from "@/lib/audit";
import { loginSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api-helpers";
import { checkLoginRateLimit, recordLoginFailure, clearLoginFailures } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username: rawUsername, password } = loginSchema.parse(body);
    const username = normalizeUsername(rawUsername);

    const ipAddress = req.headers.get("x-forwarded-for") ?? undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    // Rate-limit key combines IP + username so an attacker can't dodge the
    // lockout by cycling usernames, and one bad actor can't lock out a
    // legitimate user from a different IP.
    const rateLimitKey = `${ipAddress ?? "unknown"}:${username}`;
    const rateLimit = checkLoginRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many failed attempts. Try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minute(s).`,
        },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

    if (!user || !user.isActive) {
      recordLoginFailure(rateLimitKey);
      await writeLoginLog({ attemptedUsername: username, event: "LOGIN_FAILED", ipAddress, userAgent });
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      recordLoginFailure(rateLimitKey);
      await writeLoginLog({ userId: user.id, event: "LOGIN_FAILED", ipAddress, userAgent });
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    clearLoginFailures(rateLimitKey);
    await createSession(user.id, { ipAddress, userAgent });
    await writeLoginLog({ userId: user.id, event: "LOGIN_SUCCESS", ipAddress, userAgent });

    return NextResponse.json({
      user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
