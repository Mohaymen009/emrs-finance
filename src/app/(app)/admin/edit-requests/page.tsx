import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { editAccessRequests, incomeRecords, expenseRecords, users } from "@/db/schema";
import { desc, inArray } from "drizzle-orm";
import { formatRefNumber } from "@/lib/refnumber";
import EditRequestsClient from "./EditRequestsClient";

export default async function EditRequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

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

  const rows = requests.map((r) => {
    const record = r.recordType === "INCOME" ? incomeById.get(r.recordId) : expenseById.get(r.recordId);
    return {
      id: r.id,
      recordType: r.recordType,
      recordLabel: record
        ? r.recordType === "INCOME"
          ? (record as typeof incomeRecords.$inferSelect).title
          : (record as typeof expenseRecords.$inferSelect).description
        : "(record deleted)",
      refNumber: record ? formatRefNumber(record.refNumber, record.refYear, record.refSeq) : "—",
      status: r.status,
      requestedAt: r.requestedAt,
      requestedByName: userById.get(r.requestedById)?.fullName ?? "Unknown",
      resolvedAt: r.resolvedAt,
      resolvedByName: r.resolvedById ? userById.get(r.resolvedById)?.fullName ?? "Unknown" : null,
    };
  });

  return <EditRequestsClient initialRequests={JSON.parse(JSON.stringify(rows))} />;
}
