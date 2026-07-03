import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import InvoiceToolClient from "./InvoiceToolClient";

// Admin and Dispatcher only: generating invoices/quotations/receipts/SOAs is
// restricted to whoever can also create income/expense records. Viewers
// never see the nav link (see Nav.tsx) and are redirected if they hit the
// URL directly.
export default async function InvoiceToolPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "VIEWER") redirect("/dashboard");

  return <InvoiceToolClient />;
}
