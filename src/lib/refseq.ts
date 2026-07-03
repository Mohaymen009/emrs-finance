import { sql } from "drizzle-orm";
import { db } from "@/db";
import { incomeRecords, expenseRecords } from "@/db/schema";

/**
 * Next reference number for a record, keyed to the year of the record's own
 * date (the service/purchase date, i.e. the accounting year the transaction
 * belongs to — not the year it happened to be typed in). Sequence continues
 * from the current max for that year, so numbering is sequential per
 * calendar year and a record dated 2027 automatically starts 2027's
 * sequence. Computed from the max rather than a separate counter, so
 * deleting the most recent record and creating a new one reuses that number
 * instead of always climbing.
 */
export async function nextRefNumber(
  table: typeof incomeRecords | typeof expenseRecords,
  recordDate: Date
): Promise<{ refYear: number; refSeq: number }> {
  const refYear = recordDate.getFullYear();
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${table.refSeq}), 0)` })
    .from(table as typeof incomeRecords)
    .where(sql`${table.refYear} = ${refYear} and ${table.deletedAt} is null`);
  return { refYear, refSeq: Number(row?.max ?? 0) + 1 };
}
