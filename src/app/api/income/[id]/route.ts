import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { incomeRecords, divisions } from "@/db/schema";
import { requireUser, assertDivisionAccess } from "@/lib/auth";
import { findOrCreateClient } from "@/lib/clients";
import { writeAuditLog } from "@/lib/audit";
import { updateIncomeSchema } from "@/lib/validation";
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

// PATCH — edit descriptive fields (division, title, date, amount, VAT,
// client details, notes). Never touches paymentStatus/paymentDate/
// paymentMethod — payment history is permanent/immutable once recorded (see
// POST /api/income and POST /api/income/:id/payment). Invoices are attached
// separately via POST /api/income/:id/invoice.
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

    const input = updateIncomeSchema.parse(await req.json());

    let divisionId = row.divisionId;
    if (input.divisionCode) {
      assertDivisionAccess(user, input.divisionCode);
      const [division] = await db.select().from(divisions).where(eq(divisions.code, input.divisionCode)).limit(1);
      if (!division) return NextResponse.json({ error: "Unknown division" }, { status: 400 });
      divisionId = division.id;
    }

    // Identical details reuse the existing client row (see findOrCreateClient)
    // so edits don't scatter a client's history across duplicate rows.
    let clientId = row.record.clientId;
    if (input.hasClientDetails !== undefined) {
      if (input.hasClientDetails && input.client) {
        clientId = await findOrCreateClient(input.client);
      } else {
        clientId = null;
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.title !== undefined) updates.title = input.title;
    if (input.date !== undefined) updates.date = input.date;
    if (input.amount !== undefined) updates.amount = input.amount.toFixed(2);
    if (input.vatEnabled !== undefined) updates.vatEnabled = input.vatEnabled;
    if (input.vatAmount !== undefined) updates.vatAmount = String(input.vatAmount);
    if (input.vatEnabled === false) updates.vatAmount = null;
    if (input.hasClientDetails !== undefined) {
      updates.hasClientDetails = input.hasClientDetails;
      updates.clientId = clientId;
    }
    if (input.notes !== undefined) updates.notes = input.notes;
    if (input.divisionCode) updates.divisionId = divisionId;

    const [updated] = await db.update(incomeRecords).set(updates).where(eq(incomeRecords.id, id)).returning();

    await writeAuditLog({
      userId: user.id,
      action: "UPDATE_INCOME",
      recordId: id,
      divisionId,
      metadata: { title: updated.title, amount: updated.amount },
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
