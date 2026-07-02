import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { expenseRecords, divisions, receipts } from "@/db/schema";
import { requireUser, assertDivisionAccess } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { createExpenseSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api-helpers";
import { assertValidUpload, saveFileToPrivateStorage } from "@/lib/storage";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const divisionParam = searchParams.get("division");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const allowedDivisions = divisionParam
      ? [divisionParam].filter((d) => user.divisionCodes.includes(d as never))
      : user.divisionCodes;

    if (allowedDivisions.length === 0) return NextResponse.json({ records: [] });

    const divisionRows = await db.select().from(divisions);
    const divisionIdByCode = new Map(divisionRows.map((d) => [d.code, d.id]));
    const divisionIds = allowedDivisions
      .map((code) => divisionIdByCode.get(code as never))
      .filter((v): v is string => Boolean(v));

    const conditions = [isNull(expenseRecords.deletedAt)];
    if (dateFrom) conditions.push(gte(expenseRecords.date, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(expenseRecords.date, new Date(dateTo)));

    const rows = await db
      .select({ record: expenseRecords, divisionCode: divisions.code, receipt: receipts })
      .from(expenseRecords)
      .innerJoin(divisions, eq(expenseRecords.divisionId, divisions.id))
      .leftJoin(receipts, eq(receipts.expenseRecordId, expenseRecords.id))
      .where(and(...conditions));

    const filtered = rows.filter((r) => divisionIds.includes(r.record.divisionId));
    return NextResponse.json({ records: filtered });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/expense — multipart/form-data. A receipt file is optional at
// creation — it can be attached later via PATCH /api/expense/:id.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Viewers cannot create records" }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get("receipt");
    if (file instanceof File) {
      assertValidUpload({ type: file.type, size: file.size });
    }

    const raw = {
      divisionCode: form.get("divisionCode"),
      description: form.get("description"),
      amount: form.get("amount"),
      date: form.get("date"),
      supplierName: form.get("supplierName") || undefined,
      vatEnabled: form.get("vatEnabled") === "true",
      vatAmount: form.get("vatAmount") || undefined,
      notes: form.get("notes") || undefined,
    };
    const input = createExpenseSchema.parse(raw);
    assertDivisionAccess(user, input.divisionCode);

    const [division] = await db
      .select()
      .from(divisions)
      .where(eq(divisions.code, input.divisionCode))
      .limit(1);
    if (!division) return NextResponse.json({ error: "Unknown division" }, { status: 400 });

    // See the matching comment in api/income/route.ts.
    const refYear = new Date().getFullYear();
    const [maxRow] = await db
      .select({ max: sql<number>`coalesce(max(${expenseRecords.refSeq}), 0)` })
      .from(expenseRecords)
      .where(and(eq(expenseRecords.refYear, refYear), isNull(expenseRecords.deletedAt)));
    const refSeq = Number(maxRow?.max ?? 0) + 1;

    const [record] = await db
      .insert(expenseRecords)
      .values({
        refYear,
        refSeq,
        divisionId: division.id,
        description: input.description,
        amount: input.amount.toFixed(2),
        date: input.date,
        supplierName: input.supplierName,
        vatEnabled: input.vatEnabled,
        vatAmount: input.vatEnabled ? String(input.vatAmount ?? 0) : null,
        notes: input.notes,
        createdById: user.id,
      })
      .returning();

    await writeAuditLog({
      userId: user.id,
      action: "CREATE_EXPENSE",
      recordId: record.id,
      divisionId: division.id,
      metadata: { description: record.description, amount: record.amount },
    });

    if (file instanceof File) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const storageKey = await saveFileToPrivateStorage("receipts", file.name, buffer);
      await db.insert(receipts).values({
        expenseRecordId: record.id,
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
        metadata: { kind: "receipt", fileName: file.name },
      });
    }

    return NextResponse.json({ record }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
