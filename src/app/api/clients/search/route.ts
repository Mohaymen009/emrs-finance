import { NextRequest, NextResponse } from "next/server";
import { ilike, or, desc } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-helpers";

// GET /api/clients/search?q=... — looks up previously-entered clients by
// company name or client name so the income form can offer to reuse their
// saved details instead of retyping them. Read-only, any logged-in user.
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const q = new URL(req.url).searchParams.get("q")?.trim();
    if (!q || q.length < 2) return NextResponse.json({ clients: [] });

    const rows = await db
      .select()
      .from(clients)
      .where(or(ilike(clients.companyName, `%${q}%`), ilike(clients.name, `%${q}%`)))
      .orderBy(desc(clients.createdAt))
      .limit(5);

    return NextResponse.json({ clients: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
