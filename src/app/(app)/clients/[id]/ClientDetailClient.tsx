"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Badge, ConfirmDialog, IconEdit } from "@/components/ui";
import { formatRefNumber } from "@/lib/refnumber";
import { ClientFormModal, type ClientFormValues } from "../ClientFormModal";

type Client = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  companyName: string | null;
  trnNumber: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
};

type HistoryRow = {
  record: {
    id: string;
    refNumber: string | null;
    refYear: number | null;
    refSeq: number | null;
    title: string;
    date: string;
    amount: string;
    vatAmount: string | null;
    paymentStatus: "UNPAID" | "PAID" | "COMPLIMENTARY";
  };
  divisionName: string;
  payment: { paymentDate: string; paymentMethod: string } | null;
};

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "amber" | "green" }) {
  const valueClass =
    tone === "amber" ? "text-amber-700" : tone === "green" ? "text-green-700" : "text-slate-900";
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}

function ContactRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800 break-words">{value}</dd>
    </div>
  );
}

export default function ClientDetailClient({
  initialClient,
  records,
  canEdit,
}: {
  initialClient: Client;
  records: HistoryRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const client = initialClient;
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const stats = useMemo(() => {
    let billed = 0;
    let outstanding = 0;
    let paid = 0;
    let vat = 0;
    let lastService: number | null = null;
    let lastPayment: number | null = null;
    for (const r of records) {
      const amount = Number(r.record.amount);
      billed += amount;
      vat += Number(r.record.vatAmount ?? 0);
      if (r.record.paymentStatus === "UNPAID") outstanding += amount;
      if (r.record.paymentStatus === "PAID") paid += amount;
      const serviceTime = new Date(r.record.date).getTime();
      if (lastService === null || serviceTime > lastService) lastService = serviceTime;
      if (r.payment) {
        const paymentTime = new Date(r.payment.paymentDate).getTime();
        if (lastPayment === null || paymentTime > lastPayment) lastPayment = paymentTime;
      }
    }
    return { billed, outstanding, paid, vat, lastService, lastPayment };
  }, [records]);

  const displayName = client.companyName || client.name || "Unnamed client";

  async function saveEdit(values: ClientFormValues): Promise<string | null> {
    const res = await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (!res.ok) return data.error ?? "Failed to save changes";
    setEditing(false);
    router.refresh();
    return null;
  }

  async function confirmDeleteClient() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setConfirmDelete(false);
        setDeleteError(data.error ?? "Failed to delete client");
        return;
      }
      router.push("/clients");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/clients" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
            &larr; All clients
          </Link>
          <h1 className="text-lg font-semibold truncate">{displayName}</h1>
          {client.companyName && client.name && <p className="text-sm text-slate-500">{client.name}</p>}
        </div>
        {canEdit && (
          <div className="flex gap-2 shrink-0">
            <Button variant="dangerGhost" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <span className="inline-flex items-center gap-1">
                <IconEdit className="w-3.5 h-3.5" /> Edit Client
              </span>
            </Button>
          </div>
        )}
      </div>

      {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Billed" value={`${stats.billed.toFixed(2)} AED`} />
        <StatCard label="Outstanding" value={`${stats.outstanding.toFixed(2)} AED`} tone={stats.outstanding > 0 ? "amber" : undefined} />
        <StatCard label="Collected (Paid)" value={`${stats.paid.toFixed(2)} AED`} tone="green" />
        <StatCard label="VAT Charged" value={`${stats.vat.toFixed(2)} AED`} />
        <StatCard label="Last Service" value={stats.lastService ? new Date(stats.lastService).toLocaleDateString() : "—"} />
        <StatCard label="Last Payment" value={stats.lastPayment ? new Date(stats.lastPayment).toLocaleDateString() : "—"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Contact Details</p>
          <dl className="space-y-3">
            <ContactRow label="Client name" value={client.name} />
            <ContactRow label="Company" value={client.companyName} />
            <ContactRow label="Phone" value={client.phone} />
            <ContactRow label="Email" value={client.email} />
            <ContactRow label="TRN number" value={client.trnNumber} />
            <ContactRow label="Address" value={client.address} />
            {client.notes && (
              <div className="border-t border-slate-100 pt-3">
                <dt className="text-xs text-slate-400">Internal notes</dt>
                <dd className="text-sm text-slate-700 whitespace-pre-wrap">{client.notes}</dd>
              </div>
            )}
          </dl>
          <p className="text-xs text-slate-300 mt-4">
            Added {new Date(client.createdAt).toLocaleDateString()}
            {client.updatedAt && <> &middot; updated {new Date(client.updatedAt).toLocaleDateString()}</>}
          </p>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Income History</p>
            <span className="text-xs text-slate-400">
              {records.length} record{records.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Ref #</th>
                  <th className="px-3 py-2.5">Department</th>
                  <th className="px-3 py-2.5">Title</th>
                  <th className="px-3 py-2.5">Service Date</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Paid On</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.record.id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/50">
                    <td className="px-3 py-2.5 text-slate-400 font-mono text-xs">
                      {formatRefNumber(r.record.refNumber, r.record.refYear, r.record.refSeq)}
                    </td>
                    <td className="px-3 py-2.5">{r.divisionName}</td>
                    <td className="px-3 py-2.5">{r.record.title}</td>
                    <td className="px-3 py-2.5">{new Date(r.record.date).toLocaleDateString()}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                      {r.record.paymentStatus === "COMPLIMENTARY"
                        ? "Complimentary"
                        : `${Number(r.record.amount).toFixed(2)} AED`}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        color={
                          r.record.paymentStatus === "PAID"
                            ? "green"
                            : r.record.paymentStatus === "COMPLIMENTARY"
                            ? "blue"
                            : "amber"
                        }
                      >
                        {r.record.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {r.payment ? new Date(r.payment.paymentDate).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
                      No income records for this client yet (within your departments).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing && (
        <ClientFormModal
          title="Edit Client"
          submitLabel="Save Changes"
          initialValues={{
            name: client.name ?? "",
            phone: client.phone ?? "",
            email: client.email ?? "",
            companyName: client.companyName ?? "",
            trnNumber: client.trnNumber ?? "",
            address: client.address ?? "",
            notes: client.notes ?? "",
          }}
          onSubmit={saveEdit}
          onClose={() => setEditing(false)}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete client"
        message={`Permanently delete "${displayName}"? This only works if they have no income records attached.${
          deleting ? "" : " This cannot be undone."
        }`}
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        onConfirm={confirmDeleteClient}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
