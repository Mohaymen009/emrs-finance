import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, loginLogs, exportLogs } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { handleApiError } from "@/lib/api-helpers";

// DELETE /api/admin/logs/:type — clear every entry of this log type
// (audit | login | export). No schema changes involved — these are
// permanent deletes on already-existing tables.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  try {
    await requireAdmin();
    const { type } = await params;

    switch (type) {
      case "audit":
        await db.delete(auditLogs);
        break;
      case "login":
        await db.delete(loginLogs);
        break;
      case "export":
        await db.delete(exportLogs);
        break;
      default:
        return NextResponse.json({ error: "Unknown log type" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
