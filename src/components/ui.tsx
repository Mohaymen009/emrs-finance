"use client";

import { ButtonHTMLAttributes, ReactNode, useEffect } from "react";

// Shared visual primitives used across Income/Expenses/Users so the app has
// one consistent button/badge/dialog/icon language instead of ad-hoc
// classNames repeated on every page. No icon library dependency (Dockerfile
// uses `npm ci`, which needs an exact package-lock.json match we can't
// regenerate here) — icons are small hand-rolled inline SVGs instead.

const BUTTON_VARIANTS = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50",
  secondary: "border border-slate-300 text-slate-700 hover:bg-slate-50",
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
      : "text-sm rounded-lg px-3 py-1.5 transition-colors active:scale-[0.98] inline-block";
  return `${base} ${BUTTON_VARIANTS[variant]} ${className}`;
}

// Styles a native <input type="file"> so its "Choose file" control renders
// as a proper button (via the file: pseudo-element) instead of bare text —
// the rest of the control (filename preview) is left to the browser.
export const fileInputClass =
  "block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 file:transition-colors file:cursor-pointer cursor-pointer";

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

/** Generic overlay + card. Escape or backdrop click both close it. */
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto animate-fade-scale-in"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl border border-slate-200 w-full ${maxWidth} my-8 animate-fade-scale-in`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 transition-colors">
              <IconX className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
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
  return (
    <Modal open={open} onClose={onCancel} title={title} maxWidth="max-w-sm">
      <p className="text-sm text-slate-600 mb-5">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

// --- Icons -------------------------------------------------------------
// Small hand-rolled stroke icons (no external icon library — see note above).

type IconProps = { className?: string };

export function IconMenu({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export function IconX({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function IconSearch({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function IconEdit({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function IconTrash({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

export function IconPaperclip({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21.44 11.05l-9.19 9.19a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.48" />
    </svg>
  );
}

export function IconPlus({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
