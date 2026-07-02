import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, loginLogs, exportLogs } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { handleApiError } from "@/lib/api-helpers";

// DELETE /api/admin/logs/:type/:id — delete a single log entry.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  try {
    await requireAdmin();
    const { type, id } = await params;

    switch (type) {
      case "audit":
        await db.delete(auditLogs).where(eq(auditLogs.id, id));
        break;
      case "login":
        await db.delete(loginLogs).where(eq(loginLogs.id, id));
        break;
      case "export":
        await db.delete(exportLogs).where(eq(exportLogs.id, id));
        break;
      default:
        return NextResponse.json({ error: "Unknown log type" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
