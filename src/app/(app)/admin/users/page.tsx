import { redirect } from "next/navigation";
import { eq, desc, max } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users, userDivisionAccess, divisions, loginLogs } from "@/db/schema";
import UsersClient from "./UsersClient";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
  const allAccess = await db
    .select({ userId: userDivisionAccess.userId, code: divisions.code })
    .from(userDivisionAccess)
    .innerJoin(divisions, eq(userDivisionAccess.divisionId, divisions.id));
  const lastLogins = await db
    .select({ userId: loginLogs.userId, last: max(loginLogs.timestamp) })
    .from(loginLogs)
    .where(eq(loginLogs.event, "LOGIN_SUCCESS"))
    .groupBy(loginLogs.userId);

  const accessByUser = new Map<string, string[]>();
  for (const a of allAccess) {
    const arr = accessByUser.get(a.userId) ?? [];
    arr.push(a.code);
    accessByUser.set(a.userId, arr);
  }
  const lastLoginByUser = new Map(lastLogins.map((l) => [l.userId, l.last]));

  const initialUsers = allUsers.map((u) => ({
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    isActive: u.isActive,
    divisionCodes: accessByUser.get(u.id) ?? [],
    lastLoginAt: lastLoginByUser.get(u.id)?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  }));

  return <UsersClient initialUsers={initialUsers} currentUserId={user.id} />;
}
