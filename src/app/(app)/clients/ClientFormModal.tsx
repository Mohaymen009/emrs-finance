"use client";

import { useState } from "react";
import { Button, Modal } from "@/components/ui";

const inputClass =
  "w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-shadow";

export type ClientFormValues = {
  name: string;
  phone: string;
  email: string;
  companyName: string;
  trnNumber: string;
  address: string;
  notes: string;
};

const EMPTY: ClientFormValues = {
  name: "",
  phone: "",
  email: "",
  companyName: "",
  trnNumber: "",
  address: "",
  notes: "",
};

/**
 * Shared create/edit client form. `onSubmit` returns an error message to
 * display, or null on success (the caller closes the modal / refreshes).
 */
export function ClientFormModal({
  title,
  submitLabel,
  initialValues,
  onSubmit,
  onClose,
}: {
  title: string;
  submitLabel: string;
  initialValues?: Partial<ClientFormValues>;
  onSubmit: (values: ClientFormValues) => Promise<string | null>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<ClientFormValues>({ ...EMPTY, ...initialValues });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ClientFormValues>(key: K, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const err = await onSubmit(values);
      if (err) setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={title} maxWidth="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Client name</label>
            <input value={values.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Company name</label>
            <input value={values.companyName} onChange={(e) => set("companyName", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Phone</label>
            <input value={values.phone} onChange={(e) => set("phone", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Email</label>
            <input type="email" value={values.email} onChange={(e) => set("email", e.target.value)} className={inputClass} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1">TRN number</label>
            <input value={values.trnNumber} onChange={(e) => set("trnNumber", e.target.value)} className={inputClass} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1">Address</label>
            <input value={values.address} onChange={(e) => set("address", e.target.value)} className={inputClass} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1">Internal notes</label>
            <textarea value={values.notes} onChange={(e) => set("notes", e.target.value)} className={inputClass} rows={2} />
          </div>
        </div>
        <p className="text-xs text-slate-400">A client name or company name is required — everything else is optional.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
