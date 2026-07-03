"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge, ConfirmDialog, Modal } from "@/components/ui";

type UserRow = {
  id: string;
  username: string;
  fullName: string;
  role: "ADMIN" | "VIEWER" | "DISPATCHER";
  isActive: boolean;
  divisionCodes: string[];
  lastLoginAt: string | null;
  createdAt: string;
};

const DIVISIONS = [
  { code: "AMBULANCE", name: "Ambulance Services" },
  { code: "HOME_HEALTHCARE", name: "Home Healthcare Services" },
];

const inputClass =
  "w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-shadow";

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
  const [pendingDelete, setPendingDelete] = useState<UserRow | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "VIEWER" | "DISPATCHER">("VIEWER");
  const [divisionCodes, setDivisionCodes] = useState<string[]>([]);

  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

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

  async function confirmDelete() {
    if (!pendingDelete) return;
    const res = await fetch(`/api/admin/users/${pendingDelete.id}`, { method: "DELETE" });
    setPendingDelete(null);
    if (res.ok) router.refresh();
    else alert((await res.json()).error ?? "Failed to delete user");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <Button variant="primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ New User"}
        </Button>
      </div>

      <p className="text-sm text-gray-500 -mt-4">
        There is no self-service sign-up. Accounts are only created here by an Admin. Usernames and
        passwords are not case-sensitive.
      </p>

      {showForm && (
        <form
          onSubmit={createUser}
          className="bg-white border border-gray-200 rounded-2xl shadow-card p-5 space-y-4 animate-fade-slide-in"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">
                Username <span className="text-red-500">*</span>
              </label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Full name <span className="text-red-500">*</span>
              </label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Password (min 8 chars, letters + numbers) <span className="text-red-500">*</span>
            </label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputClass} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
            <div>
              <label className="block text-xs font-medium mb-1">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "VIEWER" | "DISPATCHER")} className={inputClass}>
                <option value="VIEWER">Viewer (read-only)</option>
                <option value="DISPATCHER">Dispatcher (own income/expenses only)</option>
                <option value="ADMIN">Admin (full access)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Department access</label>
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
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create User"}
          </Button>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-3 md:px-4 py-3">Username</th>
              <th className="px-3 md:px-4 py-3">Full name</th>
              <th className="px-3 md:px-4 py-3">Role</th>
              <th className="px-3 md:px-4 py-3">Departments</th>
              <th className="px-3 md:px-4 py-3">Status</th>
              <th className="px-3 md:px-4 py-3">Last login</th>
              <th className="px-3 md:px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {initialUsers.map((u) => (
              <tr key={u.id} className="border-t border-gray-100 odd:bg-white even:bg-gray-50/50 hover:bg-blue-50/60 transition-colors">
                <td className="px-3 md:px-4 py-3 font-mono text-xs">{u.username}</td>
                <td className="px-3 md:px-4 py-3">{u.fullName}</td>
                <td className="px-3 md:px-4 py-3">
                  <Badge color={u.role === "ADMIN" ? "blue" : u.role === "DISPATCHER" ? "amber" : "slate"}>{u.role}</Badge>
                </td>
                <td className="px-3 md:px-4 py-3 text-xs">{u.divisionCodes.join(", ") || "—"}</td>
                <td className="px-3 md:px-4 py-3">
                  <Badge color={u.isActive ? "green" : "slate"}>{u.isActive ? "Active" : "Deactivated"}</Badge>
                </td>
                <td className="px-3 md:px-4 py-3 text-xs">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}</td>
                <td className="px-3 md:px-4 py-3 whitespace-nowrap">
                  <Button variant="ghost" onClick={() => setEditingUser(u)} className="mr-3">
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => resetPassword(u)} className="mr-3">
                    Reset password
                  </Button>
                  <Button variant="ghost" onClick={() => toggleActive(u)} className="mr-3">
                    {u.isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                  {u.id !== currentUserId && (
                    <Button variant="dangerGhost" onClick={() => setPendingDelete(u)}>
                      Delete
                    </Button>
                  )}
                  {u.id === currentUserId && <span className="text-xs text-gray-400 ml-2">(you)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete user"
        message={
          pendingDelete
            ? `Permanently delete "${pendingDelete.username}"? This cannot be undone — their past records will remain but show as "Deleted user".`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(user.fullName);
  const [role, setRole] = useState<"ADMIN" | "VIEWER" | "DISPATCHER">(user.role);
  const [divisionCodes, setDivisionCodes] = useState<string[]>(user.divisionCodes);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDivision(code: string) {
    setDivisionCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, role, divisionCodes }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save changes");
        return;
      }
      onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit "${user.username}"`} maxWidth="max-w-md">
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1">Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "VIEWER" | "DISPATCHER")} className={inputClass}>
            <option value="VIEWER">Viewer (read-only)</option>
            <option value="DISPATCHER">Dispatcher (own income/expenses only)</option>
            <option value="ADMIN">Admin (full access)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Department access</label>
          <div className="flex gap-3 items-center">
            {DIVISIONS.map((d) => (
              <label key={d.code} className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={divisionCodes.includes(d.code)} onChange={() => toggleDivision(d.code)} />
                {d.name}
              </label>
            ))}
          </div>
          {divisionCodes.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">
              No departments selected — this user won&apos;t be able to see or create anything until at least one is checked.
            </p>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save Changes"}</Button>
        </div>
      </form>
    </Modal>
  );
}
