import { NextResponse } from "next/server";
import { desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { editAccessRequests, incomeRecords, expenseRecords, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { handleApiError } from "@/lib/api-helpers";

// GET /api/admin/edit-requests — every edit-access request (pending and
// resolved, newest first), with enough context for an Admin to act without
// having to open each record separately: who asked, for which record, and
// its reference number/title.
export async function GET() {
  try {
    await requireAdmin();

    const requests = await db.select().from(editAccessRequests).orderBy(desc(editAccessRequests.requestedAt)).limit(200);

    const incomeIds = requests.filter((r) => r.recordType === "INCOME").map((r) => r.recordId);
    const expenseIds = requests.filter((r) => r.recordType === "EXPENSE").map((r) => r.recordId);

    const [incomeRows, expenseRows, userRows] = await Promise.all([
      incomeIds.length ? db.select().from(incomeRecords).where(inArray(incomeRecords.id, incomeIds)) : Promise.resolve([]),
      expenseIds.length ? db.select().from(expenseRecords).where(inArray(expenseRecords.id, expenseIds)) : Promise.resolve([]),
      db.select().from(users),
    ]);

    const incomeById = new Map(incomeRows.map((r) => [r.id, r]));
    const expenseById = new Map(expenseRows.map((r) => [r.id, r]));
    const userById = new Map(userRows.map((u) => [u.id, u]));

    const result = requests.map((r) => {
      const record = r.recordType === "INCOME" ? incomeById.get(r.recordId) : expenseById.get(r.recordId);
      return {
        id: r.id,
        recordType: r.recordType,
        recordId: r.recordId,
        recordLabel: record
          ? r.recordType === "INCOME"
            ? (record as typeof incomeRecords.$inferSelect).title
            : (record as typeof expenseRecords.$inferSelect).description
          : "(record deleted)",
        refYear: record?.refYear ?? null,
        refSeq: record?.refSeq ?? null,
        status: r.status,
        requestedAt: r.requestedAt,
        requestedByName: userById.get(r.requestedById)?.fullName ?? "Unknown",
        resolvedAt: r.resolvedAt,
        resolvedByName: r.resolvedById ? userById.get(r.resolvedById)?.fullName ?? "Unknown" : null,
        activatedAt: r.activatedAt,
      };
    });

    return NextResponse.json({ requests: result });
  } catch (err) {
    return handleApiError(err);
  }
}
