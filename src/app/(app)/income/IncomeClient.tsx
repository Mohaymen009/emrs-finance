"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge, buttonClass } from "@/components/ui";

type Division = { code: string; name: string };

const PAYMENT_METHODS = ["POS", "TABBY", "BANK_TRANSFER", "CASH", "STRIPE", "COMPLIMENTARY"];

const inputClass =
  "w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition-shadow";

const CLIENT_FIELDS = [
  { key: "name", label: "Client name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "companyName", label: "Company name" },
  { key: "trnNumber", label: "TRN number" },
] as const;

type ClientFieldKey = (typeof CLIENT_FIELDS)[number]["key"];

export default function IncomeClient({
  initialRecords,
  divisions,
  canEdit,
}: {
  initialRecords: any[];
  divisions: Division[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [divisionCode, setDivisionCode] = useState(divisions[0]?.code ?? "AMBULANCE");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"UNPAID" | "PAID" | "COMPLIMENTARY">("UNPAID");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("POS");
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatAmount, setVatAmount] = useState("");

  const [includeFields, setIncludeFields] = useState<Record<ClientFieldKey, boolean>>({
    name: false,
    phone: false,
    email: false,
    companyName: false,
    trnNumber: false,
  });
  const [clientValues, setClientValues] = useState<Record<ClientFieldKey, string>>({
    name: "",
    phone: "",
    email: "",
    companyName: "",
    trnNumber: "",
  });
  const hasClientDetails = Object.values(includeFields).some(Boolean);

  const [notes, setNotes] = useState("");

  function toggleClientField(key: ClientFieldKey) {
    setIncludeFields((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const client: Record<string, string> = {};
      for (const f of CLIENT_FIELDS) {
        if (includeFields[f.key]) client[f.key] = clientValues[f.key];
      }

      const res = await fetch("/api/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          divisionCode,
          title,
          date,
          amount: Number(amount || 0),
          paymentStatus,
          paymentDate: paymentStatus === "PAID" ? paymentDate : undefined,
          paymentMethod: paymentStatus === "PAID" ? paymentMethod : paymentStatus === "COMPLIMENTARY" ? "COMPLIMENTARY" : undefined,
          vatEnabled,
          vatAmount: vatEnabled ? Number(vatAmount || 0) : undefined,
          hasClientDetails,
          client: hasClientDetails ? client : undefined,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create record");
        return;
      }
      setShowForm(false);
      setTitle("");
      setAmount("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function markPaid(id: string) {
    const method = window.prompt(`Payment method (${PAYMENT_METHODS.join(", ")}):`, "POS");
    if (!method || !PAYMENT_METHODS.includes(method)) return;
    const res = await fetch(`/api/income/${id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentDate: new Date().toISOString(), paymentMethod: method }),
    });
    if (res.ok) router.refresh();
    else alert((await res.json()).error ?? "Failed to record payment");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Income</h1>
        <div className="flex gap-2">
          <a href="/api/reports/export?type=INCOME" className={buttonClass("secondary")}>
            Export Excel
          </a>
          {canEdit && (
            <Button variant="primary" onClick={() => setShowForm((s) => !s)}>
              {showForm ? "Cancel" : "+ New Income"}
            </Button>
          )}
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={submit}
          className="bg-white border border-slate-200 rounded-lg p-5 space-y-5 animate-fade-slide-in"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Division</label>
              <select value={divisionCode} onChange={(e) => setDivisionCode(e.target.value)} className={inputClass}>
                {divisions.map((d) => (
                  <option key={d.code} value={d.code}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Transaction Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
              <p className="text-xs text-slate-400 mt-1">
                When this income was recorded — separate from the Payment Date below, if paid.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Title / Description</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
            <div>
              <label className="block text-xs font-medium mb-1">Amount (AED)</label>
              <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Payment Status</label>
              <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as any)} className={inputClass}>
                <option value="UNPAID">Unpaid</option>
                <option value="PAID">Paid</option>
                <option value="COMPLIMENTARY">Complimentary</option>
              </select>
            </div>
          </div>

          {paymentStatus === "PAID" && (
            <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-md p-3 animate-fade-slide-in">
              <div>
                <label className="block text-xs font-medium mb-1">Payment Date (required)</label>
                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Payment Method (required)</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
                  {PAYMENT_METHODS.filter((m) => m !== "COMPLIMENTARY").map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
            <input type="checkbox" checked={vatEnabled} onChange={(e) => setVatEnabled(e.target.checked)} id="vat" />
            <label htmlFor="vat" className="text-sm">Enable VAT</label>
            {vatEnabled && (
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="VAT amount"
                value={vatAmount}
                onChange={(e) => setVatAmount(e.target.value)}
                className="ml-2 border border-slate-300 rounded-md px-2 py-1 text-sm w-32 focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition-shadow"
              />
            )}
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-medium mb-2">Client details (optional)</p>
            <p className="text-xs text-slate-400 mb-3">
              Choose exactly which client fields to attach to this record — you don&apos;t have to fill them all in.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {CLIENT_FIELDS.map((f) => (
                <div key={f.key} className={f.key === "trnNumber" ? "col-span-2" : undefined}>
                  <label className="flex items-center gap-2 text-sm mb-1">
                    <input
                      type="checkbox"
                      checked={includeFields[f.key]}
                      onChange={() => toggleClientField(f.key)}
                    />
                    {f.label}
                  </label>
                  {includeFields[f.key] && (
                    <input
                      value={clientValues[f.key]}
                      onChange={(e) => setClientValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className={`${inputClass} animate-fade-slide-in`}
                      placeholder={f.label}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <label className="block text-xs font-medium mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} rows={2} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save Income Record"}
          </Button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Division</th>
              <th className="px-3 py-2.5">Title</th>
              <th className="px-3 py-2.5">Transaction Date</th>
              <th className="px-3 py-2.5 text-right">Amount</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Client</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {initialRecords.map((r) => (
              <tr key={r.record.id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/50 hover:bg-slate-100/70 transition-colors">
                <td className="px-3 py-2.5">{r.divisionName}</td>
                <td className="px-3 py-2.5">{r.record.title}</td>
                <td className="px-3 py-2.5">{new Date(r.record.date).toLocaleDateString()}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium">{Number(r.record.amount).toFixed(2)} AED</td>
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
                <td className="px-3 py-2.5">{r.client ? r.client.name ?? "—" : <span className="text-slate-400">anonymous</span>}</td>
                <td className="px-3 py-2.5">
                  {canEdit && r.record.paymentStatus === "UNPAID" && (
                    <Button variant="ghost" onClick={() => markPaid(r.record.id)}>Mark Paid</Button>
                  )}
                </td>
              </tr>
            ))}
            {initialRecords.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-slate-400">No income records yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
