import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { incomeRecords, divisions, editAccessRequests } from "@/db/schema";
import { requireUser, assertDivisionAccess } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError } from "@/lib/api-helpers";
import { getEditWindowForRecord } from "@/lib/editWindow";

// POST /api/income/:id/edit-request — a Dispatcher, once their edit window
// has lapsed, asks an Admin for a fresh 15-minute window on this specific
// record. Rejected if the record is still editable, or a request is already
// pending. See src/app/api/admin/edit-requests for the approve/deny side.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== "DISPATCHER") {
      return NextResponse.json({ error: "Only dispatchers request edit access." }, { status: 403 });
    }
    const { id } = await params;

    const [row] = await db
      .select({ record: incomeRecords, divisionCode: divisions.code })
      .from(incomeRecords)
      .innerJoin(divisions, eq(incomeRecords.divisionId, divisions.id))
      .where(eq(incomeRecords.id, id))
      .limit(1);
    if (!row || row.record.deletedAt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (row.record.createdById !== user.id) {
      return NextResponse.json({ error: "You can only request edit access on your own records." }, { status: 403 });
    }
    assertDivisionAccess(user, row.divisionCode);

    const window = await getEditWindowForRecord("INCOME", id, row.record.createdAt);
    if (window.editable) {
      return NextResponse.json({ error: "This record is still within its edit window." }, { status: 409 });
    }
    if (window.pendingRequest) {
      return NextResponse.json({ error: "A request is already pending admin approval for this record." }, { status: 409 });
    }

    const [request] = await db
      .insert(editAccessRequests)
      .values({ recordType: "INCOME", recordId: id, requestedById: user.id })
      .returning();

    await writeAuditLog({
      userId: user.id,
      action: "EDIT_ACCESS_REQUESTED",
      recordId: id,
      metadata: { recordType: "INCOME" },
    });

    return NextResponse.json({ request }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
