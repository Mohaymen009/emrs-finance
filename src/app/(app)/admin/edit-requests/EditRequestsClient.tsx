"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@/components/ui";

type RequestRow = {
  id: string;
  recordType: "INCOME" | "EXPENSE";
  recordLabel: string;
  refNumber: string;
  status: "PENDING" | "APPROVED" | "DENIED";
  requestedAt: string;
  requestedByName: string;
  resolvedAt: string | null;
  resolvedByName: string | null;
};

export default function EditRequestsClient({ initialRequests }: { initialRequests: RequestRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = useMemo(() => initialRequests.filter((r) => r.status === "PENDING"), [initialRequests]);
  const resolved = useMemo(() => initialRequests.filter((r) => r.status !== "PENDING"), [initialRequests]);

  async function act(id: string, action: "APPROVE" | "DENY") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/edit-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "Failed to update request");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Edit Access Requests</h1>
      <p className="text-sm text-gray-500 -mt-4">
        Dispatchers ask here for a fresh 15-minute editing window once their original one has expired. Approving
        doesn&apos;t start the clock immediately — it starts the next time they open the record.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Pending ({pending.length})
        </h2>
        <div className="bg-white border border-gray-200 rounded-2xl shadow-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Ref #</th>
                <th className="px-4 py-3">Record</th>
                <th className="px-4 py-3">Requested By</th>
                <th className="px-4 py-3">Requested At</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 odd:bg-white even:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <Badge color={r.recordType === "INCOME" ? "blue" : "amber"}>{r.recordType}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.refNumber}</td>
                  <td className="px-4 py-3">{r.recordLabel}</td>
                  <td className="px-4 py-3">{r.requestedByName}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(r.requestedAt).toLocaleString()}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Button variant="secondary" disabled={busyId === r.id} onClick={() => act(r.id, "APPROVE")} className="mr-2">
                      Approve
                    </Button>
                    <Button variant="dangerGhost" disabled={busyId === r.id} onClick={() => act(r.id, "DENY")}>
                      Deny
                    </Button>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-400">
                    No pending requests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Resolved (recent)</h2>
        <div className="bg-white border border-gray-200 rounded-2xl shadow-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Ref #</th>
                <th className="px-4 py-3">Record</th>
                <th className="px-4 py-3">Requested By</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Resolved By</th>
                <th className="px-4 py-3">Resolved At</th>
              </tr>
            </thead>
            <tbody>
              {resolved.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 odd:bg-white even:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <Badge color={r.recordType === "INCOME" ? "blue" : "amber"}>{r.recordType}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.refNumber}</td>
                  <td className="px-4 py-3">{r.recordLabel}</td>
                  <td className="px-4 py-3">{r.requestedByName}</td>
                  <td className="px-4 py-3">
                    <Badge color={r.status === "APPROVED" ? "green" : "slate"}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-3">{r.resolvedByName ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {r.resolvedAt ? new Date(r.resolvedAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
              {resolved.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-400">
                    No resolved requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
