import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, loginLogs, exportLogs, users, divisions } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { handleApiError } from "@/lib/api-helpers";

// GET /api/admin/logs?kind=audit|login|export&userId=&division=&action=&dateFrom=&dateTo=
// Admin-only system monitoring: full traceability of who did what, when.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const kind = searchParams.get("kind") ?? "audit";
    const userId = searchParams.get("userId") ?? undefined;
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    if (kind === "login") {
      const conditions = [];
      if (userId) conditions.push(eq(loginLogs.userId, userId));
      if (dateFrom) conditions.push(gte(loginLogs.timestamp, new Date(dateFrom)));
      if (dateTo) conditions.push(lte(loginLogs.timestamp, new Date(dateTo)));
      const rows = await db
        .select({ log: loginLogs, username: users.username, fullName: users.fullName })
        .from(loginLogs)
        .leftJoin(users, eq(loginLogs.userId, users.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(loginLogs.timestamp))
        .limit(500);
      return NextResponse.json({ logs: rows });
    }

    if (kind === "export") {
      const conditions = [];
      if (userId) conditions.push(eq(exportLogs.userId, userId));
      if (dateFrom) conditions.push(gte(exportLogs.timestamp, new Date(dateFrom)));
      if (dateTo) conditions.push(lte(exportLogs.timestamp, new Date(dateTo)));
      const rows = await db
        .select({ log: exportLogs, username: users.username, fullName: users.fullName })
        .from(exportLogs)
        .innerJoin(users, eq(exportLogs.userId, users.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(exportLogs.timestamp))
        .limit(500);
      return NextResponse.json({ logs: rows });
    }

    // default: audit
    const divisionParam = searchParams.get("division") ?? undefined;
    const actionParam = searchParams.get("action") ?? undefined;
    const conditions = [];
    if (userId) conditions.push(eq(auditLogs.userId, userId));
    if (actionParam) conditions.push(eq(auditLogs.action, actionParam as never));
    if (dateFrom) conditions.push(gte(auditLogs.timestamp, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(auditLogs.timestamp, new Date(dateTo)));

    const rows = await db
      .select({
        log: auditLogs,
        username: users.username,
        fullName: users.fullName,
        divisionCode: divisions.code,
      })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.userId, users.id))
      .leftJoin(divisions, eq(auditLogs.divisionId, divisions.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.timestamp))
      .limit(500);

    const filtered = divisionParam ? rows.filter((r) => r.divisionCode === divisionParam) : rows;
    return NextResponse.json({ logs: filtered });
  } catch (err) {
    return handleApiError(err);
  }
}
