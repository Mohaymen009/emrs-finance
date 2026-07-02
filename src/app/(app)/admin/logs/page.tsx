import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { auditLogs, loginLogs, exportLogs, users, divisions } from "@/db/schema";

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
    <div className="space-y-10">
      <h1 className="text-lg font-semibold">System Monitoring (Admin)</h1>

      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase mb-3">Audit Log</h2>
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="p-2">Time</th><th className="p-2">User</th><th className="p-2">Action</th>
                <th className="p-2">Division</th><th className="p-2">Record</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.log.id} className="border-t border-slate-100">
                  <td className="p-2">{new Date(a.log.timestamp).toLocaleString()}</td>
                  <td className="p-2">
                    {a.username ?? <span className="text-slate-400 italic">Deleted user</span>}
                  </td>
                  <td className="p-2">{a.log.action}</td>
                  <td className="p-2">{a.divisionCode ?? "—"}</td>
                  <td className="p-2 font-mono text-xs">{a.log.recordId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase mb-3">Login Activity</h2>
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr><th className="p-2">Time</th><th className="p-2">User</th><th className="p-2">Event</th><th className="p-2">IP</th></tr>
            </thead>
            <tbody>
              {logins.map((l) => (
                <tr key={l.log.id} className="border-t border-slate-100">
                  <td className="p-2">{new Date(l.log.timestamp).toLocaleString()}</td>
                  <td className="p-2">
                    {l.username ?? (
                      <span className="text-red-500">
                        unknown user &quot;{l.log.attemptedUsername}&quot;
                      </span>
                    )}
                  </td>
                  <td className="p-2">{l.log.event}</td>
                  <td className="p-2">{l.log.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase mb-3">Export History</h2>
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr><th className="p-2">Time</th><th className="p-2">User</th><th className="p-2">Type</th><th className="p-2">Filters</th></tr>
            </thead>
            <tbody>
              {exports.map((e) => (
                <tr key={e.log.id} className="border-t border-slate-100">
                  <td className="p-2">{new Date(e.log.timestamp).toLocaleString()}</td>
                  <td className="p-2">
                    {e.username ?? <span className="text-slate-400 italic">Deleted user</span>}
                  </td>
                  <td className="p-2">{e.log.exportType}</td>
                  <td className="p-2 font-mono text-xs">{JSON.stringify(e.log.filters)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
