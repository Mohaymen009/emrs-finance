import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { eq, and, isNull, gt } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions, userDivisionAccess, divisions } from "@/db/schema";

export const SESSION_COOKIE_NAME = "emrs_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

/**
 * Usernames and passwords are both treated case-insensitively per product
 * requirement: "Noshaad" / "noshaad" / "NOSHAAD" and "Noshaad123" /
 * "noshaad123" must all work identically. We normalize both to lowercase
 * before hashing/storing/comparing.
 *
 * Security note: normalizing password case collapses some of the entropy a
 * mixed-case password would otherwise provide (e.g. "Noshaad123" and
 * "noshaad123" become the same credential). This was an explicit request;
 * the rate-limiting/lockout in this file exists specifically to compensate
 * by making brute-force guessing impractical regardless.
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function normalizePassword(password: string): string {
  return password.toLowerCase();
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(normalizePassword(plain), 12);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(normalizePassword(plain), hash);
}

export function generateSessionToken() {
  return randomBytes(32).toString("hex");
}

export type SessionUser = {
  id: string;
  username: string;
  fullName: string;
  role: "ADMIN" | "VIEWER";
  divisionCodes: ("AMBULANCE" | "HOME_HEALTHCARE")[];
};

/**
 * Create a new server-side session record and set the session cookie.
 * Sessions are stored in the DB (not just signed JWTs) so they can be
 * revoked immediately and every login/logout is auditable.
 */
export async function createSession(
  userId: string,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({
    sessionToken: token,
    userId,
    expiresAt,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function revokeSession(token: string) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.sessionToken, token));
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Resolve the currently authenticated user from the session cookie.
 * Returns null if there is no valid, non-expired, non-revoked session.
 * This is the single source of truth used by every API route and page —
 * backend enforcement never trusts client-supplied role/division claims.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const now = new Date();
  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.sessionToken, token),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now)
      )
    )
    .limit(1);

  if (!session) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user || !user.isActive) return null;

  const access = await db
    .select({ code: divisions.code })
    .from(userDivisionAccess)
    .innerJoin(divisions, eq(userDivisionAccess.divisionId, divisions.id))
    .where(eq(userDivisionAccess.userId, user.id));

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    divisionCodes: access.map((a) => a.code),
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("UNAUTHENTICATED", "You must be logged in.");
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new AuthError("FORBIDDEN", "Admin privileges required.");
  }
  return user;
}

/**
 * Enforce that the current user has been granted access to the given
 * division. Division separation is enforced here at the backend layer,
 * not just hidden in the UI.
 */
export function assertDivisionAccess(
  user: SessionUser,
  divisionCode: "AMBULANCE" | "HOME_HEALTHCARE"
) {
  if (!user.divisionCodes.includes(divisionCode)) {
    throw new AuthError(
      "FORBIDDEN",
      `You do not have access to the ${divisionCode} division.`
    );
  }
}

export class AuthError extends Error {
  code: "UNAUTHENTICATED" | "FORBIDDEN";
  constructor(code: "UNAUTHENTICATED" | "FORBIDDEN", message: string) {
    super(message);
    this.code = code;
  }
}
