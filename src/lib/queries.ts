import { eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { incomeRecords, divisions, clients, payments, expenseRecords, receipts, invoices } from "@/db/schema";
import type { SessionUser } from "@/lib/auth";
import { activatePendingGrants, computeEditWindow, getLatestEditRequests } from "@/lib/editWindow";

/**
 * Attaches a computed `editWindow` to each of a Dispatcher's own rows (used
 * by the income/expense list pages to gate Edit/Mark Paid buttons), and —
 * as a side effect — activates any Admin-approved-but-not-yet-active grants
 * for those records. This function call is the "dispatcher visits the site"
 * moment the 15-minute grant window starts counting from (see
 * src/lib/editWindow.ts).
 */
async function attachEditWindows<T extends { record: { id: string; createdAt: Date } }>(
  recordType: "INCOME" | "EXPENSE",
  rows: T[]
): Promise<(T & { editWindow: { editable: boolean; pendingRequest: boolean } })[]> {
  const ids = rows.map((r) => r.record.id);
  await activatePendingGrants(recordType, ids);
  const latestByRecord = await getLatestEditRequests(recordType, ids);
  const now = new Date();
  return rows.map((r) => ({
    ...r,
    editWindow: computeEditWindow(r.record.createdAt, latestByRecord.get(r.record.id) ?? null, now),
  }));
}

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

  // Dispatchers only ever see their own records — never another
  // dispatcher's or the company's full ledger.
  const filtered = rows.filter(
    (r) =>
      allowedIds.includes(r.record.divisionId) &&
      (user.role !== "DISPATCHER" || r.record.createdById === user.id)
  );

  const withInvoices = await Promise.all(
    filtered.map(async (r) => {
      const invoiceRows = await db.select().from(invoices).where(eq(invoices.incomeRecordId, r.record.id));
      return { ...r, invoices: invoiceRows };
    })
  );

  const withEditWindows =
    user.role === "DISPATCHER" ? await attachEditWindows("INCOME", withInvoices) : withInvoices;

  return withEditWindows.sort((a, b) => b.record.date.getTime() - a.record.date.getTime());
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

  const filtered = rows.filter(
    (r) =>
      allowedIds.includes(r.record.divisionId) &&
      (user.role !== "DISPATCHER" || r.record.createdById === user.id)
  );

  const withReceipts = await Promise.all(
    filtered.map(async (r) => {
      const receiptRows = await db.select().from(receipts).where(eq(receipts.expenseRecordId, r.record.id));
      return { ...r, receipts: receiptRows };
    })
  );

  const withEditWindows =
    user.role === "DISPATCHER" ? await attachEditWindows("EXPENSE", withReceipts) : withReceipts;

  return withEditWindows.sort((a, b) => b.record.date.getTime() - a.record.date.getTime());
}

export async function divisionsForUser(user: SessionUser) {
  const all = await db.select().from(divisions);
  return all.filter((d) => user.divisionCodes.includes(d.code));
}
