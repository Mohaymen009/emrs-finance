import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices, receipts, incomeRecords, expenseRecords, divisions } from "@/db/schema";
import { requireUser, assertDivisionAccess } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError } from "@/lib/api-helpers";
import { readFileFromPrivateStorage } from "@/lib/storage";

/**
 * The ONLY way to retrieve an invoice or receipt. Files are stored in
 * secure-storage/ (never under public/) and are only ever streamed back
 * through this authenticated, division-scoped route — there is no public
 * URL that bypasses this check.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> }
) {
  try {
    const user = await requireUser();
    const { kind, id } = await params;

    if (kind !== "invoice" && kind !== "receipt") {
      return NextResponse.json({ error: "Unknown file kind" }, { status: 400 });
    }

    let storageKey: string;
    let fileName: string;
    let mimeType: string;
    let divisionCode: "AMBULANCE" | "HOME_HEALTHCARE";
    let recordId: string;
    let divisionId: string;

    if (kind === "invoice") {
      const [row] = await db
        .select({ file: invoices, divisionCode: divisions.code, divisionId: divisions.id, recordId: incomeRecords.id })
        .from(invoices)
        .innerJoin(incomeRecords, eq(invoices.incomeRecordId, incomeRecords.id))
        .innerJoin(divisions, eq(incomeRecords.divisionId, divisions.id))
        .where(eq(invoices.id, id))
        .limit(1);
      if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
      storageKey = row.file.storageKey;
      fileName = row.file.fileName;
      mimeType = row.file.mimeType;
      divisionCode = row.divisionCode;
      recordId = row.recordId;
      divisionId = row.divisionId;
    } else {
      const [row] = await db
        .select({ file: receipts, divisionCode: divisions.code, divisionId: divisions.id, recordId: expenseRecords.id })
        .from(receipts)
        .innerJoin(expenseRecords, eq(receipts.expenseRecordId, expenseRecords.id))
        .innerJoin(divisions, eq(expenseRecords.divisionId, divisions.id))
        .where(eq(receipts.id, id))
        .limit(1);
      if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
      storageKey = row.file.storageKey;
      fileName = row.file.fileName;
      mimeType = row.file.mimeType;
      divisionCode = row.divisionCode;
      recordId = row.recordId;
      divisionId = row.divisionId;
    }

    assertDivisionAccess(user, divisionCode);

    const buffer = await readFileFromPrivateStorage(storageKey);

    await writeAuditLog({
      userId: user.id,
      action: "FILE_DOWNLOAD",
      recordId,
      divisionId,
      metadata: { kind, fileName },
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
