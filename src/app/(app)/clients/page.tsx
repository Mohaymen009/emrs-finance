import { getCurrentUser } from "@/lib/auth";
import { listClientsWithStats } from "@/lib/clients";
import ClientsClient from "./ClientsClient";

export default async function ClientsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  // Dispatchers must search by name/phone to see any client data at all —
  // never pre-load the full roster into the page for them (that would leak
  // it into the page payload regardless of what the UI shows). See
  // ClientsClient's restrictedSearch mode and /api/clients/search-verified.
  const isDispatcher = user.role === "DISPATCHER";
  const rows = isDispatcher ? [] : await listClientsWithStats(user);

  return (
    <ClientsClient
      initialClients={JSON.parse(JSON.stringify(rows))}
      canEdit={user.role !== "VIEWER"}
      restrictedSearch={isDispatcher}
    />
  );
}
