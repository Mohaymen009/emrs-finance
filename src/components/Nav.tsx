"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/auth";
import { IconMenu, IconX } from "@/components/ui";

export default function Nav({ user, pendingEditRequests = 0 }: { user: SessionUser; pendingEditRequests?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    // Dispatchers get no visibility into company-wide financial reporting.
    ...(user.role !== "DISPATCHER" ? [{ href: "/dashboard", label: "Dashboard" }] : []),
    { href: "/income", label: "Income" },
    { href: "/expenses", label: "Expenses" },
    { href: "/clients", label: "Clients" },
    ...(user.role === "ADMIN" || user.role === "DISPATCHER"
      ? [{ href: "/invoice-tool", label: "Invoice Tool" }]
      : []),
    ...(user.role === "ADMIN"
      ? [
          { href: "/admin/users", label: "Users" },
          { href: "/admin/logs", label: "System Logs" },
          {
            href: "/admin/edit-requests",
            label: pendingEditRequests > 0 ? `Edit Requests (${pendingEditRequests})` : "Edit Requests",
          },
        ]
      : []),
  ];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-sm">EMRS Finance</span>
          <nav className="hidden md:flex gap-1">
            {links.map((l) => {
              const active = pathname?.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                    active ? "text-indigo-700 bg-indigo-50 font-medium" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="hidden md:flex items-center gap-3 text-sm text-slate-500">
          <span>
            {user.fullName} <span className="text-xs uppercase text-slate-400">({user.role})</span>
          </span>
          <button onClick={logout} className="text-slate-500 hover:text-slate-900 underline underline-offset-2 transition-colors">
            Sign out
          </button>
        </div>

        <button
          onClick={() => setMobileOpen((s) => !s)}
          aria-label="Toggle menu"
          className="md:hidden text-slate-600 hover:text-slate-900 transition-colors"
        >
          {mobileOpen ? <IconX /> : <IconMenu />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-slate-100 px-4 py-3 space-y-1 animate-fade-slide-in">
          {links.map((l) => {
            const active = pathname?.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className={`block text-sm px-3 py-2 rounded-lg transition-colors ${
                  active ? "text-indigo-700 bg-indigo-50 font-medium" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <div className="border-t border-slate-100 mt-2 pt-2 flex items-center justify-between px-3">
            <span className="text-sm text-slate-500">
              {user.fullName} <span className="text-xs uppercase text-slate-400">({user.role})</span>
            </span>
            <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-900 underline underline-offset-2">
              Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
