import { getCurrentUser } from "@/lib/auth";
import { listIncomeForUser, divisionsForUser } from "@/lib/queries";
import IncomeClient from "./IncomeClient";

export default async function IncomePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [records, divisions] = await Promise.all([listIncomeForUser(user), divisionsForUser(user)]);

  return (
    <IncomeClient
      initialRecords={JSON.parse(JSON.stringify(records))}
      divisions={divisions.map((d) => ({ code: d.code, name: d.name }))}
      currentUserId={user.id}
      currentUserRole={user.role}
    />
  );
}
