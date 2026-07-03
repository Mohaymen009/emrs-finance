import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  computeDivisionStats,
  getAllDivisions,
  monthlyTrend,
  expensesByCategory,
  paymentMethodBreakdown,
  receivablesAging,
  topClients,
} from "@/lib/stats";
import { MonthlyTrendChart, HBarList } from "@/components/charts";
import DashboardDateFilter from "./DashboardDateFilter";

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "amber" }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 p-5">
      <p className="text-xs font-medium text-gray-500 mb-1.5">{label}</p>
      <p className={`text-xl font-semibold tracking-tight tabular-nums ${tone === "amber" ? "text-amber-600" : "text-gray-900"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-card p-6">
      <div className="mb-5">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(n);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  // Dispatchers get no visibility into company-wide financial reporting.
  if (user.role === "DISPATCHER") redirect("/income");

  const { dateFrom, dateTo } = await searchParams;
  const range = {
    from: dateFrom ? new Date(dateFrom) : undefined,
    to: dateTo ? new Date(dateTo) : undefined,
  };
  const rangeSub = dateFrom || dateTo ? "Within the selected date range" : "All time";

  const allDivisions = await getAllDivisions();
  const visible = allDivisions.filter((d) => user.divisionCodes.includes(d.code));
  const visibleIds = visible.map((d) => d.id);

  const [divisionStats, trend, categories, methods, aging, clients] = await Promise.all([
    Promise.all(visible.map(async (d) => ({ division: d, stats: await computeDivisionStats(d.id, range) }))),
    monthlyTrend(visibleIds),
    expensesByCategory(visibleIds, range),
    paymentMethodBreakdown(visibleIds, range),
    receivablesAging(visibleIds, range),
    topClients(visibleIds, range),
  ]);

  let combined = null;
  if (user.role === "ADMIN") {
    const all = await Promise.all(allDivisions.map(async (d) => await computeDivisionStats(d.id, range)));
    combined = all.reduce(
      (acc, s) => ({
        totalIncome: acc.totalIncome + s.totalIncome,
        totalExpenses: acc.totalExpenses + s.totalExpenses,
        netProfit: acc.netProfit + s.netProfit,
        vatCollected: acc.vatCollected + s.vatCollected,
        incomeEntryCount: acc.incomeEntryCount + s.incomeEntryCount,
        expenseEntryCount: acc.expenseEntryCount + s.expenseEntryCount,
        outstanding: acc.outstanding + s.outstanding,
        outstandingCount: acc.outstandingCount + s.outstandingCount,
      }),
      {
        totalIncome: 0,
        totalExpenses: 0,
        netProfit: 0,
        vatCollected: 0,
        incomeEntryCount: 0,
        expenseEntryCount: 0,
        outstanding: 0,
        outstandingCount: 0,
      }
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <DashboardDateFilter />
      </div>

      {combined && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Company-wide (Admin only)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Total Income" value={fmt(combined.totalIncome)} />
            <StatCard label="Total Expenses" value={fmt(combined.totalExpenses)} />
            <StatCard label="VAT Collected" value={fmt(combined.vatCollected)} />
            <StatCard
              label="Outstanding"
              value={fmt(combined.outstanding)}
              sub={`${combined.outstandingCount} unpaid record${combined.outstandingCount === 1 ? "" : "s"}`}
              tone={combined.outstanding > 0 ? "amber" : undefined}
            />
            <StatCard label="Entries" value={`${combined.incomeEntryCount + combined.expenseEntryCount}`} />
          </div>
        </section>
      )}

      {divisionStats.map(({ division, stats }) => (
        <section key={division.id}>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{division.name}</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Total Income" value={fmt(stats.totalIncome)} />
            <StatCard label="Total Expenses" value={fmt(stats.totalExpenses)} />
            <StatCard label="VAT Collected" value={fmt(stats.vatCollected)} />
            <StatCard
              label="Outstanding"
              value={fmt(stats.outstanding)}
              sub={`${stats.outstandingCount} unpaid record${stats.outstandingCount === 1 ? "" : "s"}`}
              tone={stats.outstanding > 0 ? "amber" : undefined}
            />
            <StatCard label="Entries" value={`${stats.incomeEntryCount + stats.expenseEntryCount}`} />
          </div>
        </section>
      ))}

      {visibleIds.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Analytics</h2>

          <Panel title="Income vs Expenses" sub="Last 12 months, across your departments (not affected by the date filter)">
            <MonthlyTrendChart data={trend} />
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel
              title="Receivables Aging"
              sub={`${fmt(aging.total)} outstanding across ${aging.count} unpaid record${aging.count === 1 ? "" : "s"} — ${rangeSub.toLowerCase()}`}
            >
              <HBarList
                color="#f59e0b"
                items={aging.buckets.map((b) => ({
                  label: b.label,
                  value: b.total,
                  hint: b.count > 0 ? `${b.count} record${b.count === 1 ? "" : "s"}` : undefined,
                }))}
              />
            </Panel>

            <Panel title="Collections by Payment Method" sub={rangeSub}>
              <HBarList
                color="#10b981"
                items={methods.map((m) => ({
                  label: m.method,
                  value: m.total,
                  hint: `${m.count} payment${m.count === 1 ? "" : "s"}`,
                }))}
                emptyMessage="No recorded payments for this period."
              />
            </Panel>

            <Panel title="Expenses by Category" sub={rangeSub}>
              <HBarList
                color="#fb7185"
                items={categories.slice(0, 8).map((c) => ({
                  label: c.category,
                  value: c.total,
                  hint: `${c.count} entr${c.count === 1 ? "y" : "ies"}`,
                }))}
                emptyMessage="No expenses recorded for this period."
              />
            </Panel>

            <Panel title="Top Clients by Revenue" sub={rangeSub}>
              {clients.length === 0 ? (
                <p className="text-sm text-gray-400">No client-linked income for this period.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {clients.map((c, i) => (
                    <li key={c.clientId} className="py-2.5 first:pt-0 last:pb-0">
                      <Link
                        href={`/clients/${c.clientId}`}
                        className="flex items-center justify-between gap-3 group"
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span className="h-6 w-6 shrink-0 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="text-sm text-gray-700 truncate group-hover:text-blue-700 transition-colors">
                            {c.displayName}
                          </span>
                        </span>
                        <span className="text-right whitespace-nowrap">
                          <span className="block text-sm font-medium tabular-nums">{fmt(c.total)}</span>
                          {c.outstanding > 0 && (
                            <span className="block text-xs text-amber-600 tabular-nums">
                              {fmt(c.outstanding)} outstanding
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </section>
      )}

      {divisionStats.length === 0 && !combined && (
        <p className="text-sm text-gray-500">You have not been granted access to any department yet.</p>
      )}
    </div>
  );
}
