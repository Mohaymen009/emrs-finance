import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, incomeRecords } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError } from "@/lib/api-helpers";
import { clientUpsertSchema } from "@/lib/validation";
import { getClientWithHistory } from "@/lib/clients";

// GET /api/clients/:id — the client plus their income history, scoped to
// the caller's divisions like every other read.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await getClientWithHistory(user, id);
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}

// PATCH /api/clients/:id — full-replace semantics: the edit form always
// sends every field, and a field left empty is stored as NULL (cleared).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Viewers cannot edit clients" }, { status: 403 });
    }
    const { id } = await params;
    const [existing] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const input = clientUpsertSchema.parse(await req.json());
    const [updated] = await db
      .update(clients)
      .set({
        name: input.name ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        companyName: input.companyName ?? null,
        trnNumber: input.trnNumber ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, id))
      .returning();

    await writeAuditLog({
      userId: user.id,
      action: "CLIENT_UPDATED",
      recordId: id,
      metadata: { name: updated.name, companyName: updated.companyName },
    });

    return NextResponse.json({ client: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/clients/:id — hard delete (clients carry no financial data of
// their own, unlike income/expense records, so there's no audit reason to
// soft-delete them). Blocked while any income record still references this
// client — deleting a client someone has invoiced would silently sever that
// record's client link, which is worse than just telling the admin to
// reassign/delete those records first.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Viewers cannot delete clients" }, { status: 403 });
    }
    const { id } = await params;
    const [existing] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(incomeRecords)
      .where(eq(incomeRecords.clientId, id));
    if (Number(count) > 0) {
      return NextResponse.json(
        {
          error: `This client has ${count} income record${Number(count) === 1 ? "" : "s"} attached and can't be deleted. Delete or reassign those records first.`,
        },
        { status: 409 }
      );
    }

    await db.delete(clients).where(eq(clients.id, id));

    await writeAuditLog({
      userId: user.id,
      action: "CLIENT_DELETED",
      recordId: id,
      metadata: { name: existing.name, companyName: existing.companyName },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
