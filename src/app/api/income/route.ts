import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { incomeRecords, divisions, clients, payments } from "@/db/schema";
import { requireUser, assertDivisionAccess } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { createIncomeSchema } from "@/lib/validation";
import { handleApiError, applyComplimentaryRule } from "@/lib/api-helpers";

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

    const filtered = rows.filter((r) => divisionIds.includes(r.record.divisionId));

    return NextResponse.json({ records: filtered });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/income — create a new income (ledger) entry. Viewers cannot call this;
// enforced by role check below (backend enforcement, not just hidden UI).
// An invoice can optionally be attached afterwards via POST /api/income/:id/invoice.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Viewers cannot create records" }, { status: 403 });
    }

    const body = await req.json();
    const input = createIncomeSchema.parse(body);

    assertDivisionAccess(user, input.divisionCode);

    const [division] = await db
      .select()
      .from(divisions)
      .where(eq(divisions.code, input.divisionCode))
      .limit(1);
    if (!division) {
      return NextResponse.json({ error: "Unknown division" }, { status: 400 });
    }

    // Business rule: Complimentary payment method or status always zeroes the amount,
    // but the record is still stored and included in reporting.
    const finalAmount = applyComplimentaryRule({
      paymentStatus: input.paymentStatus,
      paymentMethod: input.paymentMethod,
      amount: input.amount,
    });

    let clientId: string | null = null;
    if (input.hasClientDetails && input.client) {
      const [client] = await db
        .insert(clients)
        .values({
          name: input.client.name,
          phone: input.client.phone,
          email: input.client.email || undefined,
          companyName: input.client.companyName,
          trnNumber: input.client.trnNumber,
        })
        .returning();
      clientId = client.id;
    }

    const [record] = await db
      .insert(incomeRecords)
      .values({
        divisionId: division.id,
        title: input.title,
        date: input.date,
        amount: finalAmount.toFixed(2),
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

    return NextResponse.json({ record }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
