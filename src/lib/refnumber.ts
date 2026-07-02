/** Formats a year/sequence pair into the human-facing reference number shown
 * in the UI, e.g. (2026, 1) -> "20260001". Falls back to an em dash for
 * legacy rows that predate this column (see db/seed.ts backfill). */
export function formatRefNumber(refYear: number | null | undefined, refSeq: number | null | undefined): string {
  if (!refYear || !refSeq) return "—";
  return `${refYear}${String(refSeq).padStart(4, "0")}`;
}
