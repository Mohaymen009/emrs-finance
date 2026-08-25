import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { incomeRecords } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-helpers";

/**
 * GET /api/income/next-ref — computes the next auto-suggested reference
 * number in the format `{seq}-{year}` (e.g. "1354-2026"). The sequence is
 * global (shared across all users/divisions) and monotonically increases by
 * 1; the year reflects the current calendar year. Existing refNumbers that
 * match this pattern are scanned to find the highest sequence used so far.
 */
export async function GET() {
  try {
    await requireUser();

    const year = new Date().getFullYear();

    // Only valid references for the current year participate in the sequence.
    // Legacy formats (for example 202610102), malformed values, and references
    // from another year must not inflate the next suggestion. Deleted rows are
    // still included so a number is never reused.
    const rows = await db
      .select({
        seq: sql<number>`substring(${incomeRecords.refNumber} from '^[0-9]+')::int`,
      })
      .from(incomeRecords)
      .where(sql`${incomeRecords.refNumber} ~ ${`^[0-9]+-${year}$`}`);

    let maxSeq = 0;
    for (const r of rows) {
      if (r.seq != null && !Number.isNaN(r.seq) && r.seq > maxSeq) {
        maxSeq = r.seq;
      }
    }

    const nextSeq = maxSeq + 1;
    return NextResponse.json({ refNumber: `${nextSeq}-${year}` });
  } catch (err) {
    return handleApiError(err);
  }
}
