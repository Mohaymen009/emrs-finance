import { getCurrentUser } from "@/lib/auth";
import { listExpensesForUser, divisionsForUser } from "@/lib/queries";
import ExpenseClient from "./ExpenseClient";

export default async function ExpensesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [records, divisions] = await Promise.all([listExpensesForUser(user), divisionsForUser(user)]);

  return (
    <ExpenseClient
      initialRecords={JSON.parse(JSON.stringify(records))}
      divisions={divisions.map((d) => ({ code: d.code, name: d.name }))}
      canEdit={user.role === "ADMIN"}
    />
  );
}
