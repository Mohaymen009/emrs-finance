import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { editAccessRequests } from "@/db/schema";

export const EDIT_WINDOW_MS = 15 * 60 * 1000;

export type RecordType = "INCOME" | "EXPENSE";

type LatestRequest = {
  id: string;
  status: "PENDING" | "APPROVED" | "DENIED";
  activatedAt: Date | null;
} | null;

export type EditWindowInfo = {
  editable: boolean;
  // A PENDING request is currently awaiting admin action for this record.
  pendingRequest: boolean;
};

/**
 * A Dispatcher's record is editable for 15 minutes from creation, or — once
 * that lapses — for another 15 minutes starting from whenever an Admin's
 * approval was first "activated" by the dispatcher visiting the record
 * again (see activatePendingGrants). Admins are never subject to this; call
 * sites only invoke this for Dispatcher-owned records.
 */
export function computeEditWindow(
  createdAt: Date,
  latestRequest: LatestRequest,
  now: Date = new Date()
): EditWindowInfo {
  const initialExpires = new Date(createdAt.getTime() + EDIT_WINDOW_MS);
  if (now <= initialExpires) {
    return { editable: true, pendingRequest: false };
  }
  if (latestRequest?.status === "APPROVED" && latestRequest.activatedAt) {
    const grantExpires = new Date(latestRequest.activatedAt.getTime() + EDIT_WINDOW_MS);
    if (now <= grantExpires) {
      return { editable: true, pendingRequest: false };
    }
  }
  return { editable: false, pendingRequest: latestRequest?.status === "PENDING" };
}

/**
 * The most recent edit-access request per record id, keyed by recordId.
 * Records with no request at all simply won't have an entry in the map.
 */
export async function getLatestEditRequests(
  recordType: RecordType,
  recordIds: string[]
): Promise<Map<string, LatestRequest>> {
  const map = new Map<string, LatestRequest>();
  if (recordIds.length === 0) return map;

  const rows = await db
    .select()
    .from(editAccessRequests)
    .where(and(eq(editAccessRequests.recordType, recordType), inArray(editAccessRequests.recordId, recordIds)))
    .orderBy(desc(editAccessRequests.requestedAt));

  // Rows are ordered newest-first, so the first time we see a recordId is
  // its latest request.
  for (const row of rows) {
    if (!map.has(row.recordId)) {
      map.set(row.recordId, { id: row.id, status: row.status, activatedAt: row.activatedAt });
    }
  }
  return map;
}

/**
 * Starts the reclaimed 15-minute window for any APPROVED-but-not-yet-active
 * requests among the given records — this is the "next time the dispatcher
 * visits the site" trigger, called from the list-loading queries whenever a
 * Dispatcher loads their own income/expense records.
 */
export async function activatePendingGrants(recordType: RecordType, recordIds: string[]): Promise<void> {
  if (recordIds.length === 0) return;
  await db
    .update(editAccessRequests)
    .set({ activatedAt: new Date() })
    .where(
      and(
        eq(editAccessRequests.recordType, recordType),
        inArray(editAccessRequests.recordId, recordIds),
        eq(editAccessRequests.status, "APPROVED"),
        isNull(editAccessRequests.activatedAt)
      )
    );
}

/** Single-record convenience wrapper for API routes (PATCH/DELETE/payment). */
export async function getEditWindowForRecord(
  recordType: RecordType,
  recordId: string,
  createdAt: Date
): Promise<EditWindowInfo> {
  const latest = await getLatestEditRequests(recordType, [recordId]);
  return computeEditWindow(createdAt, latest.get(recordId) ?? null);
}
