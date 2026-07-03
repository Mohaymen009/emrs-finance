// Server-rendered chart primitives for the dashboard. Pure markup (SVG +
// divs) with no client-side JS or charting dependency — the Dockerfile uses
// `npm ci` against the committed lockfile, so new packages are avoided the
// same way the hand-rolled icons in ui.tsx are.

import type { MonthlyPoint } from "@/lib/stats";

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}k`;
  return n.toFixed(0);
}

const INCOME_COLOR = "#2563eb"; // blue-600 accent
const EXPENSE_COLOR = "#fb7185"; // rose-400

/** Grouped monthly income-vs-expenses bar chart. */
export function MonthlyTrendChart({ data }: { data: MonthlyPoint[] }) {
  const width = 760;
  const height = 240;
  const pad = { top: 14, right: 12, bottom: 26, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expenses)));
  const groupW = plotW / Math.max(1, data.length);
  const barW = Math.min(14, groupW / 2.8);

  const gridLines = [0.25, 0.5, 0.75, 1];

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Monthly income vs expenses">
        {gridLines.map((g) => {
          const y = pad.top + plotH * (1 - g);
          return (
            <g key={g}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={pad.left - 6} y={y + 3.5} textAnchor="end" fontSize={10} fill="#9ca3af">
                {compact(max * g)}
              </text>
            </g>
          );
        })}
        <line x1={pad.left} x2={width - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} stroke="#d1d5db" strokeWidth={1} />

        {data.map((d, i) => {
          const cx = pad.left + groupW * i + groupW / 2;
          const incomeH = (d.income / max) * plotH;
          const expenseH = (d.expenses / max) * plotH;
          return (
            <g key={d.month}>
              <rect
                x={cx - barW - 1.5}
                y={pad.top + plotH - incomeH}
                width={barW}
                height={Math.max(incomeH, d.income > 0 ? 2 : 0)}
                rx={2}
                fill={INCOME_COLOR}
              >
                <title>{`${d.label}: income ${d.income.toFixed(2)} AED`}</title>
              </rect>
              <rect
                x={cx + 1.5}
                y={pad.top + plotH - expenseH}
                width={barW}
                height={Math.max(expenseH, d.expenses > 0 ? 2 : 0)}
                rx={2}
                fill={EXPENSE_COLOR}
              >
                <title>{`${d.label}: expenses ${d.expenses.toFixed(2)} AED`}</title>
              </rect>
              <text x={cx} y={height - 8} textAnchor="middle" fontSize={10} fill="#6b7280">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: INCOME_COLOR }} /> Income
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: EXPENSE_COLOR }} /> Expenses
        </span>
      </div>
    </div>
  );
}

export type HBarItem = { label: string; value: number; hint?: string };

/** Horizontal bar list — used for category/payment-method/aging breakdowns. */
export function HBarList({
  items,
  color = "#2563eb",
  emptyMessage = "No data for this period.",
}: {
  items: HBarItem[];
  color?: string;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400">{emptyMessage}</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-2 text-sm mb-1">
            <span className="text-gray-700 truncate">{item.label}</span>
            <span className="tabular-nums font-medium text-gray-800 whitespace-nowrap">
              {item.value.toFixed(2)} AED
              {item.hint && <span className="ml-1.5 text-xs font-normal text-gray-400">{item.hint}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: item.value === 0 ? 0 : `${Math.max(2, (item.value / max) * 100)}%`, backgroundColor: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
