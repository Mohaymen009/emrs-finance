"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonClass } from "@/components/ui";

type Division = { code: string; name: string };

const inputClass =
  "w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition-shadow";

export default function ExpenseClient({
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
  const fileRef = useRef<HTMLInputElement>(null);

  const [divisionCode, setDivisionCode] = useState(divisions[0]?.code ?? "AMBULANCE");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatAmount, setVatAmount] = useState("");
  const [notes, setNotes] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("A receipt file is mandatory — please attach one before saving.");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("divisionCode", divisionCode);
      form.set("description", description);
      form.set("date", date);
      form.set("amount", amount);
      form.set("supplierName", supplierName);
      form.set("vatEnabled", String(vatEnabled));
      if (vatEnabled) form.set("vatAmount", vatAmount);
      form.set("notes", notes);
      form.set("receipt", file);

      const res = await fetch("/api/expense", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create record");
        return;
      }
      setShowForm(false);
      setDescription("");
      setAmount("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Expenses</h1>
        <div className="flex gap-2">
          <a href="/api/reports/export?type=EXPENSE" className={buttonClass("secondary")}>
            Export Excel
          </a>
          {canEdit && (
            <Button variant="primary" onClick={() => setShowForm((s) => !s)}>
              {showForm ? "Cancel" : "+ New Expense"}
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
              <label className="block text-xs font-medium mb-1">Expense Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Expense Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} required className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
            <div>
              <label className="block text-xs font-medium mb-1">Amount (AED)</label>
              <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Supplier (optional)</label>
              <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
            <input type="checkbox" checked={vatEnabled} onChange={(e) => setVatEnabled(e.target.checked)} id="vat-exp" />
            <label htmlFor="vat-exp" className="text-sm">Enable VAT</label>
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
            <label className="block text-xs font-medium mb-1">
              Receipt (mandatory — PDF, PNG, JPEG or WEBP, up to 15MB)
            </label>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" required className="w-full text-sm" />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <label className="block text-xs font-medium mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} rows={2} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save Expense Record"}
          </Button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Division</th>
              <th className="px-3 py-2.5">Description</th>
              <th className="px-3 py-2.5">Expense Date</th>
              <th className="px-3 py-2.5 text-right">Amount</th>
              <th className="px-3 py-2.5">Supplier</th>
              <th className="px-3 py-2.5">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {initialRecords.map((r) => (
              <tr key={r.record.id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/50 hover:bg-slate-100/70 transition-colors">
                <td className="px-3 py-2.5">{r.divisionName}</td>
                <td className="px-3 py-2.5">{r.record.description}</td>
                <td className="px-3 py-2.5">{new Date(r.record.date).toLocaleDateString()}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium">{Number(r.record.amount).toFixed(2)} AED</td>
                <td className="px-3 py-2.5">{r.record.supplierName ?? "—"}</td>
                <td className="px-3 py-2.5">
                  {r.receipt ? (
                    <a href={`/api/files/receipt/${r.receipt.id}`} target="_blank" className="text-slate-600 underline text-xs hover:text-slate-900 transition-colors">
                      View
                    </a>
                  ) : (
                    <span className="text-slate-400 text-xs">missing</span>
                  )}
                </td>
              </tr>
            ))}
            {initialRecords.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-slate-400">No expense records yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
