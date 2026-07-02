"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type UserRow = {
  id: string;
  username: string;
  fullName: string;
  role: "ADMIN" | "VIEWER";
  isActive: boolean;
  divisionCodes: string[];
  lastLoginAt: string | null;
  createdAt: string;
};

const DIVISIONS = [
  { code: "AMBULANCE", name: "Ambulance Services" },
  { code: "HOME_HEALTHCARE", name: "Home Healthcare Services" },
];

export default function UsersClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "VIEWER">("VIEWER");
  const [divisionCodes, setDivisionCodes] = useState<string[]>([]);

  function toggleDivision(code: string) {
    setDivisionCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, fullName, role, divisionCodes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? data.details?.formErrors?.join(", ") ?? "Failed to create user");
        return;
      }
      setUsername("");
      setPassword("");
      setFullName("");
      setRole("VIEWER");
      setDivisionCodes([]);
      setShowForm(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(u: UserRow) {
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    if (res.ok) router.refresh();
    else alert((await res.json()).error ?? "Failed to update user");
  }

  async function resetPassword(u: UserRow) {
    const newPassword = window.prompt(`New password for "${u.username}" (min 8 chars, letters + numbers):`);
    if (!newPassword) return;
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    if (res.ok) alert("Password updated.");
    else alert((await res.json()).error ?? "Failed to reset password");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Users</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-sm bg-slate-900 text-white rounded-md px-3 py-1.5 hover:bg-slate-800"
        >
          {showForm ? "Cancel" : "+ New User"}
        </button>
      </div>

      <p className="text-sm text-slate-500 -mt-4">
        There is no self-service sign-up. Accounts are only created here by an Admin. Usernames and
        passwords are not case-sensitive.
      </p>

      {showForm && (
        <form onSubmit={createUser} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full border rounded-md px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Full name</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full border rounded-md px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Password (min 8 chars, letters + numbers)</label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full border rounded-md px-2 py-1.5 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "VIEWER")} className="w-full border rounded-md px-2 py-1.5 text-sm">
                <option value="VIEWER">Viewer (read-only)</option>
                <option value="ADMIN">Admin (full access)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Division access</label>
              <div className="flex gap-3 items-center h-full">
                {DIVISIONS.map((d) => (
                  <label key={d.code} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={divisionCodes.includes(d.code)} onChange={() => toggleDivision(d.code)} />
                    {d.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={submitting} className="bg-slate-900 text-white rounded-md px-4 py-2 text-sm disabled:opacity-50">
            {submitting ? "Creating..." : "Create User"}
          </button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Username</th>
              <th className="p-3">Full name</th>
              <th className="p-3">Role</th>
              <th className="p-3">Divisions</th>
              <th className="p-3">Status</th>
              <th className="p-3">Last login</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {initialUsers.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="p-3 font-mono text-xs">{u.username}</td>
                <td className="p-3">{u.fullName}</td>
                <td className="p-3">{u.role}</td>
                <td className="p-3 text-xs">{u.divisionCodes.join(", ") || "—"}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${u.isActive ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}>
                    {u.isActive ? "Active" : "Deactivated"}
                  </span>
                </td>
                <td className="p-3 text-xs">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}</td>
                <td className="p-3 whitespace-nowrap">
                  <button onClick={() => resetPassword(u)} className="text-xs text-slate-600 underline mr-3">
                    Reset password
                  </button>
                  <button onClick={() => toggleActive(u)} className="text-xs text-slate-600 underline">
                    {u.isActive ? "Deactivate" : "Reactivate"}
                  </button>
                  {u.id === currentUserId && <span className="text-xs text-slate-400 ml-2">(you)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
