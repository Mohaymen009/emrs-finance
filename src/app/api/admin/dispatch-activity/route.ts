import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, divisions, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const params = new URL(req.url).searchParams;
    const userId = params.get("userId");
    const action = params.get("action");
    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");
    const conditions = [eq(users.role, "DISPATCHER")];
    if (userId) conditions.push(eq(auditLogs.userId, userId));
    if (action) conditions.push(eq(auditLogs.action, action as never));
    if (dateFrom) conditions.push(gte(auditLogs.timestamp, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(auditLogs.timestamp, new Date(dateTo)));

    const rows = await db
      .select({ log: auditLogs, username: users.username, fullName: users.fullName, divisionCode: divisions.code })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.userId, users.id))
      .leftJoin(divisions, eq(auditLogs.divisionId, divisions.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.timestamp))
      .limit(500);
    return NextResponse.json({ activities: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
