"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Division = { code: string; name: string };

const PAYMENT_METHODS = ["POS", "TABBY", "BANK_TRANSFER", "CASH", "STRIPE", "COMPLIMENTARY"];

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
  const [hasClientDetails, setHasClientDetails] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientTrn, setClientTrn] = useState("");
  const [notes, setNotes] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
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
          client: hasClientDetails
            ? { name: clientName, phone: clientPhone, email: clientEmail, companyName: clientCompany, trnNumber: clientTrn }
            : undefined,
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
          <a
            href="/api/reports/export?type=INCOME"
            className="text-sm border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-100"
          >
            Export Excel
          </a>
          {canEdit && (
            <button
              onClick={() => setShowForm((s) => !s)}
              className="text-sm bg-slate-900 text-white rounded-md px-3 py-1.5 hover:bg-slate-800"
            >
              {showForm ? "Cancel" : "+ New Income"}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Division</label>
              <select value={divisionCode} onChange={(e) => setDivisionCode(e.target.value)} className="w-full border rounded-md px-2 py-1.5 text-sm">
                {divisions.map((d) => (
                  <option key={d.code} value={d.code}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full border rounded-md px-2 py-1.5 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Title / Description</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full border rounded-md px-2 py-1.5 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Amount (AED)</label>
              <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-full border rounded-md px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Payment Status</label>
              <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as any)} className="w-full border rounded-md px-2 py-1.5 text-sm">
                <option value="UNPAID">Unpaid</option>
                <option value="PAID">Paid</option>
                <option value="COMPLIMENTARY">Complimentary</option>
              </select>
            </div>
          </div>

          {paymentStatus === "PAID" && (
            <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-md p-3">
              <div>
                <label className="block text-xs font-medium mb-1">Payment Date (required)</label>
                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required className="w-full border rounded-md px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Payment Method (required)</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full border rounded-md px-2 py-1.5 text-sm">
                  {PAYMENT_METHODS.filter((m) => m !== "COMPLIMENTARY").map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
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
                className="ml-2 border rounded-md px-2 py-1 text-sm w-32"
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" checked={hasClientDetails} onChange={(e) => setHasClientDetails(e.target.checked)} id="client" />
            <label htmlFor="client" className="text-sm">Include client details</label>
          </div>

          {hasClientDetails && (
            <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-md p-3">
              <input placeholder="Client name" value={clientName} onChange={(e) => setClientName(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm" />
              <input placeholder="Phone" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm" />
              <input placeholder="Email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm" />
              <input placeholder="Company name" value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm" />
              <input placeholder="TRN number" value={clientTrn} onChange={(e) => setClientTrn(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm col-span-2" />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border rounded-md px-2 py-1.5 text-sm" rows={2} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={submitting} className="bg-slate-900 text-white rounded-md px-4 py-2 text-sm disabled:opacity-50">
            {submitting ? "Saving..." : "Save Income Record"}
          </button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Division</th>
              <th className="p-3">Title</th>
              <th className="p-3">Date</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3">Client</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {initialRecords.map((r) => (
              <tr key={r.record.id} className="border-t border-slate-100">
                <td className="p-3">{r.divisionName}</td>
                <td className="p-3">{r.record.title}</td>
                <td className="p-3">{new Date(r.record.date).toLocaleDateString()}</td>
                <td className="p-3">{Number(r.record.amount).toFixed(2)} AED</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    r.record.paymentStatus === "PAID" ? "bg-green-100 text-green-700" :
                    r.record.paymentStatus === "COMPLIMENTARY" ? "bg-blue-100 text-blue-700" :
                    "bg-amber-100 text-amber-700"
                  }`}>{r.record.paymentStatus}</span>
                </td>
                <td className="p-3">{r.client ? r.client.name ?? "—" : <span className="text-slate-400">anonymous</span>}</td>
                <td className="p-3">
                  {canEdit && r.record.paymentStatus === "UNPAID" && (
                    <button onClick={() => markPaid(r.record.id)} className="text-xs text-slate-600 underline">Mark Paid</button>
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
