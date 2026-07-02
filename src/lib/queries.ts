import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { incomeRecords, divisions, clients, payments, expenseRecords, receipts, invoices } from "@/db/schema";
import type { SessionUser } from "@/lib/auth";

export async function listIncomeForUser(user: SessionUser) {
  const allDivisions = await db.select().from(divisions);
  const allowedIds = allDivisions.filter((d) => user.divisionCodes.includes(d.code)).map((d) => d.id);
  if (allowedIds.length === 0) return [];

  const rows = await db
    .select({ record: incomeRecords, divisionCode: divisions.code, divisionName: divisions.name, client: clients, payment: payments })
    .from(incomeRecords)
    .innerJoin(divisions, eq(incomeRecords.divisionId, divisions.id))
    .leftJoin(clients, eq(incomeRecords.clientId, clients.id))
    .leftJoin(payments, eq(payments.incomeRecordId, incomeRecords.id))
    .where(isNull(incomeRecords.deletedAt));

  const filtered = rows.filter((r) => allowedIds.includes(r.record.divisionId));

  const withInvoices = await Promise.all(
    filtered.map(async (r) => {
      const invoiceRows = await db.select().from(invoices).where(eq(invoices.incomeRecordId, r.record.id));
      return { ...r, invoices: invoiceRows };
    })
  );

  return withInvoices.sort((a, b) => b.record.date.getTime() - a.record.date.getTime());
}

export async function listExpensesForUser(user: SessionUser) {
  const allDivisions = await db.select().from(divisions);
  const allowedIds = allDivisions.filter((d) => user.divisionCodes.includes(d.code)).map((d) => d.id);
  if (allowedIds.length === 0) return [];

  const rows = await db
    .select({ record: expenseRecords, divisionCode: divisions.code, divisionName: divisions.name })
    .from(expenseRecords)
    .innerJoin(divisions, eq(expenseRecords.divisionId, divisions.id))
    .where(isNull(expenseRecords.deletedAt));

  const filtered = rows.filter((r) => allowedIds.includes(r.record.divisionId));

  const withReceipts = await Promise.all(
    filtered.map(async (r) => {
      const receiptRows = await db.select().from(receipts).where(eq(receipts.expenseRecordId, r.record.id));
      return { ...r, receipts: receiptRows };
    })
  );

  return withReceipts.sort((a, b) => b.record.date.getTime() - a.record.date.getTime());
}

export async function divisionsForUser(user: SessionUser) {
  const all = await db.select().from(divisions);
  return all.filter((d) => user.divisionCodes.includes(d.code));
}
