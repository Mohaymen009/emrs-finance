import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { incomeRecords, divisions } from "@/db/schema";
import { requireUser, assertDivisionAccess } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError } from "@/lib/api-helpers";

async function loadRecordWithDivision(id: string) {
  const [row] = await db
    .select({ record: incomeRecords, divisionCode: divisions.code, divisionId: divisions.id })
    .from(incomeRecords)
    .innerJoin(divisions, eq(incomeRecords.divisionId, divisions.id))
    .where(eq(incomeRecords.id, id))
    .limit(1);
  return row;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const row = await loadRecordWithDivision(id);
    if (!row || row.record.deletedAt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    assertDivisionAccess(user, row.divisionCode);
    return NextResponse.json({ record: row.record });
  } catch (err) {
    return handleApiError(err);
  }
}

const updateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional(),
  date: z.coerce.date().optional(),
});

// PATCH: edit free-text/description fields only. Amount and payment status
// changes go through dedicated flows so payment history stays immutable.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Viewers cannot edit records" }, { status: 403 });
    }
    const { id } = await params;
    const row = await loadRecordWithDivision(id);
    if (!row || row.record.deletedAt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    assertDivisionAccess(user, row.divisionCode);

    const input = updateSchema.parse(await req.json());
    const [updated] = await db
      .update(incomeRecords)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(incomeRecords.id, id))
      .returning();

    await writeAuditLog({
      userId: user.id,
      action: "UPDATE_INCOME",
      recordId: id,
      divisionId: row.divisionId,
      metadata: input,
    });

    return NextResponse.json({ record: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE: soft-delete only — the row and its full history are retained for
// audit/traceability, just excluded from active views and reports.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Viewers cannot delete records" }, { status: 403 });
    }
    const { id } = await params;
    const row = await loadRecordWithDivision(id);
    if (!row || row.record.deletedAt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    assertDivisionAccess(user, row.divisionCode);

    await db.update(incomeRecords).set({ deletedAt: new Date() }).where(eq(incomeRecords.id, id));

    await writeAuditLog({
      userId: user.id,
      action: "DELETE_INCOME",
      recordId: id,
      divisionId: row.divisionId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
