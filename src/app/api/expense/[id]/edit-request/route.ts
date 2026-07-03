import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { expenseRecords, divisions, editAccessRequests } from "@/db/schema";
import { requireUser, assertDivisionAccess } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError } from "@/lib/api-helpers";
import { getEditWindowForRecord } from "@/lib/editWindow";

// POST /api/expense/:id/edit-request — mirrors
// /api/income/:id/edit-request; see that route for the full explanation.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== "DISPATCHER") {
      return NextResponse.json({ error: "Only dispatchers request edit access." }, { status: 403 });
    }
    const { id } = await params;

    const [row] = await db
      .select({ record: expenseRecords, divisionCode: divisions.code })
      .from(expenseRecords)
      .innerJoin(divisions, eq(expenseRecords.divisionId, divisions.id))
      .where(eq(expenseRecords.id, id))
      .limit(1);
    if (!row || row.record.deletedAt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (row.record.createdById !== user.id) {
      return NextResponse.json({ error: "You can only request edit access on your own records." }, { status: 403 });
    }
    assertDivisionAccess(user, row.divisionCode);

    const window = await getEditWindowForRecord("EXPENSE", id, row.record.createdAt);
    if (window.editable) {
      return NextResponse.json({ error: "This record is still within its edit window." }, { status: 409 });
    }
    if (window.pendingRequest) {
      return NextResponse.json({ error: "A request is already pending admin approval for this record." }, { status: 409 });
    }

    const [request] = await db
      .insert(editAccessRequests)
      .values({ recordType: "EXPENSE", recordId: id, requestedById: user.id })
      .returning();

    await writeAuditLog({
      userId: user.id,
      action: "EDIT_ACCESS_REQUESTED",
      recordId: id,
      metadata: { recordType: "EXPENSE" },
    });

    return NextResponse.json({ request }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
