import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-helpers";
import { searchClientsForDispatcher } from "@/lib/clients";

// GET /api/clients/search-verified?name=...&phone=...
//
// The only path a Dispatcher has to client data: unlike GET /api/clients
// (blocked for that role — see that route), this never returns anything
// without a genuine name/company or phone query. Phone matching is exact
// but format-flexible (a search for "055 123 1234" matches a client stored
// as "+971 55 123 1234"); name/company matching requires at least 50% of
// the typed text to be found in the record. See
// searchClientsForDispatcher in src/lib/clients.ts for the matching rules.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name") ?? undefined;
    const phone = searchParams.get("phone") ?? undefined;

    const hasNameQuery = !!name && name.trim().length >= 2;
    const hasPhoneQuery = !!phone && phone.replace(/\D/g, "").length >= 7;
    if (!hasNameQuery && !hasPhoneQuery) {
      return NextResponse.json(
        { error: "Enter a client name/company (2+ characters) or a phone number to search." },
        { status: 400 }
      );
    }

    const results = await searchClientsForDispatcher(user, { name, phone });
    return NextResponse.json({ clients: results });
  } catch (err) {
    return handleApiError(err);
  }
}
