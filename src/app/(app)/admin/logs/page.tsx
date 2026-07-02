import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { auditLogs, loginLogs, exportLogs, users, divisions } from "@/db/schema";
import LogsClient from "./LogsClient";

export default async function AdminLogsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const [audit, logins, exports] = await Promise.all([
    db
      .select({ log: auditLogs, username: users.username, divisionCode: divisions.code })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .leftJoin(divisions, eq(auditLogs.divisionId, divisions.id))
      .orderBy(desc(auditLogs.timestamp))
      .limit(100),
    db
      .select({ log: loginLogs, username: users.username })
      .from(loginLogs)
      .leftJoin(users, eq(loginLogs.userId, users.id))
      .orderBy(desc(loginLogs.timestamp))
      .limit(50),
    db
      .select({ log: exportLogs, username: users.username })
      .from(exportLogs)
      .leftJoin(users, eq(exportLogs.userId, users.id))
      .orderBy(desc(exportLogs.timestamp))
      .limit(50),
  ]);

  return (
    <LogsClient
      audit={JSON.parse(JSON.stringify(audit))}
      logins={JSON.parse(JSON.stringify(logins))}
      exports={JSON.parse(JSON.stringify(exports))}
    />
  );
}
