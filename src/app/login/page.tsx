"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm shadow-xs placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-600/15 transition-[border-color,box-shadow] duration-150";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      // Dispatchers have no dashboard access — send them straight to Income
      // instead of bouncing through the redirect there.
      router.push(data.user?.role === "DISPATCHER" ? "/income" : "/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm animate-page-enter">
        <div className="flex justify-center mb-6">
          <img src="/logo.webp" alt="EMRS Star of Life" className="w-14 h-14 object-contain" />
        </div>
        <div className="bg-white border border-gray-200/80 rounded-2xl shadow-pop p-8">
          <h1 className="text-xl font-semibold tracking-tight mb-1">Welcome back</h1>
          <p className="text-sm text-gray-500 mb-6">Sign in to your EMRS Finance workspace</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
              <input
                className={inputClass}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium shadow-sm shadow-blue-600/25 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/25 active:scale-[0.99] disabled:opacity-50 disabled:shadow-none transition-all duration-150"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">EMRS Finance Platform</p>
      </div>
    </div>
  );
}
