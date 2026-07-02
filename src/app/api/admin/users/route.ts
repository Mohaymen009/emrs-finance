import { NextRequest, NextResponse } from "next/server";
import { eq, desc, max } from "drizzle-orm";
import { db } from "@/db";
import { users, userDivisionAccess, divisions, loginLogs } from "@/db/schema";
import { requireAdmin, hashPassword, normalizeUsername } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { createUserSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api-helpers";

// GET /api/admin/users — list every account, their role, division access,
// active status, who created them, and their most recent login.
export async function GET() {
  try {
    await requireAdmin();

    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    const allAccess = await db
      .select({ userId: userDivisionAccess.userId, code: divisions.code })
      .from(userDivisionAccess)
      .innerJoin(divisions, eq(userDivisionAccess.divisionId, divisions.id));
    const lastLogins = await db
      .select({ userId: loginLogs.userId, last: max(loginLogs.timestamp) })
      .from(loginLogs)
      .where(eq(loginLogs.event, "LOGIN_SUCCESS"))
      .groupBy(loginLogs.userId);

    const accessByUser = new Map<string, string[]>();
    for (const a of allAccess) {
      const arr = accessByUser.get(a.userId) ?? [];
      arr.push(a.code);
      accessByUser.set(a.userId, arr);
    }
    const lastLoginByUser = new Map(lastLogins.map((l) => [l.userId, l.last]));

    const result = allUsers.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      role: u.role,
      isActive: u.isActive,
      divisionCodes: accessByUser.get(u.id) ?? [],
      lastLoginAt: lastLoginByUser.get(u.id) ?? null,
      createdAt: u.createdAt,
    }));

    return NextResponse.json({ users: result });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/admin/users — create a new account. There is no self-service
// registration anywhere in this system: accounts can only be created here,
// by an existing Admin (starting with the seeded master admin).
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const input = createUserSchema.parse(await req.json());
    const username = normalizeUsername(input.username);

    const [existing] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existing) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }

    const passwordHash = await hashPassword(input.password);
    const [created] = await db
      .insert(users)
      .values({
        username,
        passwordHash,
        fullName: input.fullName,
        role: input.role,
        createdById: admin.id,
      })
      .returning();

    if (input.divisionCodes.length > 0) {
      const divisionRows = await db.select().from(divisions);
      const idByCode = new Map(divisionRows.map((d) => [d.code, d.id]));
      for (const code of input.divisionCodes) {
        const divisionId = idByCode.get(code);
        if (divisionId) {
          await db.insert(userDivisionAccess).values({ userId: created.id, divisionId });
        }
      }
    }

    await writeAuditLog({
      userId: admin.id,
      action: "USER_CREATED",
      recordId: created.id,
      metadata: { username: created.username, role: created.role, divisions: input.divisionCodes },
    });

    return NextResponse.json(
      { user: { id: created.id, username: created.username, fullName: created.fullName, role: created.role } },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
