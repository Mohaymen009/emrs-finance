import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getClientWithHistory } from "@/lib/clients";
import ClientDetailClient from "./ClientDetailClient";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id } = await params;
  const result = await getClientWithHistory(user, id);
  if (!result) notFound();

  return (
    <ClientDetailClient
      initialClient={JSON.parse(JSON.stringify(result.client))}
      records={JSON.parse(JSON.stringify(result.records))}
      canEdit={user.role !== "VIEWER"}
    />
  );
}
