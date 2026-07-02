import { db } from "@/db";
import { auditLogs, loginLogs, exportLogs } from "@/db/schema";

type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "LOGIN_FAILED"
  | "CREATE_INCOME"
  | "UPDATE_INCOME"
  | "DELETE_INCOME"
  | "CREATE_EXPENSE"
  | "UPDATE_EXPENSE"
  | "DELETE_EXPENSE"
  | "PAYMENT_RECORDED"
  | "FILE_UPLOAD"
  | "FILE_DOWNLOAD"
  | "EXPORT_REPORT"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DEACTIVATED"
  | "USER_DELETED"
  | "DIVISION_ACCESS_CHANGED";

/**
 * Append-only audit trail. Every mutating action in the system (financial
 * record CRUD, payments, file uploads, exports, user/access management)
 * must call this so the system has a complete, immutable history.
 */
export async function writeAuditLog(entry: {
  userId: string;
  action: AuditAction;
  recordId?: string;
  divisionId?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values({
    userId: entry.userId,
    action: entry.action,
    recordId: entry.recordId,
    divisionId: entry.divisionId,
    metadata: entry.metadata ?? {},
  });
}

export async function writeLoginLog(entry: {
  userId?: string | null;
  attemptedUsername?: string;
  event: "LOGIN_SUCCESS" | "LOGIN_FAILED" | "LOGOUT" | "LOGIN_LOCKED_OUT";
  ipAddress?: string;
  userAgent?: string;
}) {
  await db.insert(loginLogs).values({
    userId: entry.userId ?? null,
    attemptedUsername: entry.attemptedUsername,
    event: entry.event,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
  });
}

export async function writeExportLog(entry: {
  userId: string;
  exportType: "INCOME" | "EXPENSE" | "VAT" | "PROFIT";
  filters: Record<string, unknown>;
}) {
  await db.insert(exportLogs).values({
    userId: entry.userId,
    exportType: entry.exportType,
    filters: entry.filters,
  });
}
