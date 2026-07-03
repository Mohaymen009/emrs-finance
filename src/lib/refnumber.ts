/**
 * The human-facing reference number shown in the UI. Prefers the
 * user-entered refNumber; falls back to the old auto year+sequence format
 * (e.g. (2026, 1) -> "20260001") for records created before refNumber
 * existed, and an em dash if neither is present.
 */
export function formatRefNumber(
  refNumber: string | null | undefined,
  refYear: number | null | undefined,
  refSeq: number | null | undefined
): string {
  if (refNumber) return refNumber;
  if (!refYear || !refSeq) return "—";
  return `${refYear}${String(refSeq).padStart(4, "0")}`;
}
