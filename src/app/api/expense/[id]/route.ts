import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { expenseRecords, divisions } from "@/db/schema";
import { requireUser, assertDivisionAccess } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError } from "@/lib/api-helpers";

async function loadRecordWithDivision(id: string) {
  const [row] = await db
    .select({ record: expenseRecords, divisionCode: divisions.code, divisionId: divisions.id })
    .from(expenseRecords)
    .innerJoin(divisions, eq(expenseRecords.divisionId, divisions.id))
    .where(eq(expenseRecords.id, id))
    .limit(1);
  return row;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const row = await loadRecordWithDivision(id);
    if (!row || row.record.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
    assertDivisionAccess(user, row.divisionCode);
    return NextResponse.json({ record: row.record });
  } catch (err) {
    return handleApiError(err);
  }
}

const updateSchema = z.object({
  description: z.string().trim().min(1).optional(),
  supplierName: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Viewers cannot edit records" }, { status: 403 });
    }
    const { id } = await params;
    const row = await loadRecordWithDivision(id);
    if (!row || row.record.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
    assertDivisionAccess(user, row.divisionCode);

    const input = updateSchema.parse(await req.json());
    const [updated] = await db
      .update(expenseRecords)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(expenseRecords.id, id))
      .returning();

    await writeAuditLog({
      userId: user.id,
      action: "UPDATE_EXPENSE",
      recordId: id,
      divisionId: row.divisionId,
      metadata: input,
    });

    return NextResponse.json({ record: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Viewers cannot delete records" }, { status: 403 });
    }
    const { id } = await params;
    const row = await loadRecordWithDivision(id);
    if (!row || row.record.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
    assertDivisionAccess(user, row.divisionCode);

    await db.update(expenseRecords).set({ deletedAt: new Date() }).where(eq(expenseRecords.id, id));

    await writeAuditLog({ userId: user.id, action: "DELETE_EXPENSE", recordId: id, divisionId: row.divisionId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
