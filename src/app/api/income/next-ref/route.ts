import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { incomeRecords } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-helpers";

/**
 * GET /api/income/next-ref — computes the next auto-suggested reference
 * number in the format `{seq}-{year}` (e.g. "1354-2026"). The sequence is
 * global (shared across all users/divisions). The sequence starts at 1354
 * regardless of existing lower/reset-era records; only valid numbers strictly
 * after 1354 affect later suggestions.
 */
export async function GET() {
  try {
    await requireUser();

    const year = new Date().getFullYear();

    // Only valid references for the current year participate in the sequence.
    // Legacy formats (for example 202610102), malformed values, and references
    // from another year must not inflate the next suggestion. Deleted rows are
    // still included so values after the reset remain part of the sequence.
    const rows = await db
      .select({
        seq: sql<number>`substring(${incomeRecords.refNumber} from '^[0-9]+')::int`,
      })
      .from(incomeRecords)
      .where(sql`${incomeRecords.refNumber} ~ ${`^[0-9]+-${year}$`}`);

    const RESET_BASELINE = 1354;
    let maxSeq = RESET_BASELINE - 1;
    for (const r of rows) {
      if (r.seq != null && Number.isInteger(r.seq) && r.seq > RESET_BASELINE && r.seq > maxSeq) {
        maxSeq = r.seq;
      }
    }

    const nextSeq = maxSeq + 1;
    return NextResponse.json({ refNumber: `${nextSeq}-${year}` });
  } catch (err) {
    return handleApiError(err);
  }
}
