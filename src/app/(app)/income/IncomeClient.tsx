"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Badge,
  Modal,
  ConfirmDialog,
  IconSearch,
  IconEdit,
  IconPaperclip,
  fileInputClass,
} from "@/components/ui";
import { DateRangeFilter, type DateRange } from "@/components/DateRangeFilter";
import { ExportDialog } from "@/components/ExportDialog";
import { formatRefNumber } from "@/lib/refnumber";

type Division = { code: string; name: string };

const PAYMENT_METHODS = ["POS", "TABBY", "BANK_TRANSFER", "CASH", "STRIPE", "COMPLIMENTARY"];

const inputClass =
  "w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-shadow";

const VAT_RATE = 0.05;

// 5% of the entered net amount, as a fixed 2dp string — the starting point
// for the VAT field, which stays editable in case an invoice needs a
// different figure.
function autoVat(amount: string): string {
  const n = Number(amount);
  return amount && !Number.isNaN(n) ? (n * VAT_RATE).toFixed(2) : "";
}

type ClientMatch = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  companyName: string | null;
  trnNumber: string | null;
};

/**
 * Looks up existing clients by company/client name (debounced) and, if a
 * match is found, offers to reuse its saved details instead of retyping
 * them. Only searches once the typed term is at least 2 characters.
 */
function useClientLookup(term: string) {
  const [matches, setMatches] = useState<ClientMatch[]>([]);

  useEffect(() => {
    const q = term.trim();
    const handle = setTimeout(async () => {
      if (q.length < 2) {
        setMatches([]);
        return;
      }
      try {
        const res = await fetch(`/api/clients/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = await res.json();
        setMatches(data.clients ?? []);
      } catch {
        // Best-effort suggestion — silently ignore lookup failures.
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [term]);

  return matches;
}

const CLIENT_FIELDS = [
  { key: "name", label: "Client name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "companyName", label: "Company name" },
  { key: "trnNumber", label: "TRN number" },
] as const;

type ClientFieldKey = (typeof CLIENT_FIELDS)[number]["key"];

function emptyClientFields(): Record<ClientFieldKey, boolean> {
  return { name: false, phone: false, email: false, companyName: false, trnNumber: false };
}
function emptyClientValues(): Record<ClientFieldKey, string> {
  return { name: "", phone: "", email: "", companyName: "", trnNumber: "" };
}

function daysOutstanding(date: string | Date): number {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000));
}

function buildHaystack(r: any): string {
  return [
    r.record.title,
    r.divisionName,
    r.client?.name,
    r.client?.phone,
    r.client?.email,
    r.client?.companyName,
    r.client?.trnNumber,
    r.record.notes,
    r.record.paymentStatus,
    new Date(r.record.date).toLocaleDateString(),
    r.record.amount,
    Number(r.record.amount).toFixed(2),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

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
  const fileRef = useRef<HTMLInputElement>(null);

  const [divisionCode, setDivisionCode] = useState(divisions[0]?.code ?? "AMBULANCE");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"UNPAID" | "PAID" | "COMPLIMENTARY">("UNPAID");
  const [paymentMethod, setPaymentMethod] = useState("POS");
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatAmount, setVatAmount] = useState("");

  function onAmountChange(v: string) {
    setAmount(v);
    if (vatEnabled) setVatAmount(autoVat(v));
  }
  function onVatEnabledChange(checked: boolean) {
    setVatEnabled(checked);
    if (checked) setVatAmount(autoVat(amount));
  }
  const totalCharged = Number(amount || 0) + Number(vatAmount || 0);

  const [includeFields, setIncludeFields] = useState<Record<ClientFieldKey, boolean>>(emptyClientFields());
  const [clientValues, setClientValues] = useState<Record<ClientFieldKey, string>>(emptyClientValues());
  const hasClientDetails = Object.values(includeFields).some(Boolean);
  const [dismissedClientMatch, setDismissedClientMatch] = useState(false);
  const clientMatches = useClientLookup(
    dismissedClientMatch ? "" : clientValues.companyName || clientValues.name
  );

  function reuseClient(match: ClientMatch) {
    setIncludeFields({
      name: !!match.name,
      phone: !!match.phone,
      email: !!match.email,
      companyName: !!match.companyName,
      trnNumber: !!match.trnNumber,
    });
    setClientValues({
      name: match.name ?? "",
      phone: match.phone ?? "",
      email: match.email ?? "",
      companyName: match.companyName ?? "",
      trnNumber: match.trnNumber ?? "",
    });
    setDismissedClientMatch(true);
  }

  const [notes, setNotes] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [filterDivision, setFilterDivision] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ label: "All time" });
  const [selected, setSelected] = useState<any | null>(null);
  const [payingRecord, setPayingRecord] = useState<any | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const dateLabel = paymentStatus === "PAID" ? "Payment Date" : "Date";

  const filteredRecords = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return initialRecords.filter((r) => {
      if (filterDivision && r.divisionCode !== filterDivision) return false;
      if (filterStatus && r.record.paymentStatus !== filterStatus) return false;
      const recordDate = new Date(r.record.date).toISOString().slice(0, 10);
      if (dateRange.dateFrom && recordDate < dateRange.dateFrom) return false;
      if (dateRange.dateTo && recordDate > dateRange.dateTo) return false;
      if (!term) return true;
      return buildHaystack(r).includes(term);
    });
  }, [initialRecords, filterDivision, filterStatus, searchTerm, dateRange]);

  const filteredTotal = useMemo(
    () =>
      filteredRecords.reduce(
        (sum, r) => sum + (r.record.paymentStatus === "COMPLIMENTARY" ? 0 : Number(r.record.amount)),
        0
      ),
    [filteredRecords]
  );

  const filteredOutstanding = useMemo(
    () =>
      filteredRecords.reduce(
        (sum, r) => sum + (r.record.paymentStatus === "UNPAID" ? Number(r.record.amount) : 0),
        0
      ),
    [filteredRecords]
  );

  function buildExportHref(range: DateRange) {
    const params = new URLSearchParams({ type: "INCOME" });
    if (filterDivision) params.set("division", filterDivision);
    if (filterStatus) params.set("status", filterStatus);
    if (range.dateFrom) params.set("dateFrom", range.dateFrom);
    if (range.dateTo) params.set("dateTo", range.dateTo);
    return `/api/reports/export?${params.toString()}`;
  }

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
      const isComplimentary = paymentStatus === "COMPLIMENTARY";

      const payload = {
        divisionCode,
        title,
        date,
        amount: isComplimentary ? 0 : Number(amount || 0),
        paymentStatus,
        paymentDate: paymentStatus !== "UNPAID" ? date : undefined,
        paymentMethod: paymentStatus === "PAID" ? paymentMethod : isComplimentary ? "COMPLIMENTARY" : undefined,
        vatEnabled,
        vatAmount: vatEnabled ? Number(vatAmount || 0) : undefined,
        hasClientDetails,
        client: hasClientDetails ? client : undefined,
        notes,
      };

      const form = new FormData();
      form.set("payload", JSON.stringify(payload));
      const file = fileRef.current?.files?.[0];
      if (file) form.set("invoice", file);

      const res = await fetch("/api/income", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create record");
        return;
      }
      setShowForm(false);
      setTitle("");
      setAmount("");
      setVatEnabled(false);
      setVatAmount("");
      setIncludeFields(emptyClientFields());
      setClientValues(emptyClientValues());
      setDismissedClientMatch(false);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Income</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowExportDialog(true)}>
            Export to Excel
          </Button>
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
          className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-5 animate-fade-slide-in"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">
                Department <span className="text-red-500">*</span>
              </label>
              <select value={divisionCode} onChange={(e) => setDivisionCode(e.target.value)} className={inputClass}>
                {divisions.map((d) => (
                  <option key={d.code} value={d.code}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                {dateLabel} <span className="text-red-500">*</span>
              </label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Title / Description <span className="text-red-500">*</span>
            </label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
            {paymentStatus !== "COMPLIMENTARY" ? (
              <div>
                <label className="block text-xs font-medium mb-1">
                  Net Amount Received (AED) <span className="text-red-500">*</span>
                </label>
                <input type="number" step="0.01" min="0" value={amount} onChange={(e) => onAmountChange(e.target.value)} required className={inputClass} />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium mb-1">Net Amount Received (AED)</label>
                <div className="w-full border border-slate-200 bg-slate-50 rounded-lg px-2 py-1.5 text-sm text-slate-500">
                  Complimentary — recorded at AED 0.00
                </div>
              </div>
            )}
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
            <div className="bg-slate-50 rounded-lg p-3 animate-fade-slide-in">
              <label className="block text-xs font-medium mb-1">
                Payment Method (required) <span className="text-red-500">*</span>
              </label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
                {PAYMENT_METHODS.filter((m) => m !== "COMPLIMENTARY").map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={vatEnabled} onChange={(e) => onVatEnabledChange(e.target.checked)} id="vat" />
              <label htmlFor="vat" className="text-sm">Enable VAT (auto 5%)</label>
              {vatEnabled && (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="VAT amount"
                  value={vatAmount}
                  onChange={(e) => setVatAmount(e.target.value)}
                  className="ml-2 border border-slate-300 rounded-lg px-2 py-1 text-sm w-32 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-shadow"
                />
              )}
            </div>
            {vatEnabled && paymentStatus !== "COMPLIMENTARY" && (
              <p className="text-xs text-slate-500 mt-1.5">
                Amount charged (incl. VAT): <span className="font-medium text-slate-700">{totalCharged.toFixed(2)} AED</span>
              </p>
            )}
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-medium mb-2">Client details (optional)</p>
            <p className="text-xs text-slate-400 mb-3">
              Choose exactly which client fields to attach to this record — you don&apos;t have to fill them all in.
            </p>
            {clientMatches.length > 0 && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-3 animate-fade-slide-in space-y-2">
                <p className="text-xs text-indigo-700">Found existing client{clientMatches.length > 1 ? "s" : ""} with a matching name:</p>
                {clientMatches.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-700">
                      {m.companyName || m.name}
                      {m.companyName && m.name ? <span className="text-slate-400"> — {m.name}</span> : null}
                    </span>
                    <Button type="button" variant="secondary" onClick={() => reuseClient(m)}>Use these details</Button>
                  </div>
                ))}
                <button type="button" onClick={() => setDismissedClientMatch(true)} className="text-xs text-slate-400 underline">
                  Dismiss
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CLIENT_FIELDS.map((f) => (
                <div key={f.key} className={f.key === "trnNumber" ? "md:col-span-2" : undefined}>
                  <label className="flex items-center gap-2 text-sm mb-1">
                    <input type="checkbox" checked={includeFields[f.key]} onChange={() => toggleClientField(f.key)} />
                    {f.label}
                  </label>
                  {includeFields[f.key] && (
                    <input
                      value={clientValues[f.key]}
                      onChange={(e) => {
                        setClientValues((prev) => ({ ...prev, [f.key]: e.target.value }));
                        if (f.key === "name" || f.key === "companyName") setDismissedClientMatch(false);
                      }}
                      className={`${inputClass} animate-fade-slide-in`}
                      placeholder={f.label}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <label className="block text-xs font-medium mb-1">
              Invoice (optional — PDF, PNG, JPEG or WEBP, up to 15MB)
            </label>
            <p className="text-xs text-slate-400 mb-1">
              You can also attach or add another invoice later from the record&apos;s detail view.
            </p>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className={fileInputClass} />
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

      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search title, client, amount..."
            className={`${inputClass} pl-9`}
          />
        </div>
        <select value={filterDivision} onChange={(e) => setFilterDivision(e.target.value)} className={`${inputClass} md:w-56`}>
          <option value="">All departments</option>
          {divisions.map((d) => (
            <option key={d.code} value={d.code}>{d.name}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={`${inputClass} md:w-44`}>
          <option value="">All statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PAID">Paid</option>
          <option value="COMPLIMENTARY">Complimentary</option>
        </select>
      </div>

      <DateRangeFilter onChange={setDateRange} />

      <div className="flex items-center justify-between text-sm text-slate-500 px-1">
        <span>
          {filteredRecords.length} record{filteredRecords.length === 1 ? "" : "s"}
          {dateRange.dateFrom && <> &middot; {dateRange.label}</>}
        </span>
        <span>
          {filteredOutstanding > 0 && (
            <>
              <span className="text-amber-700">Outstanding: {filteredOutstanding.toFixed(2)} AED</span>
              <span className="mx-2 text-slate-300">|</span>
            </>
          )}
          <span className="font-medium text-slate-700">Total: {filteredTotal.toFixed(2)} AED</span>
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 md:px-3 py-2.5">Ref #</th>
              <th className="px-2 md:px-3 py-2.5">Department</th>
              <th className="px-2 md:px-3 py-2.5">Title</th>
              <th className="px-2 md:px-3 py-2.5">Date</th>
              <th className="px-2 md:px-3 py-2.5 text-right">Amount</th>
              <th className="px-2 md:px-3 py-2.5">Status</th>
              <th className="px-2 md:px-3 py-2.5">Client</th>
              <th className="px-2 md:px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((r) => (
              <tr
                key={r.record.id}
                onClick={() => setSelected(r)}
                className="border-t border-slate-100 odd:bg-white even:bg-slate-50/50 hover:bg-indigo-50/60 transition-colors cursor-pointer"
              >
                <td className="px-2 md:px-3 py-2.5 text-slate-400 font-mono text-xs">{formatRefNumber(r.record.refYear, r.record.refSeq)}</td>
                <td className="px-2 md:px-3 py-2.5">{r.divisionName}</td>
                <td className="px-2 md:px-3 py-2.5">{r.record.title}</td>
                <td className="px-2 md:px-3 py-2.5">{new Date(r.record.date).toLocaleDateString()}</td>
                <td className="px-2 md:px-3 py-2.5 text-right tabular-nums font-medium">
                  {r.record.paymentStatus === "COMPLIMENTARY" ? "Complimentary" : `${Number(r.record.amount).toFixed(2)} AED`}
                </td>
                <td className="px-2 md:px-3 py-2.5">
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
                  {r.record.paymentStatus === "UNPAID" && daysOutstanding(r.record.date) > 0 && (
                    <span className="block text-[11px] text-amber-600 mt-0.5">
                      {daysOutstanding(r.record.date)}d outstanding
                    </span>
                  )}
                </td>
                <td className="px-2 md:px-3 py-2.5">
                  {r.client ? (
                    <Link
                      href={`/clients/${r.client.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                    >
                      {r.client.companyName || r.client.name || "View client"}
                    </Link>
                  ) : (
                    <span className="text-slate-400">anonymous</span>
                  )}
                </td>
                <td className="px-2 md:px-3 py-2.5">
                  {canEdit && r.record.paymentStatus === "UNPAID" && (
                    <Button variant="ghost" onClick={(e) => { e.stopPropagation(); setPayingRecord(r); }}>Mark Paid</Button>
                  )}
                </td>
              </tr>
            ))}
            {filteredRecords.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-slate-400">No income records match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <IncomeDetailModal
          row={selected}
          divisions={divisions}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
          onChanged={() => {
            router.refresh();
            setSelected(null);
          }}
        />
      )}

      {payingRecord && (
        <MarkPaidModal
          row={payingRecord}
          onClose={() => setPayingRecord(null)}
          onDone={() => {
            router.refresh();
            setPayingRecord(null);
          }}
        />
      )}

      <ExportDialog open={showExportDialog} onClose={() => setShowExportDialog(false)} buildHref={buildExportHref} />
    </div>
  );
}

function DetailRow({ label, value, full }: { label: string; value: ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-slate-900 break-words">{value}</dd>
    </div>
  );
}

function MarkPaidModal({
  row,
  onClose,
  onDone,
}: {
  row: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const [method, setMethod] = useState("POS");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/income/${row.record.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentDate: date, paymentMethod: method }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "Failed to record payment");
        return;
      }
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Mark as Paid" maxWidth="max-w-sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Recording payment for <span className="font-medium">{row.record.title}</span>
          {" — "}
          {Number(row.record.amount).toFixed(2)} AED.
        </p>
        <div>
          <label className="block text-xs font-medium mb-1">
            Payment Method <span className="text-red-500">*</span>
          </label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
            {PAYMENT_METHODS.filter((m) => m !== "COMPLIMENTARY").map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">
            Payment Date <span className="text-red-500">*</span>
          </label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={confirm} disabled={submitting}>{submitting ? "Saving..." : "Confirm Payment"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function IncomeDetailModal({
  row,
  divisions,
  canEdit,
  onClose,
  onChanged,
}: {
  row: any;
  divisions: Division[];
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const record = row.record;
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [divisionCode, setDivisionCode] = useState(row.divisionCode);
  const [title, setTitle] = useState(record.title);
  const [date, setDate] = useState(new Date(record.date).toISOString().slice(0, 10));
  const [amount, setAmount] = useState(String(record.amount));
  const [vatEnabled, setVatEnabled] = useState(record.vatEnabled);
  const [vatAmount, setVatAmount] = useState(record.vatAmount ? String(record.vatAmount) : "");

  function onAmountChange(v: string) {
    setAmount(v);
    if (vatEnabled) setVatAmount(autoVat(v));
  }
  function onVatEnabledChange(checked: boolean) {
    setVatEnabled(checked);
    if (checked) setVatAmount(autoVat(amount));
  }
  const totalCharged = Number(amount || 0) + Number(vatAmount || 0);

  const [includeFields, setIncludeFields] = useState<Record<ClientFieldKey, boolean>>({
    name: !!row.client?.name,
    phone: !!row.client?.phone,
    email: !!row.client?.email,
    companyName: !!row.client?.companyName,
    trnNumber: !!row.client?.trnNumber,
  });
  const [clientValues, setClientValues] = useState<Record<ClientFieldKey, string>>({
    name: row.client?.name ?? "",
    phone: row.client?.phone ?? "",
    email: row.client?.email ?? "",
    companyName: row.client?.companyName ?? "",
    trnNumber: row.client?.trnNumber ?? "",
  });
  const [notes, setNotes] = useState(record.notes ?? "");

  function toggleClientField(key: ClientFieldKey) {
    setIncludeFields((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const hasClientDetails = Object.values(includeFields).some(Boolean);
      const client: Record<string, string> = {};
      for (const f of CLIENT_FIELDS) if (includeFields[f.key]) client[f.key] = clientValues[f.key];

      const res = await fetch(`/api/income/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          divisionCode,
          title,
          date,
          amount: record.paymentStatus === "COMPLIMENTARY" ? 0 : Number(amount || 0),
          vatEnabled,
          vatAmount: vatEnabled ? Number(vatAmount || 0) : undefined,
          hasClientDetails,
          client: hasClientDetails ? client : undefined,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save changes");
        return;
      }
      onChanged();
    } finally {
      setSubmitting(false);
    }
  }

  async function attachInvoice() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("invoice", file);
      const res = await fetch(`/api/income/${record.id}/invoice`, { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to attach invoice");
        return;
      }
      if (fileRef.current) fileRef.current.value = "";
      onChanged();
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDeleteRecord() {
    const res = await fetch(`/api/income/${record.id}`, { method: "DELETE" });
    setConfirmDelete(false);
    if (res.ok) onChanged();
    else alert((await res.json()).error ?? "Failed to delete record");
  }

  return (
    <>
      <Modal open onClose={onClose} title={editing ? "Edit Income Record" : "Income Record"} maxWidth="max-w-2xl">
        {!editing ? (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <DetailRow label="Reference #" value={formatRefNumber(record.refYear, record.refSeq)} />
              <DetailRow label="Department" value={row.divisionName} />
              <DetailRow label="Date" value={new Date(record.date).toLocaleDateString()} />
              <DetailRow label="Title" value={record.title} full />
              <DetailRow
                label={record.vatEnabled ? "Net Amount Received" : "Amount"}
                value={record.paymentStatus === "COMPLIMENTARY" ? "Complimentary — AED 0.00" : `${Number(record.amount).toFixed(2)} AED`}
              />
              <DetailRow label="Status" value={<Badge color={record.paymentStatus === "PAID" ? "green" : record.paymentStatus === "COMPLIMENTARY" ? "blue" : "amber"}>{record.paymentStatus}</Badge>} />
              {record.vatEnabled && <DetailRow label="VAT (5%)" value={`${Number(record.vatAmount ?? 0).toFixed(2)} AED`} />}
              {record.vatEnabled && record.paymentStatus !== "COMPLIMENTARY" && (
                <DetailRow
                  label="Amount Charged"
                  value={`${(Number(record.amount) + Number(record.vatAmount ?? 0)).toFixed(2)} AED`}
                />
              )}
              {row.payment && <DetailRow label="Payment Date" value={new Date(row.payment.paymentDate).toLocaleDateString()} />}
              {row.payment && <DetailRow label="Payment Method" value={row.payment.paymentMethod} />}
              {row.client?.name && <DetailRow label="Client Name" value={row.client.name} />}
              {row.client?.phone && <DetailRow label="Client Phone" value={row.client.phone} />}
              {row.client?.email && <DetailRow label="Client Email" value={row.client.email} />}
              {row.client?.companyName && <DetailRow label="Client Company" value={row.client.companyName} />}
              {row.client?.trnNumber && <DetailRow label="Client TRN" value={row.client.trnNumber} />}
              {record.notes && <DetailRow label="Notes" value={record.notes} full />}
            </dl>

            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Invoices</p>
              {row.invoices?.length ? (
                <ul className="space-y-1 mb-2">
                  {row.invoices.map((inv: any) => (
                    <li key={inv.id}>
                      <a
                        href={`/api/files/invoice/${inv.id}`}
                        target="_blank"
                        className="text-indigo-600 underline text-sm hover:text-indigo-800 inline-flex items-center gap-1"
                      >
                        <IconPaperclip className="w-3.5 h-3.5" /> {inv.fileName}
                        <span className="text-slate-400 no-underline text-xs">(click to preview)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400 mb-2">No invoice attached.</p>
              )}
              {canEdit && (
                <div className="flex items-center gap-2">
                  <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className={`${fileInputClass} flex-1`} />
                  <Button variant="secondary" type="button" onClick={attachInvoice} disabled={submitting}>
                    Attach
                  </Button>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {canEdit && (
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button variant="dangerGhost" onClick={() => setConfirmDelete(true)}>Delete</Button>
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  <span className="inline-flex items-center gap-1">
                    <IconEdit className="w-3.5 h-3.5" /> Edit
                  </span>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Department</label>
                <select value={divisionCode} onChange={(e) => setDivisionCode(e.target.value)} className={inputClass}>
                  {divisions.map((d) => (
                    <option key={d.code} value={d.code}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Title / Description</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
            </div>
            {record.paymentStatus !== "COMPLIMENTARY" && (
              <div>
                <label className="block text-xs font-medium mb-1">Net Amount Received (AED)</label>
                <input type="number" step="0.01" min="0" value={amount} onChange={(e) => onAmountChange(e.target.value)} required className={inputClass} />
              </div>
            )}
            <p className="text-xs text-slate-400">
              Payment status/method/date can&apos;t be changed here — payment history is permanent once recorded.
            </p>
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={vatEnabled} onChange={(e) => onVatEnabledChange(e.target.checked)} id="vat-edit" />
                <label htmlFor="vat-edit" className="text-sm">Enable VAT (auto 5%)</label>
                {vatEnabled && (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={vatAmount}
                    onChange={(e) => setVatAmount(e.target.value)}
                    className="ml-2 border border-slate-300 rounded-lg px-2 py-1 text-sm w-32"
                  />
                )}
              </div>
              {vatEnabled && record.paymentStatus !== "COMPLIMENTARY" && (
                <p className="text-xs text-slate-500 mt-1.5">
                  Amount charged (incl. VAT): <span className="font-medium text-slate-700">{totalCharged.toFixed(2)} AED</span>
                </p>
              )}
            </div>
            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm font-medium mb-2">Client details</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CLIENT_FIELDS.map((f) => (
                  <div key={f.key} className={f.key === "trnNumber" ? "md:col-span-2" : undefined}>
                    <label className="flex items-center gap-2 text-sm mb-1">
                      <input type="checkbox" checked={includeFields[f.key]} onChange={() => toggleClientField(f.key)} />
                      {f.label}
                    </label>
                    {includeFields[f.key] && (
                      <input
                        value={clientValues[f.key]}
                        onChange={(e) => setClientValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        className={inputClass}
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
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save Changes"}</Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete income record"
        message={`Permanently delete "${record.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDeleteRecord}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
