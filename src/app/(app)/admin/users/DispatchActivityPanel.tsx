"use client";

import { useState } from "react";
import { Button, Modal, Badge } from "@/components/ui";

const labels: Record<string, string> = {
  CREATE_INCOME: "Created income",
  UPDATE_INCOME: "Updated income",
  DELETE_INCOME: "Deleted income",
  CREATE_EXPENSE: "Created expense",
  UPDATE_EXPENSE: "Updated expense",
  DELETE_EXPENSE: "Deleted expense",
  PAYMENT_RECORDED: "Recorded payment",
  FILE_UPLOAD: "Uploaded file",
  FILE_DOWNLOAD: "Downloaded file",
  EXPORT_REPORT: "Exported report",
};

export default function DispatchActivityPanel() {
  const [open, setOpen] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");

  async function load() {
    setLoading(true);
    try {
      const query = new URLSearchParams({ ...(userId ? { userId } : {}), ...(action ? { action } : {}) });
      const res = await fetch(`/api/admin/dispatch-activity?${query}`);
      const data = await res.json();
      setActivities(data.activities ?? []);
    } finally { setLoading(false); }
  }

  function show() { setOpen(true); void load(); }

  return <>
    <Button variant="secondary" onClick={show}>View dispatch activity</Button>
    <Modal open={open} onClose={() => setOpen(false)} title="Dispatch user activity" maxWidth="max-w-5xl">
      <div className="flex flex-wrap gap-2 mb-4">
        <input aria-label="Filter by dispatch user ID" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID (optional)" className="border rounded-lg px-3 py-2 text-sm" />
        <select aria-label="Filter by action" value={action} onChange={(e) => setAction(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All actions</option>
          {Object.entries(labels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
        </select>
        <Button onClick={() => void load()} disabled={loading}>{loading ? "Loading..." : "Apply filters"}</Button>
      </div>
      <p className="text-sm text-gray-500 mb-4">Every admin can review what dispatch users created, changed, paid, uploaded, or deleted.</p>
      <div className="max-h-[55vh] overflow-auto border rounded-lg">
        <table className="w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="p-3">When</th><th className="p-3">Dispatch user</th><th className="p-3">Activity</th><th className="p-3">Department</th><th className="p-3">Details</th></tr></thead>
          <tbody>{activities.map((item) => { const meta = item.log.metadata ?? {}; const deleted = item.log.action.startsWith("DELETE_"); return <tr key={item.log.id} className="border-t"><td className="p-3 whitespace-nowrap">{new Date(item.log.timestamp).toLocaleString()}</td><td className="p-3"><strong>{item.fullName}</strong><span className="block text-xs text-gray-500">{item.username}</span></td><td className="p-3"><Badge color={deleted ? "red" : "blue"}>{labels[item.log.action] ?? item.log.action}</Badge>{deleted && <span className="block text-xs text-red-600 mt-1">Deleted record — kept for history</span>}</td><td className="p-3">{item.divisionCode ?? "—"}</td><td className="p-3">{meta.title ?? meta.description ?? meta.fileName ?? (meta.amount ? `${meta.amount} AED` : item.log.recordId ?? "—")}</td></tr>; })}
          {activities.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-500">No dispatch activity found.</td></tr>}</tbody>
        </table>
      </div>
    </Modal>
  </>;
}
