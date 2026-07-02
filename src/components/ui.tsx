"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

// Shared visual primitives used across Income/Expenses/Users so the app has
// one consistent button/badge/dialog language instead of ad-hoc classNames
// repeated on every page.

const BUTTON_VARIANTS = {
  primary: "bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50",
  secondary: "border border-slate-300 text-slate-700 hover:bg-slate-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-slate-600 underline hover:text-slate-900",
  dangerGhost: "text-red-600 underline hover:text-red-700",
} as const;

// Exposed so non-<button> elements (e.g. an <a> download link) can match the
// same visual language without nesting a <button> inside an <a>, which is
// invalid HTML.
export function buttonClass(variant: keyof typeof BUTTON_VARIANTS = "primary", className = "") {
  const base =
    variant === "ghost" || variant === "dangerGhost"
      ? "text-xs transition-colors"
      : "text-sm rounded-md px-3 py-1.5 transition-colors active:scale-[0.98] inline-block";
  return `${base} ${BUTTON_VARIANTS[variant]} ${className}`;
}

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS;
}) {
  return (
    <button className={buttonClass(variant, className)} {...props}>
      {children}
    </button>
  );
}

const BADGE_COLORS = {
  green: { pill: "bg-green-100 text-green-700", dot: "bg-green-600" },
  amber: { pill: "bg-amber-100 text-amber-700", dot: "bg-amber-600" },
  blue: { pill: "bg-blue-100 text-blue-700", dot: "bg-blue-600" },
  slate: { pill: "bg-slate-200 text-slate-600", dot: "bg-slate-500" },
  red: { pill: "bg-red-100 text-red-700", dot: "bg-red-600" },
} as const;

export function Badge({
  color,
  children,
}: {
  color: keyof typeof BADGE_COLORS;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_COLORS[color].pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${BADGE_COLORS[color].dot}`} />
      {children}
    </span>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-scale-in">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 p-5 w-full max-w-sm mx-4 animate-fade-scale-in">
        <h2 className="text-sm font-semibold text-slate-900 mb-2">{title}</h2>
        <p className="text-sm text-slate-600 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
