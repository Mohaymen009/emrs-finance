import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { editAccessRequests } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { editRequestActionSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api-helpers";

// PATCH /api/admin/edit-requests/:id — Admin approves or denies a
// Dispatcher's request for a fresh edit window. Approval does NOT start the
// 15 minutes ticking yet — that happens lazily the next time the dispatcher
// visits the record (see activatePendingGrants in src/lib/editWindow.ts).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const [existing] = await db.select().from(editAccessRequests).where(eq(editAccessRequests.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.status !== "PENDING") {
      return NextResponse.json({ error: "This request has already been resolved." }, { status: 409 });
    }

    const { action } = editRequestActionSchema.parse(await req.json());
    const status = action === "APPROVE" ? "APPROVED" : "DENIED";

    const [updated] = await db
      .update(editAccessRequests)
      .set({ status, resolvedById: admin.id, resolvedAt: new Date() })
      .where(eq(editAccessRequests.id, id))
      .returning();

    await writeAuditLog({
      userId: admin.id,
      action: action === "APPROVE" ? "EDIT_ACCESS_GRANTED" : "EDIT_ACCESS_DENIED",
      recordId: existing.recordId,
      metadata: { recordType: existing.recordType, requestedById: existing.requestedById },
    });

    return NextResponse.json({ request: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
