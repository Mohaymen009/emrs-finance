import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { editAccessRequests } from "@/db/schema";
import Nav from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const pendingEditRequests =
    user.role === "ADMIN"
      ? (await db.select().from(editAccessRequests).where(eq(editAccessRequests.status, "PENDING"))).length
      : 0;

  return (
    <div className="flex-1 flex flex-col">
      <Nav user={user} pendingEditRequests={pendingEditRequests} />
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
