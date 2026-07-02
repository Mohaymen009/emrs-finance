import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { incomeRecords, divisions, invoices } from "@/db/schema";
import { requireUser, assertDivisionAccess } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError } from "@/lib/api-helpers";
import { assertValidUpload, saveFileToPrivateStorage } from "@/lib/storage";

// POST /api/income/:id/invoice — optional invoice attachment for an income record.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Viewers cannot upload files" }, { status: 403 });
    }
    const { id } = await params;

    const [row] = await db
      .select({ record: incomeRecords, divisionCode: divisions.code, divisionId: divisions.id })
      .from(incomeRecords)
      .innerJoin(divisions, eq(incomeRecords.divisionId, divisions.id))
      .where(eq(incomeRecords.id, id))
      .limit(1);
    if (!row || row.record.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
    assertDivisionAccess(user, row.divisionCode);

    const form = await req.formData();
    const file = form.get("invoice");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No invoice file provided" }, { status: 400 });
    }
    assertValidUpload({ type: file.type, size: file.size });

    const buffer = Buffer.from(await file.arrayBuffer());
    const storageKey = await saveFileToPrivateStorage("invoices", file.name, buffer);

    const [invoice] = await db
      .insert(invoices)
      .values({
        incomeRecordId: id,
        fileName: file.name,
        storageKey,
        mimeType: file.type,
        sizeBytes: file.size,
      })
      .returning();

    await writeAuditLog({
      userId: user.id,
      action: "FILE_UPLOAD",
      recordId: id,
      divisionId: row.divisionId,
      metadata: { kind: "invoice", fileName: file.name },
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
