import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { incomeRecords, expenseRecords } from "@/db/schema";

/**
 * Reference numbers are entered by the user, not auto-generated, so the one
 * thing the backend still needs to guard is uniqueness among active
 * (non-deleted) records in that table — otherwise two invoices could end up
 * with the same human-facing number. `excludeId` lets an edit check against
 * every *other* record without tripping on itself.
 */
export async function isRefNumberTaken(
  table: typeof incomeRecords | typeof expenseRecords,
  refNumber: string,
  excludeId?: string
): Promise<boolean> {
  const conditions = [eq(table.refNumber, refNumber), isNull(table.deletedAt)];
  if (excludeId) conditions.push(ne(table.id, excludeId));

  const [existing] = await db
    .select({ id: table.id })
    .from(table as typeof incomeRecords)
    .where(and(...conditions))
    .limit(1);
  return !!existing;
}
