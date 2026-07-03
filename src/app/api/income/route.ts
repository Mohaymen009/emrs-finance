import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { incomeRecords, divisions, clients, payments, invoices } from "@/db/schema";
import { requireUser, assertDivisionAccess } from "@/lib/auth";
import { findOrCreateClient } from "@/lib/clients";
import { writeAuditLog } from "@/lib/audit";
import { createIncomeSchema } from "@/lib/validation";
import { handleApiError, applyComplimentaryRule, applyDiscount } from "@/lib/api-helpers";
import { nextRefNumber } from "@/lib/refseq";
import { assertValidUpload, saveFileToPrivateStorage } from "@/lib/storage";

// GET /api/income?division=AMBULANCE&status=PAID&dateFrom=...&dateTo=...
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const divisionParam = searchParams.get("division");
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Division scoping: viewers/admins only ever see divisions they were
    // granted access to, enforced here regardless of query params.
    const allowedDivisions = divisionParam
      ? [divisionParam].filter((d) => user.divisionCodes.includes(d as never))
      : user.divisionCodes;

    if (allowedDivisions.length === 0) {
      return NextResponse.json({ records: [] });
    }

    const divisionRows = await db.select().from(divisions);
    const divisionIdByCode = new Map(divisionRows.map((d) => [d.code, d.id]));
    const divisionIds = allowedDivisions
      .map((code) => divisionIdByCode.get(code as never))
      .filter((v): v is string => Boolean(v));

    const conditions = [isNull(incomeRecords.deletedAt)];
    if (status) conditions.push(eq(incomeRecords.paymentStatus, status as never));
    if (dateFrom) conditions.push(gte(incomeRecords.date, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(incomeRecords.date, new Date(dateTo)));

    const rows = await db
      .select({
        record: incomeRecords,
        divisionCode: divisions.code,
        client: clients,
        payment: payments,
      })
      .from(incomeRecords)
      .innerJoin(divisions, eq(incomeRecords.divisionId, divisions.id))
      .leftJoin(clients, eq(incomeRecords.clientId, clients.id))
      .leftJoin(payments, eq(payments.incomeRecordId, incomeRecords.id))
      .where(and(...conditions));

    // Dispatchers only ever see their own records.
    const filtered = rows.filter(
      (r) => divisionIds.includes(r.record.divisionId) && (user.role !== "DISPATCHER" || r.record.createdById === user.id)
    );

    return NextResponse.json({ records: filtered });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/income — multipart/form-data (mirrors POST /api/expense). Fields
// other than the optional invoice file are carried as a single JSON-encoded
// "payload" field since income records nest optional client details. Viewers
// cannot call this; enforced by role check below (backend enforcement, not
// just hidden UI). An invoice can also be attached/replaced later via
// POST /api/income/:id/invoice.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role === "VIEWER") {
      return NextResponse.json({ error: "Viewers cannot create records" }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get("invoice");
    if (file instanceof File) {
      assertValidUpload({ type: file.type, size: file.size });
    }

    const payloadRaw = form.get("payload");
    if (typeof payloadRaw !== "string") {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }
    const body = JSON.parse(payloadRaw);
    const input = createIncomeSchema.parse(body);

    // Dispatchers can log a record as Unpaid or Complimentary only — marking
    // something Paid is a financial-confirmation action gated the same way
    // as editing (see POST /api/income/:id/payment), never available at
    // creation time.
    if (user.role === "DISPATCHER" && input.paymentStatus === "PAID") {
      return NextResponse.json(
        { error: "Dispatchers cannot create a record as Paid. Create it as Unpaid, then mark it paid within your edit window." },
        { status: 403 }
      );
    }

    assertDivisionAccess(user, input.divisionCode);

    const [division] = await db
      .select()
      .from(divisions)
      .where(eq(divisions.code, input.divisionCode))
      .limit(1);
    if (!division) {
      return NextResponse.json({ error: "Unknown division" }, { status: 400 });
    }

    // Bookkeeping order: gross - discount = net (stored in amount; VAT is
    // charged on it). Complimentary records still zero out entirely.
    const { netAmount, discountAmount } = applyDiscount({
      grossAmount: input.amount,
      discountType: input.discountType,
      discountValue: input.discountValue,
    });

    // Business rule: Complimentary payment method or status always zeroes the amount,
    // but the record is still stored and included in reporting.
    const finalAmount = applyComplimentaryRule({
      paymentStatus: input.paymentStatus,
      paymentMethod: input.paymentMethod,
      amount: netAmount,
    });
    // Complimentary records carry no discount fields — there is nothing to
    // discount off a zeroed amount.
    const isComplimentary =
      input.paymentStatus === "COMPLIMENTARY" || input.paymentMethod === "COMPLIMENTARY";

    // Identical details reuse the existing client row (see findOrCreateClient)
    // so the Clients page can aggregate a client's full history.
    let clientId: string | null = null;
    if (input.hasClientDetails && input.client) {
      clientId = await findOrCreateClient(input.client);
    }

    // Human-facing reference number (e.g. 20260001), keyed to the service
    // date's year — see nextRefNumber.
    const { refYear, refSeq } = await nextRefNumber(incomeRecords, input.date);

    const [record] = await db
      .insert(incomeRecords)
      .values({
        refYear,
        refSeq,
        divisionId: division.id,
        title: input.title,
        date: input.date,
        amount: finalAmount.toFixed(2),
        discountType: isComplimentary ? null : input.discountType ?? null,
        discountValue:
          isComplimentary || !input.discountType ? null : (input.discountValue ?? 0).toFixed(2),
        discountAmount: isComplimentary || discountAmount === null ? null : discountAmount.toFixed(2),
        vatEnabled: input.vatEnabled,
        vatAmount: input.vatEnabled ? String(input.vatAmount ?? 0) : null,
        paymentStatus: input.paymentStatus,
        hasClientDetails: input.hasClientDetails,
        clientId,
        notes: input.notes,
        createdById: user.id,
      })
      .returning();

    // Payment history is permanent/immutable: once a Paid record is created
    // we insert the Payment row and never allow it to be edited or deleted.
    if (input.paymentStatus === "PAID" || input.paymentStatus === "COMPLIMENTARY") {
      await db.insert(payments).values({
        incomeRecordId: record.id,
        paymentDate: input.paymentDate ?? new Date(),
        paymentMethod:
          input.paymentStatus === "COMPLIMENTARY"
            ? "COMPLIMENTARY"
            : input.paymentMethod!,
        netReceivedAmount:
          input.paymentStatus === "COMPLIMENTARY" ? "0.00" : input.netReceivedAmount!.toFixed(2),
        recordedById: user.id,
      });
      await writeAuditLog({
        userId: user.id,
        action: "PAYMENT_RECORDED",
        recordId: record.id,
        divisionId: division.id,
        metadata: { paymentStatus: input.paymentStatus },
      });
    }

    await writeAuditLog({
      userId: user.id,
      action: "CREATE_INCOME",
      recordId: record.id,
      divisionId: division.id,
      metadata: { title: record.title, amount: record.amount },
    });

    if (file instanceof File) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const storageKey = await saveFileToPrivateStorage("invoices", file.name, buffer);
      await db.insert(invoices).values({
        incomeRecordId: record.id,
        fileName: file.name,
        storageKey,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      await writeAuditLog({
        userId: user.id,
        action: "FILE_UPLOAD",
        recordId: record.id,
        divisionId: division.id,
        metadata: { kind: "invoice", fileName: file.name },
      });
    }

    return NextResponse.json({ record }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
