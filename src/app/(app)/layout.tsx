import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Nav from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex-1 flex flex-col">
      <Nav user={user} />
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
