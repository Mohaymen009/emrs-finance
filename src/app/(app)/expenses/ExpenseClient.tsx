"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
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
import { EXPENSE_CATEGORIES } from "@/lib/expenseCategories";

type Division = { code: string; name: string };

const inputClass =
  "w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-shadow";

const VAT_RATE = 0.05;

// 5% of the entered net amount, as a fixed 2dp string — the starting point
// for the VAT field, which stays editable in case a receipt shows a
// different figure.
function autoVat(amount: string): string {
  const n = Number(amount);
  return amount && !Number.isNaN(n) ? (n * VAT_RATE).toFixed(2) : "";
}

/** Renders the category preset dropdown + "Other" free-text fallback. */
function CategoryField({
  category,
  setCategory,
  customCategory,
  setCustomCategory,
  idSuffix = "",
}: {
  category: string;
  setCategory: (v: string) => void;
  customCategory: string;
  setCustomCategory: (v: string) => void;
  idSuffix?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1">
        Category <span className="text-red-500">*</span>
      </label>
      <select
        id={`expense-category${idSuffix}`}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        required
        className={inputClass}
      >
        <option value="" disabled>Select a category…</option>
        {EXPENSE_CATEGORIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
        <option value="OTHER">Other (specify)</option>
      </select>
      {category === "OTHER" && (
        <input
          value={customCategory}
          onChange={(e) => setCustomCategory(e.target.value)}
          placeholder="Enter custom category"
          required
          className={`${inputClass} mt-2 animate-fade-slide-in`}
        />
      )}
    </div>
  );
}

function buildHaystack(r: any): string {
  return [
    r.record.description,
    r.record.category,
    r.divisionName,
    r.record.supplierName,
    r.record.notes,
    new Date(r.record.date).toLocaleDateString(),
    r.record.amount,
    Number(r.record.amount).toFixed(2),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

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
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatAmount, setVatAmount] = useState("");
  const [notes, setNotes] = useState("");

  function onAmountChange(v: string) {
    setAmount(v);
    if (vatEnabled) setVatAmount(autoVat(v));
  }
  function onVatEnabledChange(checked: boolean) {
    setVatEnabled(checked);
    if (checked) setVatAmount(autoVat(amount));
  }
  const totalCharged = Number(amount || 0) + Number(vatAmount || 0);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterDivision, setFilterDivision] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ label: "All time" });
  const [selected, setSelected] = useState<any | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Every category that actually appears in the data (presets and custom
  // "Other" values alike), so the filter always matches what's on screen.
  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const r of initialRecords) {
      if (r.record.category) seen.add(r.record.category);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [initialRecords]);

  const filteredRecords = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return initialRecords.filter((r) => {
      if (filterDivision && r.divisionCode !== filterDivision) return false;
      if (filterCategory === "__NONE__") {
        if (r.record.category) return false;
      } else if (filterCategory && r.record.category !== filterCategory) {
        return false;
      }
      const recordDate = new Date(r.record.date).toISOString().slice(0, 10);
      if (dateRange.dateFrom && recordDate < dateRange.dateFrom) return false;
      if (dateRange.dateTo && recordDate > dateRange.dateTo) return false;
      if (!term) return true;
      return buildHaystack(r).includes(term);
    });
  }, [initialRecords, filterDivision, filterCategory, searchTerm, dateRange]);

  const filteredTotal = useMemo(
    () => filteredRecords.reduce((sum, r) => sum + Number(r.record.amount), 0),
    [filteredRecords]
  );

  function buildExportHref(range: DateRange) {
    const params = new URLSearchParams({ type: "EXPENSE" });
    if (filterDivision) params.set("division", filterDivision);
    if (range.dateFrom) params.set("dateFrom", range.dateFrom);
    if (range.dateTo) params.set("dateTo", range.dateTo);
    return `/api/reports/export?${params.toString()}`;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("divisionCode", divisionCode);
      form.set("description", description);
      form.set("category", category === "OTHER" ? customCategory : category);
      form.set("date", date);
      form.set("amount", amount);
      form.set("supplierName", supplierName);
      form.set("vatEnabled", String(vatEnabled));
      if (vatEnabled) form.set("vatAmount", vatAmount);
      form.set("notes", notes);
      const file = fileRef.current?.files?.[0];
      if (file) form.set("receipt", file);

      const res = await fetch("/api/expense", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create record");
        return;
      }
      setShowForm(false);
      setDescription("");
      setCategory("");
      setCustomCategory("");
      setAmount("");
      setVatEnabled(false);
      setVatAmount("");
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
          <Button variant="secondary" onClick={() => setShowExportDialog(true)}>
            Export to Excel
          </Button>
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
                Expense Date <span className="text-red-500">*</span>
              </label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">
                Expense Description <span className="text-red-500">*</span>
              </label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} required className={inputClass} />
            </div>
            <CategoryField
              category={category}
              setCategory={setCategory}
              customCategory={customCategory}
              setCustomCategory={setCustomCategory}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
            <div>
              <label className="block text-xs font-medium mb-1">
                Net Amount (AED) <span className="text-red-500">*</span>
              </label>
              <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => onAmountChange(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Supplier (optional)</label>
              <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={vatEnabled} onChange={(e) => onVatEnabledChange(e.target.checked)} id="vat-exp" />
              <label htmlFor="vat-exp" className="text-sm">Enable VAT (auto 5%)</label>
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
            {vatEnabled && (
              <p className="text-xs text-slate-500 mt-1.5">
                Total charged (incl. VAT): <span className="font-medium text-slate-700">{totalCharged.toFixed(2)} AED</span>
              </p>
            )}
          </div>

          <div className="border-t border-slate-100 pt-4">
            <label className="block text-xs font-medium mb-1">
              Receipt (optional — PDF, PNG, JPEG or WEBP, up to 15MB)
            </label>
            <p className="text-xs text-slate-400 mb-1">
              You can also attach or add another receipt later from the record&apos;s detail view.
            </p>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className={fileInputClass} />
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

      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search description, supplier, amount..."
            className={`${inputClass} pl-9`}
          />
        </div>
        <select value={filterDivision} onChange={(e) => setFilterDivision(e.target.value)} className={`${inputClass} md:w-56`}>
          <option value="">All departments</option>
          {divisions.map((d) => (
            <option key={d.code} value={d.code}>{d.name}</option>
          ))}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={`${inputClass} md:w-52`}>
          <option value="">All categories</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
          <option value="__NONE__">Uncategorised</option>
        </select>
      </div>

      <DateRangeFilter onChange={setDateRange} />

      <div className="flex items-center justify-between text-sm text-slate-500 px-1">
        <span>
          {filteredRecords.length} record{filteredRecords.length === 1 ? "" : "s"}
          {dateRange.dateFrom && <> &middot; {dateRange.label}</>}
        </span>
        <span className="font-medium text-slate-700">Total: {filteredTotal.toFixed(2)} AED</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 md:px-3 py-2.5">Ref #</th>
              <th className="px-2 md:px-3 py-2.5">Department</th>
              <th className="px-2 md:px-3 py-2.5">Description</th>
              <th className="px-2 md:px-3 py-2.5">Category</th>
              <th className="px-2 md:px-3 py-2.5">Date</th>
              <th className="px-2 md:px-3 py-2.5 text-right">Amount</th>
              <th className="px-2 md:px-3 py-2.5">Supplier</th>
              <th className="px-2 md:px-3 py-2.5">Receipt</th>
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
                <td className="px-2 md:px-3 py-2.5">{r.record.description}</td>
                <td className="px-2 md:px-3 py-2.5">{r.record.category ?? "—"}</td>
                <td className="px-2 md:px-3 py-2.5">{new Date(r.record.date).toLocaleDateString()}</td>
                <td className="px-2 md:px-3 py-2.5 text-right tabular-nums font-medium">{Number(r.record.amount).toFixed(2)} AED</td>
                <td className="px-2 md:px-3 py-2.5">{r.record.supplierName ?? "—"}</td>
                <td className="px-2 md:px-3 py-2.5">
                  {r.receipts?.length ? (
                    <span className="text-slate-600 text-xs">{r.receipts.length} file{r.receipts.length > 1 ? "s" : ""}</span>
                  ) : (
                    <span className="text-slate-400 text-xs">none</span>
                  )}
                </td>
              </tr>
            ))}
            {filteredRecords.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-slate-400">No expense records match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <ExpenseDetailModal
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

function ExpenseDetailModal({
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
  const [description, setDescription] = useState(record.description);
  const isPreset = record.category ? (EXPENSE_CATEGORIES as readonly string[]).includes(record.category) : false;
  const [category, setCategory] = useState(isPreset ? record.category : record.category ? "OTHER" : "");
  const [customCategory, setCustomCategory] = useState(isPreset ? "" : record.category ?? "");
  const [date, setDate] = useState(new Date(record.date).toISOString().slice(0, 10));
  const [amount, setAmount] = useState(String(record.amount));
  const [supplierName, setSupplierName] = useState(record.supplierName ?? "");
  const [vatEnabled, setVatEnabled] = useState(record.vatEnabled);
  const [vatAmount, setVatAmount] = useState(record.vatAmount ? String(record.vatAmount) : "");
  const [notes, setNotes] = useState(record.notes ?? "");

  function onAmountChange(v: string) {
    setAmount(v);
    if (vatEnabled) setVatAmount(autoVat(v));
  }
  function onVatEnabledChange(checked: boolean) {
    setVatEnabled(checked);
    if (checked) setVatAmount(autoVat(amount));
  }
  const totalCharged = Number(amount || 0) + Number(vatAmount || 0);

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/expense/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          divisionCode,
          description,
          category: category === "OTHER" ? customCategory : category,
          date,
          amount: Number(amount || 0),
          supplierName: supplierName || undefined,
          vatEnabled,
          vatAmount: vatEnabled ? Number(vatAmount || 0) : undefined,
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

  async function attachReceipt() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("receipt", file);
      const res = await fetch(`/api/expense/${record.id}/receipt`, { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to attach receipt");
        return;
      }
      if (fileRef.current) fileRef.current.value = "";
      onChanged();
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDeleteRecord() {
    const res = await fetch(`/api/expense/${record.id}`, { method: "DELETE" });
    setConfirmDelete(false);
    if (res.ok) onChanged();
    else alert((await res.json()).error ?? "Failed to delete record");
  }

  return (
    <>
      <Modal open onClose={onClose} title={editing ? "Edit Expense Record" : "Expense Record"} maxWidth="max-w-2xl">
        {!editing ? (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <DetailRow label="Reference #" value={formatRefNumber(record.refYear, record.refSeq)} />
              <DetailRow label="Department" value={row.divisionName} />
              <DetailRow label="Date" value={new Date(record.date).toLocaleDateString()} />
              <DetailRow label="Description" value={record.description} full />
              {record.category && <DetailRow label="Category" value={record.category} />}
              <DetailRow label={record.vatEnabled ? "Net Amount" : "Amount"} value={`${Number(record.amount).toFixed(2)} AED`} />
              {record.supplierName && <DetailRow label="Supplier" value={record.supplierName} />}
              {record.vatEnabled && <DetailRow label="VAT (5%)" value={`${Number(record.vatAmount ?? 0).toFixed(2)} AED`} />}
              {record.vatEnabled && (
                <DetailRow
                  label="Total Charged"
                  value={`${(Number(record.amount) + Number(record.vatAmount ?? 0)).toFixed(2)} AED`}
                />
              )}
              {record.notes && <DetailRow label="Notes" value={record.notes} full />}
            </dl>

            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Receipts</p>
              {row.receipts?.length ? (
                <ul className="space-y-1 mb-2">
                  {row.receipts.map((rc: any) => (
                    <li key={rc.id}>
                      <a
                        href={`/api/files/receipt/${rc.id}`}
                        target="_blank"
                        className="text-indigo-600 underline text-sm hover:text-indigo-800 inline-flex items-center gap-1"
                      >
                        <IconPaperclip className="w-3.5 h-3.5" /> {rc.fileName}
                        <span className="text-slate-400 no-underline text-xs">(click to preview)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400 mb-2">No receipt attached.</p>
              )}
              {canEdit && (
                <div className="flex items-center gap-2">
                  <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className={`${fileInputClass} flex-1`} />
                  <Button variant="secondary" type="button" onClick={attachReceipt} disabled={submitting}>
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
                <label className="block text-xs font-medium mb-1">Expense Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Expense Description</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} required className={inputClass} />
              </div>
              <CategoryField
                category={category}
                setCategory={setCategory}
                customCategory={customCategory}
                setCustomCategory={setCustomCategory}
                idSuffix="-edit"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Net Amount (AED)</label>
                <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => onAmountChange(e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Supplier</label>
                <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={vatEnabled} onChange={(e) => onVatEnabledChange(e.target.checked)} id="vat-exp-edit" />
                <label htmlFor="vat-exp-edit" className="text-sm">Enable VAT (auto 5%)</label>
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
              {vatEnabled && (
                <p className="text-xs text-slate-500 mt-1.5">
                  Total charged (incl. VAT): <span className="font-medium text-slate-700">{totalCharged.toFixed(2)} AED</span>
                </p>
              )}
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
        title="Delete expense record"
        message={`Permanently delete "${record.description}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDeleteRecord}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
