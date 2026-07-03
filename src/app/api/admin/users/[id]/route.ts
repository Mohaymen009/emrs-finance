import { NextRequest, NextResponse } from "next/server";
import { eq, and, ne } from "drizzle-orm";
import { db } from "@/db";
import { users, userDivisionAccess, divisions } from "@/db/schema";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { updateUserSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api-helpers";

// PATCH /api/admin/users/:id — update role, active status, division access,
// full name, or reset the password. Guards against an admin locking
// everyone (including themselves) out of the system.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const input = updateUserSchema.parse(await req.json());

    const willDeactivate = input.isActive === false;
    const willDemote = input.role !== undefined && input.role !== "ADMIN" && target.role === "ADMIN";

    if ((willDeactivate || willDemote) && target.id === admin.id) {
      // Count other active admins before allowing this.
      const otherActiveAdmins = await db
        .select()
        .from(users)
        .where(and(eq(users.role, "ADMIN"), eq(users.isActive, true), ne(users.id, admin.id)));
      if (otherActiveAdmins.length === 0) {
        return NextResponse.json(
          { error: "You cannot remove your own admin access — you are the only active admin." },
          { status: 400 }
        );
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.fullName !== undefined) updates.fullName = input.fullName;
    if (input.role !== undefined) updates.role = input.role;
    if (input.isActive !== undefined) updates.isActive = input.isActive;
    if (input.newPassword) updates.passwordHash = await hashPassword(input.newPassword);

    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();

    if (input.divisionCodes) {
      await db.delete(userDivisionAccess).where(eq(userDivisionAccess.userId, id));
      const divisionRows = await db.select().from(divisions);
      const idByCode = new Map(divisionRows.map((d) => [d.code, d.id]));
      for (const code of input.divisionCodes) {
        const divisionId = idByCode.get(code);
        if (divisionId) await db.insert(userDivisionAccess).values({ userId: id, divisionId });
      }
      await writeAuditLog({
        userId: admin.id,
        action: "DIVISION_ACCESS_CHANGED",
        recordId: id,
        metadata: { divisionCodes: input.divisionCodes },
      });
    }

    await writeAuditLog({
      userId: admin.id,
      action: input.isActive === false ? "USER_DEACTIVATED" : "USER_UPDATED",
      recordId: id,
      metadata: { fullName: input.fullName, role: input.role, isActive: input.isActive, passwordReset: !!input.newPassword },
    });

    return NextResponse.json({
      user: { id: updated.id, username: updated.username, fullName: updated.fullName, role: updated.role, isActive: updated.isActive },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/admin/users/:id — permanently remove a user. Their past
// income/expense/payment/audit/login/export records are kept (foreign keys
// are ON DELETE SET NULL) so financial history and the audit trail survive;
// the creator/actor just shows as unattributed ("Deleted user" in the UI).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (target.id === admin.id) {
      return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
    }

    if (target.role === "ADMIN" && target.isActive) {
      const otherActiveAdmins = await db
        .select()
        .from(users)
        .where(and(eq(users.role, "ADMIN"), eq(users.isActive, true), ne(users.id, admin.id)));
      if (otherActiveAdmins.length === 0) {
        return NextResponse.json({ error: "Cannot delete the only active admin." }, { status: 400 });
      }
    }

    await writeAuditLog({
      userId: admin.id,
      action: "USER_DELETED",
      recordId: id,
      metadata: { username: target.username, fullName: target.fullName },
    });

    await db.delete(users).where(eq(users.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
