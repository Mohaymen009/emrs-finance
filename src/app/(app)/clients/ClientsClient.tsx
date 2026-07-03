"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge, IconSearch } from "@/components/ui";
import { ClientFormModal, type ClientFormValues } from "./ClientFormModal";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-shadow";

type ClientRow = {
  client: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    companyName: string | null;
    trnNumber: string | null;
    address: string | null;
    notes: string | null;
    createdAt: string;
  };
  recordCount: number;
  totalBilled: number;
  totalVat: number;
  outstanding: number;
  lastActivity: string | null;
  lastPayment: string | null;
};

type SortKey = "recent" | "name" | "billed" | "outstanding";

export function clientDisplayName(c: { name: string | null; companyName: string | null }) {
  return c.companyName || c.name || "Unnamed client";
}

/** Shared result table for both the full Admin/Viewer list and a Dispatcher's search results. */
function ClientsTable({ rows, emptyMessage }: { rows: ClientRow[]; emptyMessage: string }) {
  const router = useRouter();
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          <tr>
            <th className="px-3 md:px-4 py-3">Client</th>
            <th className="px-3 md:px-4 py-3">Contact</th>
            <th className="px-3 md:px-4 py-3">TRN</th>
            <th className="px-3 md:px-4 py-3 text-right">Records</th>
            <th className="px-3 md:px-4 py-3 text-right">Total Billed</th>
            <th className="px-3 md:px-4 py-3 text-right">Outstanding</th>
            <th className="px-3 md:px-4 py-3">Last Activity</th>
            <th className="px-3 md:px-4 py-3">Last Payment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.client.id}
              onClick={() => router.push(`/clients/${r.client.id}`)}
              className="border-t border-gray-100 odd:bg-white even:bg-gray-50/50 hover:bg-blue-50/60 transition-colors cursor-pointer"
            >
              <td className="px-3 md:px-4 py-3">
                <span className="font-medium text-gray-800">{clientDisplayName(r.client)}</span>
                {r.client.companyName && r.client.name && (
                  <span className="block text-xs text-gray-400">{r.client.name}</span>
                )}
              </td>
              <td className="px-3 md:px-4 py-3 text-gray-600">
                {r.client.phone && <span className="block">{r.client.phone}</span>}
                {r.client.email && <span className="block text-xs text-gray-400">{r.client.email}</span>}
                {!r.client.phone && !r.client.email && <span className="text-gray-300">—</span>}
              </td>
              <td className="px-3 md:px-4 py-3 font-mono text-xs text-gray-500">{r.client.trnNumber ?? "—"}</td>
              <td className="px-3 md:px-4 py-3 text-right tabular-nums">{r.recordCount}</td>
              <td className="px-3 md:px-4 py-3 text-right tabular-nums font-medium">{r.totalBilled.toFixed(2)} AED</td>
              <td className="px-3 md:px-4 py-3 text-right tabular-nums">
                {r.outstanding > 0 ? (
                  <Badge color="amber">{r.outstanding.toFixed(2)} AED</Badge>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-3 md:px-4 py-3 text-gray-500">
                {r.lastActivity ? new Date(r.lastActivity).toLocaleDateString() : "—"}
              </td>
              <td className="px-3 md:px-4 py-3 text-gray-500">
                {r.lastPayment ? new Date(r.lastPayment).toLocaleDateString() : "—"}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="p-6 text-center text-gray-400">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Dispatcher-only mode: no default listing at all — client data is only
 * ever fetched after a real name/phone query (see
 * GET /api/clients/search-verified), so nothing is loaded, browsable, or
 * embedded in the page until the dispatcher actually searches.
 */
function DispatcherClientSearch({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<ClientRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const hasValidQuery = name.trim().length >= 2 || phone.replace(/\D/g, "").length >= 7;

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!hasValidQuery) {
      setError("Enter a client name/company (2+ characters) or a phone number to search.");
      setResults(null);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (name.trim()) params.set("name", name.trim());
      if (phone.trim()) params.set("phone", phone.trim());
      const res = await fetch(`/api/clients/search-verified?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed");
        setResults(null);
        return;
      }
      setResults(data.clients ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function createClient(values: ClientFormValues): Promise<string | null> {
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (!res.ok) return data.error ?? "Failed to create client";
    setShowCreate(false);
    router.refresh();
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        {canEdit && (
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            + New Client
          </Button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-card p-5">
        <p className="text-sm font-medium mb-1">Look up a client</p>
        <p className="text-xs text-gray-400 mb-3">
          For security, client details are only shown after a search — enter a name/company or phone number.
        </p>
        <form onSubmit={search} className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client name or company"
              className={`${inputClass} pl-9`}
            />
          </div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            className={`${inputClass} md:w-56`}
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </form>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      {results !== null && (
        <>
          <p className="text-sm text-gray-500 px-1">
            {results.length} client{results.length === 1 ? "" : "s"} found
          </p>
          <ClientsTable rows={results} emptyMessage="No clients match that name or phone number." />
        </>
      )}

      {showCreate && (
        <ClientFormModal
          title="New Client"
          submitLabel="Create Client"
          onSubmit={createClient}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

export default function ClientsClient({
  initialClients,
  canEdit,
  restrictedSearch = false,
}: {
  initialClients: ClientRow[];
  canEdit: boolean;
  restrictedSearch?: boolean;
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [onlyOutstanding, setOnlyOutstanding] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const rows = initialClients.filter((r) => {
      if (onlyOutstanding && r.outstanding <= 0) return false;
      if (!term) return true;
      return [r.client.name, r.client.companyName, r.client.phone, r.client.email, r.client.trnNumber]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
    const sorted = [...rows];
    if (sortKey === "name") {
      sorted.sort((a, b) => clientDisplayName(a.client).localeCompare(clientDisplayName(b.client)));
    } else if (sortKey === "billed") {
      sorted.sort((a, b) => b.totalBilled - a.totalBilled);
    } else if (sortKey === "outstanding") {
      sorted.sort((a, b) => b.outstanding - a.outstanding);
    }
    // "recent" keeps the server order (newest first).
    return sorted;
  }, [initialClients, searchTerm, sortKey, onlyOutstanding]);

  const totals = useMemo(
    () => ({
      billed: filtered.reduce((s, r) => s + r.totalBilled, 0),
      outstanding: filtered.reduce((s, r) => s + r.outstanding, 0),
    }),
    [filtered]
  );

  async function createClient(values: ClientFormValues): Promise<string | null> {
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (!res.ok) return data.error ?? "Failed to create client";
    setShowCreate(false);
    router.refresh();
    return null;
  }

  if (restrictedSearch) {
    return <DispatcherClientSearch canEdit={canEdit} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        {canEdit && (
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            + New Client
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search name, company, phone, email, TRN..."
            className={`${inputClass} pl-9`}
          />
        </div>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={`${inputClass} md:w-56`}>
          <option value="recent">Recently added</option>
          <option value="name">Name (A–Z)</option>
          <option value="billed">Highest total billed</option>
          <option value="outstanding">Highest outstanding</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 md:w-48 px-1">
          <input type="checkbox" checked={onlyOutstanding} onChange={(e) => setOnlyOutstanding(e.target.checked)} />
          With outstanding only
        </label>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 px-1">
        <span>
          {filtered.length} client{filtered.length === 1 ? "" : "s"}
        </span>
        <span>
          Billed: <span className="font-medium text-gray-700">{totals.billed.toFixed(2)} AED</span>
          <span className="mx-2 text-gray-300">|</span>
          Outstanding: <span className="font-medium text-amber-700">{totals.outstanding.toFixed(2)} AED</span>
        </span>
      </div>

      <ClientsTable
        rows={filtered}
        emptyMessage={`No clients match. Clients appear here automatically when income records include client details${canEdit ? ", or add one with “+ New Client”." : "."}`}
      />

      {showCreate && (
        <ClientFormModal
          title="New Client"
          submitLabel="Create Client"
          onSubmit={createClient}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
