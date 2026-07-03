import { and, desc, eq, gte, inArray, isNull, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { incomeRecords, expenseRecords, divisions, payments, clients } from "@/db/schema";

export type DivisionStats = {
  divisionCode: string;
  divisionName: string;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  vatCollected: number;
  incomeEntryCount: number;
  expenseEntryCount: number;
  outstanding: number;
  outstandingCount: number;
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
      outstanding: sql<string>`coalesce(sum(case when ${incomeRecords.paymentStatus} = 'UNPAID' then ${incomeRecords.amount} else 0 end), 0)`,
      outstandingCount: sql<number>`count(*) filter (where ${incomeRecords.paymentStatus} = 'UNPAID')`,
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
    outstanding: Number(incomeAgg?.outstanding ?? 0),
    outstandingCount: Number(incomeAgg?.outstandingCount ?? 0),
  };
}

export async function getAllDivisions() {
  return db.select().from(divisions);
}

// ---------------------------------------------------------------------------
// Dashboard analytics — each helper is restricted to an explicit list of
// division ids (the caller resolves what the user may see) and returns plain
// numbers ready to render.
// ---------------------------------------------------------------------------

function withRange(
  conditions: SQL[],
  column: typeof incomeRecords.date | typeof expenseRecords.date,
  range?: DateBounds
) {
  if (range?.from) conditions.push(gte(column, range.from));
  if (range?.to) conditions.push(lte(column, range.to));
  return conditions;
}

export type MonthlyPoint = { month: string; label: string; income: number; expenses: number };

/**
 * Income vs expenses per calendar month for the trailing `months` months
 * (including the current one). Always covers the full window — months with
 * no records come back as zeroes — so the chart never has gaps.
 */
export async function monthlyTrend(divisionIds: string[], months = 12): Promise<MonthlyPoint[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(1);
  start.setMonth(start.getMonth() - (months - 1));

  const monthExpr = (col: typeof incomeRecords.date | typeof expenseRecords.date) =>
    sql<string>`to_char(date_trunc('month', ${col}), 'YYYY-MM')`;

  const incomeByMonth = new Map<string, number>();
  const expensesByMonth = new Map<string, number>();

  if (divisionIds.length > 0) {
    const incomeRows = await db
      .select({ month: monthExpr(incomeRecords.date), total: sql<string>`coalesce(sum(${incomeRecords.amount}), 0)` })
      .from(incomeRecords)
      .where(
        and(
          isNull(incomeRecords.deletedAt),
          inArray(incomeRecords.divisionId, divisionIds),
          gte(incomeRecords.date, start)
        )
      )
      .groupBy(monthExpr(incomeRecords.date));
    for (const r of incomeRows) incomeByMonth.set(r.month, Number(r.total));

    const expenseRows = await db
      .select({ month: monthExpr(expenseRecords.date), total: sql<string>`coalesce(sum(${expenseRecords.amount}), 0)` })
      .from(expenseRecords)
      .where(
        and(
          isNull(expenseRecords.deletedAt),
          inArray(expenseRecords.divisionId, divisionIds),
          gte(expenseRecords.date, start)
        )
      )
      .groupBy(monthExpr(expenseRecords.date));
    for (const r of expenseRows) expensesByMonth.set(r.month, Number(r.total));
  }

  const points: MonthlyPoint[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < months; i++) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    points.push({
      month: key,
      label: cursor.toLocaleDateString("en", { month: "short" }),
      income: incomeByMonth.get(key) ?? 0,
      expenses: expensesByMonth.get(key) ?? 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return points;
}

export type CategoryBreakdown = { category: string; total: number; count: number };

/** Expense totals grouped by category (blank/legacy rows appear as "Uncategorised"). */
export async function expensesByCategory(divisionIds: string[], range?: DateBounds): Promise<CategoryBreakdown[]> {
  if (divisionIds.length === 0) return [];
  const categoryExpr = sql<string>`coalesce(nullif(trim(${expenseRecords.category}), ''), 'Uncategorised')`;
  const conditions = withRange(
    [isNull(expenseRecords.deletedAt), inArray(expenseRecords.divisionId, divisionIds)],
    expenseRecords.date,
    range
  );

  const rows = await db
    .select({
      category: categoryExpr,
      total: sql<string>`coalesce(sum(${expenseRecords.amount}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(expenseRecords)
    .where(and(...conditions))
    .groupBy(categoryExpr)
    .orderBy(desc(sql`sum(${expenseRecords.amount})`));

  return rows.map((r) => ({ category: r.category, total: Number(r.total), count: Number(r.count) }));
}

export type MethodBreakdown = { method: string; total: number; count: number };

/** Collected income grouped by how it was paid (Complimentary excluded — always zero). */
export async function paymentMethodBreakdown(divisionIds: string[], range?: DateBounds): Promise<MethodBreakdown[]> {
  if (divisionIds.length === 0) return [];
  const conditions = withRange(
    [isNull(incomeRecords.deletedAt), inArray(incomeRecords.divisionId, divisionIds)],
    incomeRecords.date,
    range
  );

  const rows = await db
    .select({
      method: payments.paymentMethod,
      total: sql<string>`coalesce(sum(${incomeRecords.amount}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(payments)
    .innerJoin(incomeRecords, eq(payments.incomeRecordId, incomeRecords.id))
    .where(and(...conditions))
    .groupBy(payments.paymentMethod)
    .orderBy(desc(sql`sum(${incomeRecords.amount})`));

  return rows
    .filter((r) => r.method !== "COMPLIMENTARY")
    .map((r) => ({ method: r.method.replace(/_/g, " "), total: Number(r.total), count: Number(r.count) }));
}

export type AgingBuckets = {
  buckets: { label: string; total: number; count: number }[];
  total: number;
  count: number;
};

/** Unpaid income grouped by how long it has been outstanding (as of today). */
export async function receivablesAging(divisionIds: string[], range?: DateBounds): Promise<AgingBuckets> {
  const empty: AgingBuckets = {
    buckets: [
      { label: "0–30 days", total: 0, count: 0 },
      { label: "31–60 days", total: 0, count: 0 },
      { label: "61–90 days", total: 0, count: 0 },
      { label: "Over 90 days", total: 0, count: 0 },
    ],
    total: 0,
    count: 0,
  };
  if (divisionIds.length === 0) return empty;

  const conditions = withRange(
    [
      isNull(incomeRecords.deletedAt),
      inArray(incomeRecords.divisionId, divisionIds),
      eq(incomeRecords.paymentStatus, "UNPAID"),
    ],
    incomeRecords.date,
    range
  );

  const rows = await db
    .select({ date: incomeRecords.date, amount: incomeRecords.amount })
    .from(incomeRecords)
    .where(and(...conditions));

  const now = Date.now();
  for (const r of rows) {
    const days = Math.floor((now - new Date(r.date).getTime()) / (1000 * 60 * 60 * 24));
    const idx = days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3;
    const amount = Number(r.amount);
    empty.buckets[idx].total += amount;
    empty.buckets[idx].count += 1;
    empty.total += amount;
    empty.count += 1;
  }
  return empty;
}

export type TopClient = {
  clientId: string;
  displayName: string;
  total: number;
  outstanding: number;
  count: number;
};

/** The highest-revenue clients within the given divisions. */
export async function topClients(divisionIds: string[], range?: DateBounds, limit = 5): Promise<TopClient[]> {
  if (divisionIds.length === 0) return [];
  const conditions = withRange(
    [isNull(incomeRecords.deletedAt), inArray(incomeRecords.divisionId, divisionIds)],
    incomeRecords.date,
    range
  );

  const rows = await db
    .select({
      clientId: clients.id,
      name: clients.name,
      companyName: clients.companyName,
      total: sql<string>`coalesce(sum(${incomeRecords.amount}), 0)`,
      outstanding: sql<string>`coalesce(sum(case when ${incomeRecords.paymentStatus} = 'UNPAID' then ${incomeRecords.amount} else 0 end), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(incomeRecords)
    .innerJoin(clients, eq(incomeRecords.clientId, clients.id))
    .where(and(...conditions))
    .groupBy(clients.id, clients.name, clients.companyName)
    .orderBy(desc(sql`sum(${incomeRecords.amount})`))
    .limit(limit);

  return rows.map((r) => ({
    clientId: r.clientId,
    displayName: r.companyName || r.name || "Unnamed client",
    total: Number(r.total),
    outstanding: Number(r.outstanding),
    count: Number(r.count),
  }));
}
