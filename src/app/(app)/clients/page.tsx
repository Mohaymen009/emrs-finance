import { getCurrentUser } from "@/lib/auth";
import { listClientsWithStats } from "@/lib/clients";
import ClientsClient from "./ClientsClient";

export default async function ClientsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const rows = await listClientsWithStats(user);

  return (
    <ClientsClient
      initialClients={JSON.parse(JSON.stringify(rows))}
      canEdit={user.role !== "VIEWER"}
    />
  );
}
