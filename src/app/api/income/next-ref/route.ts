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

    // Extract the numeric prefix from every refNumber, including soft-deleted
    // records. Deleted references must never be reused: the sequence is global
    // across all creators, divisions, and historical records.
    const rows = await db
      .select({
        seq: sql<number>`nullif(regexp_replace(
          split_part(${incomeRecords.refNumber}, '-', 1),
          '[^0-9]', '', 'g'), '')::int`,
      })
      .from(incomeRecords);

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
