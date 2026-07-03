import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { incomeRecords, divisions, payments } from "@/db/schema";
import { requireUser, assertDivisionAccess } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, applyComplimentaryRule } from "@/lib/api-helpers";
import { getEditWindowForRecord } from "@/lib/editWindow";

const markPaidSchema = z.object({
  paymentDate: z.coerce.date(),
  paymentMethod: z.enum(["POS", "TABBY", "BANK_TRANSFER", "CASH", "STRIPE", "COMPLIMENTARY"]),
  // The actual amount that lands after processor fees/deductions. Not
  // required for Complimentary (always zero).
  netReceivedAmount: z.coerce.number().nonnegative().optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMethod !== "COMPLIMENTARY" && data.netReceivedAmount === undefined) {
    ctx.addIssue({ code: "custom", message: "Net amount received is required", path: ["netReceivedAmount"] });
  }
});

// POST /api/income/:id/payment — transition an Unpaid record to Paid/Complimentary.
// Payment rows are immutable and append-only: this endpoint only inserts,
// it never updates or deletes an existing payment.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role === "VIEWER") {
      return NextResponse.json({ error: "Viewers cannot record payments" }, { status: 403 });
    }
    const { id } = await params;

    const [row] = await db
      .select({ record: incomeRecords, divisionCode: divisions.code, divisionId: divisions.id })
      .from(incomeRecords)
      .innerJoin(divisions, eq(incomeRecords.divisionId, divisions.id))
      .where(eq(incomeRecords.id, id))
      .limit(1);

    if (!row || row.record.deletedAt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Marking a record Paid is treated as just another edit: a Dispatcher can
    // only do it for their own record, and only within their active edit
    // window (same gate as PATCH).
    if (user.role === "DISPATCHER") {
      if (row.record.createdById !== user.id) {
        return NextResponse.json({ error: "You can only record payment on your own records." }, { status: 403 });
      }
      const window = await getEditWindowForRecord("INCOME", id, row.record.createdAt);
      if (!window.editable) {
        return NextResponse.json(
          {
            error: window.pendingRequest
              ? "This record's edit window has expired. Your request for more time is awaiting admin approval."
              : "This record's edit window has expired. Request edit access from an admin before marking it paid.",
          },
          { status: 403 }
        );
      }
    }
    assertDivisionAccess(user, row.divisionCode);

    const [existingPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.incomeRecordId, id))
      .limit(1);
    if (existingPayment) {
      return NextResponse.json(
        { error: "Payment already recorded for this record and cannot be changed." },
        { status: 409 }
      );
    }

    const input = markPaidSchema.parse(await req.json());
    const isComplimentary = input.paymentMethod === "COMPLIMENTARY";
    const newStatus = isComplimentary ? "COMPLIMENTARY" : "PAID";
    const finalAmount = applyComplimentaryRule({
      paymentStatus: newStatus,
      paymentMethod: input.paymentMethod,
      amount: Number(row.record.amount),
    });

    const [updated] = await db
      .update(incomeRecords)
      .set({ paymentStatus: newStatus, amount: finalAmount.toFixed(2), updatedAt: new Date() })
      .where(eq(incomeRecords.id, id))
      .returning();

    await db.insert(payments).values({
      incomeRecordId: id,
      paymentDate: input.paymentDate,
      paymentMethod: input.paymentMethod,
      netReceivedAmount: isComplimentary ? "0.00" : input.netReceivedAmount!.toFixed(2),
      recordedById: user.id,
    });

    await writeAuditLog({
      userId: user.id,
      action: "PAYMENT_RECORDED",
      recordId: id,
      divisionId: row.divisionId,
      metadata: { paymentMethod: input.paymentMethod },
    });

    return NextResponse.json({ record: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
