"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, IconTrash } from "@/components/ui";
import { CollapsibleSection } from "@/components/CollapsibleSection";

type LogType = "audit" | "login" | "export";

const TYPE_LABEL: Record<LogType, string> = {
  audit: "audit log",
  login: "login activity",
  export: "export history",
};

function DeleteRowButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Delete entry" className="text-gray-300 hover:text-red-600 transition-colors">
      <IconTrash className="w-3.5 h-3.5" />
    </button>
  );
}

export default function LogsClient({
  audit,
  logins,
  exports,
}: {
  audit: any[];
  logins: any[];
  exports: any[];
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<{ type: LogType; id: string } | null>(null);
  const [clearing, setClearing] = useState<LogType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/logs/${deleting.type}/${deleting.id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
        setDeleting(null);
      } else {
        setError((await res.json()).error ?? "Failed to delete log entry");
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirmClear() {
    if (!clearing) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/logs/${clearing}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
        setClearing(null);
      } else {
        setError((await res.json()).error ?? "Failed to clear logs");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold tracking-tight">System Monitoring (Admin)</h1>

      <CollapsibleSection
        title="Audit Log"
        count={audit.length}
        action={
          audit.length > 0 && (
            <Button variant="dangerGhost" onClick={() => setClearing("audit")}>Clear All</Button>
          )
        }
      >
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="p-2">Time</th><th className="p-2">User</th><th className="p-2">Action</th>
                <th className="p-2">Department</th><th className="p-2">Record</th><th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.log.id} className="border-t border-gray-100">
                  <td className="p-2">{new Date(a.log.timestamp).toLocaleString()}</td>
                  <td className="p-2">
                    {a.username ?? <span className="text-gray-400 italic">Deleted user</span>}
                  </td>
                  <td className="p-2">{a.log.action}</td>
                  <td className="p-2">{a.divisionCode ?? "—"}</td>
                  <td className="p-2 font-mono text-xs">{a.log.recordId ?? "—"}</td>
                  <td className="p-2 text-right">
                    <DeleteRowButton onClick={() => setDeleting({ type: "audit", id: a.log.id })} />
                  </td>
                </tr>
              ))}
              {audit.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-gray-400">No entries.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Login Activity"
        count={logins.length}
        action={
          logins.length > 0 && (
            <Button variant="dangerGhost" onClick={() => setClearing("login")}>Clear All</Button>
          )
        }
      >
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr><th className="p-2">Time</th><th className="p-2">User</th><th className="p-2">Event</th><th className="p-2">IP</th><th className="p-2 w-8"></th></tr>
            </thead>
            <tbody>
              {logins.map((l) => (
                <tr key={l.log.id} className="border-t border-gray-100">
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
                  <td className="p-2 text-right">
                    <DeleteRowButton onClick={() => setDeleting({ type: "login", id: l.log.id })} />
                  </td>
                </tr>
              ))}
              {logins.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-gray-400">No entries.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Export History"
        count={exports.length}
        action={
          exports.length > 0 && (
            <Button variant="dangerGhost" onClick={() => setClearing("export")}>Clear All</Button>
          )
        }
      >
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr><th className="p-2">Time</th><th className="p-2">User</th><th className="p-2">Type</th><th className="p-2">Filters</th><th className="p-2 w-8"></th></tr>
            </thead>
            <tbody>
              {exports.map((e) => (
                <tr key={e.log.id} className="border-t border-gray-100">
                  <td className="p-2">{new Date(e.log.timestamp).toLocaleString()}</td>
                  <td className="p-2">
                    {e.username ?? <span className="text-gray-400 italic">Deleted user</span>}
                  </td>
                  <td className="p-2">{e.log.exportType}</td>
                  <td className="p-2 font-mono text-xs">{JSON.stringify(e.log.filters)}</td>
                  <td className="p-2 text-right">
                    <DeleteRowButton onClick={() => setDeleting({ type: "export", id: e.log.id })} />
                  </td>
                </tr>
              ))}
              {exports.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-gray-400">No entries.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ConfirmDialog
        open={!!deleting}
        title="Delete log entry"
        message="Permanently delete this log entry? This cannot be undone."
        confirmLabel={busy ? "Deleting..." : "Delete"}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
      <ConfirmDialog
        open={!!clearing}
        title="Clear all logs"
        message={`Permanently delete every entry in the ${clearing ? TYPE_LABEL[clearing] : ""}? This cannot be undone.`}
        confirmLabel={busy ? "Clearing..." : "Clear All"}
        onConfirm={confirmClear}
        onCancel={() => setClearing(null)}
      />
    </div>
  );
}
