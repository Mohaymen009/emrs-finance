"use client";

import { useState, type ReactNode } from "react";

export function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 mb-3 group"
        aria-expanded={open}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <h2 className="text-sm font-semibold text-slate-500 uppercase group-hover:text-slate-700 transition-colors">
          {title}
          {count !== undefined && <span className="text-slate-400 normal-case font-normal"> ({count})</span>}
        </h2>
      </button>
      {open && children}
    </section>
  );
}
