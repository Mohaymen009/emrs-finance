"use client";

import { useEffect, useState } from "react";

export type DateRange = { dateFrom?: string; dateTo?: string; label: string };

const inputClass =
  "border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-shadow";

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - n);
  return d;
}

const PRESETS = {
  all: { label: "All time", range: (): DateRange => ({ label: "All time" }) },
  "7d": { label: "Last 7 days", range: (): DateRange => ({ dateFrom: toISODate(daysAgo(6)), dateTo: toISODate(new Date()), label: "Last 7 days" }) },
  "30d": { label: "Last 30 days", range: (): DateRange => ({ dateFrom: toISODate(daysAgo(29)), dateTo: toISODate(new Date()), label: "Last 30 days" }) },
  thisMonth: {
    label: "This month",
    range: (): DateRange => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: toISODate(from), dateTo: toISODate(now), label: "This month" };
    },
  },
  lastMonth: {
    label: "Last month",
    range: (): DateRange => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { dateFrom: toISODate(from), dateTo: toISODate(to), label: "Last month" };
    },
  },
  "3m": { label: "Last 3 months", range: (): DateRange => ({ dateFrom: toISODate(monthsAgo(3)), dateTo: toISODate(new Date()), label: "Last 3 months" }) },
  "6m": { label: "Last 6 months", range: (): DateRange => ({ dateFrom: toISODate(monthsAgo(6)), dateTo: toISODate(new Date()), label: "Last 6 months" }) },
  "12m": { label: "Last 12 months", range: (): DateRange => ({ dateFrom: toISODate(monthsAgo(12)), dateTo: toISODate(new Date()), label: "Last 12 months" }) },
} as const;

type PresetKey = keyof typeof PRESETS | "customDays" | "customWeeks" | "customMonths" | "customRange";

/**
 * Shared date-range picker used by Income/Expenses (list + export) and the
 * Dashboard. Quick presets cover the common cases; the "custom" options let
 * someone type an exact number of days/weeks/months back, or an explicit
 * from/to range, rather than being stuck with fixed buckets.
 */
export function DateRangeFilter({ onChange, className = "" }: { onChange: (range: DateRange) => void; className?: string }) {
  const [preset, setPreset] = useState<PresetKey>("all");
  const [customN, setCustomN] = useState(7);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    if (preset in PRESETS) {
      onChange(PRESETS[preset as keyof typeof PRESETS].range());
      return;
    }
    if (preset === "customDays") {
      onChange({ dateFrom: toISODate(daysAgo(Math.max(0, customN - 1))), dateTo: toISODate(new Date()), label: `Last ${customN} day${customN === 1 ? "" : "s"}` });
      return;
    }
    if (preset === "customWeeks") {
      onChange({ dateFrom: toISODate(daysAgo(customN * 7 - 1)), dateTo: toISODate(new Date()), label: `Last ${customN} week${customN === 1 ? "" : "s"}` });
      return;
    }
    if (preset === "customMonths") {
      onChange({ dateFrom: toISODate(monthsAgo(customN)), dateTo: toISODate(new Date()), label: `Last ${customN} month${customN === 1 ? "" : "s"}` });
      return;
    }
    if (preset === "customRange") {
      if (customFrom && customTo) {
        onChange({ dateFrom: customFrom, dateTo: customTo, label: `${customFrom} → ${customTo}` });
      } else {
        onChange({ label: "Custom range" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customN, customFrom, customTo]);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <select value={preset} onChange={(e) => setPreset(e.target.value as PresetKey)} className={inputClass}>
        <optgroup label="Quick ranges">
          {Object.entries(PRESETS).map(([key, p]) => (
            <option key={key} value={key}>{p.label}</option>
          ))}
        </optgroup>
        <optgroup label="Custom">
          <option value="customDays">Last N days...</option>
          <option value="customWeeks">Last N weeks...</option>
          <option value="customMonths">Last N months...</option>
          <option value="customRange">Custom date range...</option>
        </optgroup>
      </select>

      {(preset === "customDays" || preset === "customWeeks" || preset === "customMonths") && (
        <input
          type="number"
          min={1}
          max={preset === "customMonths" ? 60 : preset === "customWeeks" ? 260 : 1825}
          value={customN}
          onChange={(e) => setCustomN(Math.max(1, Number(e.target.value) || 1))}
          className={`${inputClass} w-20`}
        />
      )}

      {preset === "customRange" && (
        <>
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={inputClass} />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={inputClass} />
        </>
      )}
    </div>
  );
}
