"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/auth";

export default function Nav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/income", label: "Income" },
    { href: "/expenses", label: "Expenses" },
    ...(user.role === "ADMIN"
      ? [
          { href: "/admin/users", label: "Users" },
          { href: "/admin/logs", label: "System Logs" },
        ]
      : []),
  ];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-sm">EMRS Finance</span>
          <nav className="flex gap-4">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm ${
                  pathname?.startsWith(l.href) ? "text-slate-900 font-medium" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>
            {user.fullName} <span className="text-xs uppercase text-slate-400">({user.role})</span>
          </span>
          <button onClick={logout} className="text-slate-500 hover:text-slate-900 underline underline-offset-2">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
