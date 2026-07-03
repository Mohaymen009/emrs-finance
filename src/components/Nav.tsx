"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Receipt,
  Users,
  FileText,
  UserCog,
  ScrollText,
  ClipboardCheck,
  LogOut,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { IconMenu, IconX } from "@/components/ui";

// Icon per route — purely presentational, the links themselves are unchanged.
const LINK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/dashboard": LayoutDashboard,
  "/income": TrendingUp,
  "/expenses": Receipt,
  "/clients": Users,
  "/invoice-tool": FileText,
  "/admin/users": UserCog,
  "/admin/logs": ScrollText,
  "/admin/edit-requests": ClipboardCheck,
};

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
  ];
  const adminLinks =
    user.role === "ADMIN"
      ? [
          { href: "/admin/users", label: "Users" },
          { href: "/admin/logs", label: "System Logs" },
          { href: "/admin/edit-requests", label: "Edit Requests" },
        ]
      : [];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const initials = user.fullName
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function SidebarLink({ href, label }: { href: string; label: string }) {
    const active = pathname?.startsWith(href);
    const Icon = LINK_ICONS[href];
    const showBadge = href === "/admin/edit-requests" && pendingEditRequests > 0;
    return (
      <Link
        href={href}
        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
          active
            ? "bg-white/[0.08] text-white font-medium shadow-[inset_0_1px_0_rgb(255_255_255/0.04),0_0_20px_rgb(37_99_235/0.12)]"
            : "text-gray-400 hover:text-gray-100 hover:bg-white/[0.04]"
        }`}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgb(59_130_246/0.8)]" />
        )}
        {Icon && (
          <Icon
            className={`w-[18px] h-[18px] shrink-0 transition-colors ${
              active ? "text-blue-400" : "text-gray-500 group-hover:text-gray-300"
            }`}
          />
        )}
        <span className="truncate">{label}</span>
        {showBadge && (
          <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-semibold tabular-nums">
            {pendingEditRequests}
          </span>
        )}
      </Link>
    );
  }

  return (
    <>
      {/* Desktop: fixed dark sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-60 flex-col bg-gray-950/[0.97] backdrop-blur border-r border-white/[0.06]">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/[0.06]">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-white text-sm font-bold shadow-[0_2px_8px_rgb(37_99_235/0.4)]">
            E
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-white tracking-tight">EMRS Finance</span>
            <span className="block text-[11px] text-gray-500">Finance Platform</span>
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-600">Workspace</p>
          {links.map((l) => (
            <SidebarLink key={l.href} {...l} />
          ))}
          {adminLinks.length > 0 && (
            <>
              <p className="px-3 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
                Administration
              </p>
              {adminLinks.map((l) => (
                <SidebarLink key={l.href} {...l} />
              ))}
            </>
          )}
        </nav>

        <div className="px-3 py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <span className="flex items-center justify-center w-8 h-8 shrink-0 rounded-full bg-white/[0.08] text-gray-200 text-xs font-semibold">
              {initials}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block text-sm text-gray-200 font-medium truncate">{user.fullName}</span>
              <span className="block text-[11px] uppercase tracking-wide text-gray-500">{user.role}</span>
            </span>
            <button
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
              className="ml-auto p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile: top bar + slide-down menu */}
      <header className="md:hidden border-b border-gray-200 bg-white/90 backdrop-blur sticky top-0 z-40">
        <div className="px-4 h-14 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-white text-xs font-bold">
              E
            </span>
            <span className="font-semibold text-sm tracking-tight">EMRS Finance</span>
          </span>
          <button
            onClick={() => setMobileOpen((s) => !s)}
            aria-label="Toggle menu"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            {mobileOpen ? <IconX /> : <IconMenu />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-gray-100 px-4 py-3 space-y-1 animate-fade-slide-in">
            {[...links, ...adminLinks].map((l) => {
              const active = pathname?.startsWith(l.href);
              const showCount = l.href === "/admin/edit-requests" && pendingEditRequests > 0;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block text-sm px-3 py-2 rounded-lg transition-colors ${
                    active ? "text-blue-700 bg-blue-50 font-medium" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {showCount ? `${l.label} (${pendingEditRequests})` : l.label}
                </Link>
              );
            })}
            <div className="border-t border-gray-100 mt-2 pt-2 flex items-center justify-between px-3">
              <span className="text-sm text-gray-500">
                {user.fullName} <span className="text-xs uppercase text-gray-400">({user.role})</span>
              </span>
              <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-900 underline underline-offset-2">
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
