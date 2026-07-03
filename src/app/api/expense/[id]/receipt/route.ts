import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { expenseRecords, divisions, receipts } from "@/db/schema";
import { requireUser, assertDivisionAccess } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError } from "@/lib/api-helpers";
import { assertValidUpload, saveFileToPrivateStorage } from "@/lib/storage";
import { getEditWindowForRecord } from "@/lib/editWindow";

// POST /api/expense/:id/receipt — optional receipt attachment for an expense
// record, mirroring POST /api/income/:id/invoice. Multiple receipts can be
// attached to the same record over time.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role === "VIEWER") {
      return NextResponse.json({ error: "Viewers cannot upload files" }, { status: 403 });
    }
    const { id } = await params;

    const [row] = await db
      .select({ record: expenseRecords, divisionCode: divisions.code, divisionId: divisions.id })
      .from(expenseRecords)
      .innerJoin(divisions, eq(expenseRecords.divisionId, divisions.id))
      .where(eq(expenseRecords.id, id))
      .limit(1);
    if (!row || row.record.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Attaching a file is an edit-like action: same ownership+window gate as PATCH.
    if (user.role === "DISPATCHER") {
      if (row.record.createdById !== user.id) {
        return NextResponse.json({ error: "You can only attach files to your own records." }, { status: 403 });
      }
      const window = await getEditWindowForRecord("EXPENSE", id, row.record.createdAt);
      if (!window.editable) {
        return NextResponse.json({ error: "This record's edit window has expired. Request edit access from an admin." }, { status: 403 });
      }
    }
    assertDivisionAccess(user, row.divisionCode);

    const form = await req.formData();
    const file = form.get("receipt");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No receipt file provided" }, { status: 400 });
    }
    assertValidUpload({ type: file.type, size: file.size });

    const buffer = Buffer.from(await file.arrayBuffer());
    const storageKey = await saveFileToPrivateStorage("receipts", file.name, buffer);

    const [receipt] = await db
      .insert(receipts)
      .values({
        expenseRecordId: id,
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
      metadata: { kind: "receipt", fileName: file.name },
    });

    return NextResponse.json({ receipt }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
