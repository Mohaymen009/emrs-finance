import { and, eq, gte, lte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { incomeRecords, expenseRecords, divisions } from "@/db/schema";

export type DivisionStats = {
  divisionCode: string;
  divisionName: string;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  vatCollected: number;
  incomeEntryCount: number;
  expenseEntryCount: number;
};

export type DateBounds = { from?: Date; to?: Date };

/** Computes the required dashboard figures for a single division, optionally bounded to a date range. */
export async function computeDivisionStats(
  divisionId: string,
  range?: DateBounds
): Promise<Omit<DivisionStats, "divisionCode" | "divisionName">> {
  const incomeConditions = [eq(incomeRecords.divisionId, divisionId), isNull(incomeRecords.deletedAt)];
  if (range?.from) incomeConditions.push(gte(incomeRecords.date, range.from));
  if (range?.to) incomeConditions.push(lte(incomeRecords.date, range.to));

  const expenseConditions = [eq(expenseRecords.divisionId, divisionId), isNull(expenseRecords.deletedAt)];
  if (range?.from) expenseConditions.push(gte(expenseRecords.date, range.from));
  if (range?.to) expenseConditions.push(lte(expenseRecords.date, range.to));

  const [incomeAgg] = await db
    .select({
      total: sql<string>`coalesce(sum(${incomeRecords.amount}), 0)`,
      vat: sql<string>`coalesce(sum(${incomeRecords.vatAmount}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(incomeRecords)
    .where(and(...incomeConditions));

  const [expenseAgg] = await db
    .select({
      total: sql<string>`coalesce(sum(${expenseRecords.amount}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(expenseRecords)
    .where(and(...expenseConditions));

  const totalIncome = Number(incomeAgg?.total ?? 0);
  const totalExpenses = Number(expenseAgg?.total ?? 0);

  return {
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
    vatCollected: Number(incomeAgg?.vat ?? 0),
    incomeEntryCount: Number(incomeAgg?.count ?? 0),
    expenseEntryCount: Number(expenseAgg?.count ?? 0),
  };
}

export async function getAllDivisions() {
  return db.select().from(divisions);
}
