"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge, Modal } from "@/components/ui";

type ActivityUser = { id: string; username: string; fullName: string };
type Activity = { log: { id: string; action: string; recordId: string | null; timestamp: string; metadata?: Record<string, unknown> | null }; username: string; fullName: string; divisionCode: string | null };

const labels: Record<string, string> = { CREATE_INCOME: "Created income", UPDATE_INCOME: "Updated income", DELETE_INCOME: "Deleted income", CREATE_EXPENSE: "Created expense", UPDATE_EXPENSE: "Updated expense", DELETE_EXPENSE: "Deleted expense", PAYMENT_RECORDED: "Recorded payment", FILE_UPLOAD: "Uploaded file", FILE_DOWNLOAD: "Downloaded file", EXPORT_REPORT: "Exported report" };

export default function DispatchActivityPanel({ user, onClose }: { user?: ActivityUser; onClose?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(user));
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ ...(user ? { userId: user.id } : {}), ...(action ? { action } : {}) });
      const res = await fetch(`/api/admin/dispatch-activity?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to load activity");
      setActivities(data.activities ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load activity"); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (user) void load(); }, [user]);
  function show() { setOpen(true); void load(); }
  const lastEdited = useMemo(() => {
    const map = new Map<string, Activity>();
    activities.forEach((item) => { if (item.log.recordId && item.log.action.startsWith("UPDATE_")) { const current = map.get(item.log.recordId); if (!current || item.log.timestamp > current.log.timestamp) map.set(item.log.recordId, item); } });
    return map;
  }, [activities]);

  return <>
    <Button variant={user ? "ghost" : "secondary"} onClick={show}>{user ? "View activity" : "View dispatch activity"}</Button>
    <Modal open={open} onClose={() => { setOpen(false); onClose?.(); }} title={user ? `${user.fullName}'s activity` : "Dispatch user activity"} maxWidth="max-w-5xl">
      <div className="flex flex-wrap items-center gap-2 mb-4"><select aria-label="Filter by action" value={action} onChange={(e) => setAction(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">All actions</option>{Object.entries(labels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select><Button onClick={() => void load()} disabled={loading}>{loading ? "Loading..." : "Apply filter"}</Button></div>
      <p className="text-sm text-gray-500 mb-4">{user ? "Everything this dispatch user created, edited, paid, uploaded, or deleted." : "Every admin can review dispatch activity."}</p>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 mb-3">{error}</p>}
      <div className="max-h-[55vh] overflow-auto border rounded-lg"><table className="w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="p-3">When</th><th className="p-3">Activity</th><th className="p-3">Department</th><th className="p-3">Details</th><th className="p-3">Last edited</th></tr></thead><tbody>{activities.map((item) => { const meta = item.log.metadata ?? {}; const deleted = item.log.action.startsWith("DELETE_"); const editor = item.log.recordId ? lastEdited.get(item.log.recordId) : undefined; const destination = item.log.action.includes("INCOME") ? `/income?recordId=${item.log.recordId}` : `/expenses?recordId=${item.log.recordId}`; return <tr key={item.log.id} className="border-t"><td className="p-3 whitespace-nowrap">{new Date(item.log.timestamp).toLocaleString()}</td><td className="p-3"><Badge color={deleted ? "red" : "blue"}>{labels[item.log.action] ?? item.log.action}</Badge>{deleted && <span className="block text-xs text-red-600 mt-1">Deleted — kept for history</span>}</td><td className="p-3">{item.divisionCode ?? "—"}</td><td className="p-3">{!deleted && item.log.recordId ? <button className="text-blue-700 underline" onClick={() => router.push(destination)}>{String(meta.title ?? meta.description ?? meta.refNumber ?? item.log.recordId)}</button> : String(meta.title ?? meta.description ?? meta.refNumber ?? item.log.recordId ?? "—")}</td><td className="p-3 text-xs">{editor ? `${new Date(editor.log.timestamp).toLocaleString()} by ${editor.fullName}` : "—"}</td></tr>; })}{activities.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-500">{loading ? "Loading activity..." : "No activity found."}</td></tr>}</tbody></table></div>
    </Modal>
  </>;
}
