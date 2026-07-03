import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { expenseRecords, divisions } from "@/db/schema";
import { requireUser, assertDivisionAccess } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { updateExpenseSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api-helpers";
import { nextRefNumber } from "@/lib/refseq";
import { getEditWindowForRecord } from "@/lib/editWindow";

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
    // Dispatchers never see another dispatcher's record — 404, not 403.
    if (user.role === "DISPATCHER" && row.record.createdById !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    assertDivisionAccess(user, row.divisionCode);
    return NextResponse.json({ record: row.record });
  } catch (err) {
    return handleApiError(err);
  }
}

// PATCH — edit descriptive fields (division, description, date, amount,
// supplier, VAT, notes). Receipts are attached separately via
// POST /api/expense/:id/receipt.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role === "VIEWER") {
      return NextResponse.json({ error: "Viewers cannot edit records" }, { status: 403 });
    }
    const { id } = await params;
    const row = await loadRecordWithDivision(id);
    if (!row || row.record.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role === "DISPATCHER") {
      if (row.record.createdById !== user.id) {
        return NextResponse.json({ error: "You can only edit your own records." }, { status: 403 });
      }
      const window = await getEditWindowForRecord("EXPENSE", id, row.record.createdAt);
      if (!window.editable) {
        return NextResponse.json(
          {
            error: window.pendingRequest
              ? "This record's edit window has expired. Your request for more time is awaiting admin approval."
              : "This record's edit window has expired. Request edit access from an admin to make further changes.",
          },
          { status: 403 }
        );
      }
    }
    assertDivisionAccess(user, row.divisionCode);

    const input = updateExpenseSchema.parse(await req.json());

    let divisionId = row.divisionId;
    if (input.divisionCode) {
      assertDivisionAccess(user, input.divisionCode);
      const [division] = await db.select().from(divisions).where(eq(divisions.code, input.divisionCode)).limit(1);
      if (!division) return NextResponse.json({ error: "Unknown division" }, { status: 400 });
      divisionId = division.id;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.description !== undefined) updates.description = input.description;
    if (input.category !== undefined) updates.category = input.category;
    if (input.date !== undefined) {
      updates.date = input.date;
      // Reference numbers are sequential within the purchase date's year — if
      // the edit moves the record to a different year, renumber it there.
      if (input.date.getFullYear() !== row.record.refYear) {
        const { refYear, refSeq } = await nextRefNumber(expenseRecords, input.date);
        updates.refYear = refYear;
        updates.refSeq = refSeq;
      }
    }
    if (input.paymentDate !== undefined) updates.paymentDate = input.paymentDate;
    if (input.amount !== undefined) updates.amount = input.amount.toFixed(2);
    if (input.supplierName !== undefined) updates.supplierName = input.supplierName;
    if (input.vatEnabled !== undefined) updates.vatEnabled = input.vatEnabled;
    if (input.vatAmount !== undefined) updates.vatAmount = String(input.vatAmount);
    if (input.vatEnabled === false) updates.vatAmount = null;
    if (input.divisionCode) updates.divisionId = divisionId;

    const [updated] = await db
      .update(expenseRecords)
      .set(updates)
      .where(eq(expenseRecords.id, id))
      .returning();

    await writeAuditLog({
      userId: user.id,
      action: "UPDATE_EXPENSE",
      recordId: id,
      divisionId,
      metadata: { description: updated.description, amount: updated.amount },
    });

    return NextResponse.json({ record: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role === "VIEWER") {
      return NextResponse.json({ error: "Viewers cannot delete records" }, { status: 403 });
    }
    const { id } = await params;
    const row = await loadRecordWithDivision(id);
    if (!row || row.record.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Dispatchers can delete their own records anytime — no window/approval gate.
    if (user.role === "DISPATCHER" && row.record.createdById !== user.id) {
      return NextResponse.json({ error: "You can only delete your own records." }, { status: 403 });
    }
    assertDivisionAccess(user, row.divisionCode);

    await db.update(expenseRecords).set({ deletedAt: new Date() }).where(eq(expenseRecords.id, id));

    await writeAuditLog({ userId: user.id, action: "DELETE_EXPENSE", recordId: id, divisionId: row.divisionId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
