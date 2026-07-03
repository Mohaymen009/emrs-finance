import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError } from "@/lib/api-helpers";
import { clientUpsertSchema } from "@/lib/validation";
import { listClientsWithStats } from "@/lib/clients";

// GET /api/clients — every client with income aggregates (count, billed,
// outstanding, last activity), restricted to the caller's divisions.
// Dispatchers never get this: for that role, client data is only ever
// surfaced in response to a specific name/phone query — see
// GET /api/clients/search-verified.
export async function GET() {
  try {
    const user = await requireUser();
    if (user.role === "DISPATCHER") {
      return NextResponse.json(
        { error: "Search by client name or phone number to look up a client." },
        { status: 403 }
      );
    }
    const rows = await listClientsWithStats(user);
    return NextResponse.json({ clients: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/clients — create a standalone client from the Clients page
// (income records can still create clients implicitly via their own form).
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role === "VIEWER") {
      return NextResponse.json({ error: "Viewers cannot create clients" }, { status: 403 });
    }

    const input = clientUpsertSchema.parse(await req.json());
    const [created] = await db.insert(clients).values(input).returning();

    await writeAuditLog({
      userId: user.id,
      action: "CLIENT_CREATED",
      recordId: created.id,
      metadata: { name: created.name, companyName: created.companyName },
    });

    return NextResponse.json({ client: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
