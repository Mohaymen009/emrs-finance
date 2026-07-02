import { getCurrentUser } from "@/lib/auth";
import { computeDivisionStats, getAllDivisions } from "@/lib/stats";
import DashboardDateFilter from "./DashboardDateFilter";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
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

  const { dateFrom, dateTo } = await searchParams;
  const range = {
    from: dateFrom ? new Date(dateFrom) : undefined,
    to: dateTo ? new Date(dateTo) : undefined,
  };

  const allDivisions = await getAllDivisions();
  const visible = allDivisions.filter((d) => user.divisionCodes.includes(d.code));

  const divisionStats = await Promise.all(
    visible.map(async (d) => ({ division: d, stats: await computeDivisionStats(d.id, range) }))
  );

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
      }),
      { totalIncome: 0, totalExpenses: 0, netProfit: 0, vatCollected: 0, incomeEntryCount: 0, expenseEntryCount: 0 }
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <DashboardDateFilter />
      </div>

      {combined && (
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Company-wide (Admin only)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Income" value={fmt(combined.totalIncome)} />
            <StatCard label="Total Expenses" value={fmt(combined.totalExpenses)} />
            <StatCard label="VAT Collected" value={fmt(combined.vatCollected)} />
            <StatCard label="Entries" value={`${combined.incomeEntryCount + combined.expenseEntryCount}`} />
          </div>
        </section>
      )}

      {divisionStats.map(({ division, stats }) => (
        <section key={division.id}>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">{division.name}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Income" value={fmt(stats.totalIncome)} />
            <StatCard label="Total Expenses" value={fmt(stats.totalExpenses)} />
            <StatCard label="VAT Collected" value={fmt(stats.vatCollected)} />
            <StatCard label="Entries" value={`${stats.incomeEntryCount + stats.expenseEntryCount}`} />
          </div>
        </section>
      ))}

      {divisionStats.length === 0 && !combined && (
        <p className="text-sm text-slate-500">You have not been granted access to any department yet.</p>
      )}
    </div>
  );
}
