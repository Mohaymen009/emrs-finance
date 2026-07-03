import { and, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clients, divisions, incomeRecords, payments } from "@/db/schema";
import type { SessionUser } from "@/lib/auth";

export type ClientDetails = {
  name?: string;
  phone?: string;
  email?: string;
  companyName?: string;
  trnNumber?: string;
};

function norm(v?: string | null): string | null {
  const t = v?.trim();
  return t ? t : null;
}

/**
 * Reuses an existing client row when the exact same contact details were
 * entered before, instead of inserting a duplicate for every income record.
 * Matching is on all five identity fields (name/phone/email/company/TRN),
 * nulls included — so "same company, different phone" is deliberately kept
 * as a separate row rather than silently overwriting anyone's data. This is
 * what makes the Clients page's per-client history/aggregates meaningful.
 */
export async function findOrCreateClient(details: ClientDetails): Promise<string> {
  const values = {
    name: norm(details.name),
    phone: norm(details.phone),
    email: norm(details.email),
    companyName: norm(details.companyName),
    trnNumber: norm(details.trnNumber),
  };

  const fieldConditions: SQL[] = [
    values.name === null ? isNull(clients.name) : eq(clients.name, values.name),
    values.phone === null ? isNull(clients.phone) : eq(clients.phone, values.phone),
    values.email === null ? isNull(clients.email) : eq(clients.email, values.email),
    values.companyName === null ? isNull(clients.companyName) : eq(clients.companyName, values.companyName),
    values.trnNumber === null ? isNull(clients.trnNumber) : eq(clients.trnNumber, values.trnNumber),
  ];

  const [existing] = await db.select().from(clients).where(and(...fieldConditions)).limit(1);
  if (existing) return existing.id;

  const [created] = await db.insert(clients).values(values).returning();
  return created.id;
}

/** Resolves the division ids the user has been granted access to. */
export async function allowedDivisionIds(user: SessionUser): Promise<string[]> {
  const all = await db.select().from(divisions);
  return all.filter((d) => user.divisionCodes.includes(d.code)).map((d) => d.id);
}

export type ClientListRow = {
  client: typeof clients.$inferSelect;
  recordCount: number;
  totalBilled: number;
  totalVat: number;
  outstanding: number;
  // Most recent service performed for the client (income service date).
  lastActivity: string | null;
  // Most recent time the client actually paid us (payment date).
  lastPayment: string | null;
};

/**
 * Every client with income aggregates restricted to the divisions the user
 * can see. Clients with no visible records still appear (with zeroes) so a
 * freshly added client isn't invisible until their first invoice.
 */
export async function listClientsWithStats(user: SessionUser): Promise<ClientListRow[]> {
  const divisionIds = await allowedDivisionIds(user);
  if (divisionIds.length === 0) return [];

  const rows = await db
    .select({
      client: clients,
      recordCount: sql<number>`count(${incomeRecords.id})`,
      totalBilled: sql<string>`coalesce(sum(${incomeRecords.amount}), 0)`,
      totalVat: sql<string>`coalesce(sum(${incomeRecords.vatAmount}), 0)`,
      outstanding: sql<string>`coalesce(sum(case when ${incomeRecords.paymentStatus} = 'UNPAID' then ${incomeRecords.amount} else 0 end), 0)`,
      lastActivity: sql<string | null>`max(${incomeRecords.date})`,
      lastPayment: sql<string | null>`max(${payments.paymentDate})`,
    })
    .from(clients)
    .leftJoin(
      incomeRecords,
      and(
        eq(incomeRecords.clientId, clients.id),
        isNull(incomeRecords.deletedAt),
        inArray(incomeRecords.divisionId, divisionIds)
      )
    )
    // 1:1 — payments.incomeRecordId is unique, so this can't fan out rows.
    .leftJoin(payments, eq(payments.incomeRecordId, incomeRecords.id))
    .groupBy(clients.id)
    .orderBy(desc(clients.createdAt));

  return rows.map((r) => ({
    client: r.client,
    recordCount: Number(r.recordCount),
    totalBilled: Number(r.totalBilled),
    totalVat: Number(r.totalVat),
    outstanding: Number(r.outstanding),
    lastActivity: r.lastActivity,
    lastPayment: r.lastPayment,
  }));
}

// ---------------------------------------------------------------------------
// DISPATCHER "VERIFIED SEARCH" — client data is only ever surfaced to a
// Dispatcher in response to a specific name/phone query (see
// src/app/api/clients/search-verified/route.ts); there is no "browse
// everyone" view for that role, unlike Admin/Viewer's full list above.
// ---------------------------------------------------------------------------

/** Digits only — strips spaces, dashes, parens, and any "+" prefix. */
function normalizePhoneDigits(v: string): string {
  return v.replace(/\D/g, "");
}

/**
 * True if two phone numbers are "the same number" regardless of how the
 * country/trunk prefix was written — e.g. "055 123 1234" vs
 * "+971 55 123 1234" both reduce to the same trailing 9 digits. Requires at
 * least 7 digits of genuine overlap so short fragments can't false-match.
 */
export function phoneNumbersMatch(a: string, b: string): boolean {
  const da = normalizePhoneDigits(a);
  const db_ = normalizePhoneDigits(b);
  if (!da || !db_) return false;
  const len = Math.min(da.length, db_.length, 9);
  if (len < 7) return false;
  return da.slice(-len) === db_.slice(-len);
}

function bigrams(s: string): string[] {
  const clean = s.toLowerCase().trim().replace(/\s+/g, " ");
  if (clean.length < 2) return clean ? [clean] : [];
  const grams: string[] = [];
  for (let i = 0; i < clean.length - 1; i++) grams.push(clean.slice(i, i + 2));
  return grams;
}

/**
 * What fraction of the typed query is found in the target string — 1.0 if
 * the query appears verbatim (e.g. a first name typed against a much longer
 * company name), otherwise a bigram-overlap ratio that also tolerates minor
 * typos/reordering. Directional on purpose: a short query against a long
 * target should still score well if fully contained, which a plain
 * symmetric similarity score would unfairly penalize.
 */
export function queryMatchRatio(query: string, target: string): number {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();
  if (!q) return 0;
  if (t.includes(q)) return 1;

  const qGrams = bigrams(q);
  if (qGrams.length === 0) return 0;
  const tGrams = new Set(bigrams(t));
  let found = 0;
  for (const g of qGrams) if (tGrams.has(g)) found++;
  return found / qGrams.length;
}

const NAME_MATCH_THRESHOLD = 0.5;

/**
 * The only way a Dispatcher can retrieve client data: requires a genuine
 * name/company query (>=2 chars) or phone query (>=7 significant digits),
 * matches phone numbers exactly regardless of formatting, and matches
 * name/company by requiring at least 50% of the typed text to be found in
 * the record. Returns [] (never throws) if neither input clears its bar, so
 * callers must treat an empty query as "no results", not "list everything".
 */
export async function searchClientsForDispatcher(
  user: SessionUser,
  query: { name?: string; phone?: string }
): Promise<ClientListRow[]> {
  const name = query.name?.trim() ?? "";
  const phoneDigits = query.phone ? normalizePhoneDigits(query.phone) : "";
  const hasNameQuery = name.length >= 2;
  const hasPhoneQuery = phoneDigits.length >= 7;
  if (!hasNameQuery && !hasPhoneQuery) return [];

  const all = await listClientsWithStats(user);
  return all.filter((row) => {
    if (hasPhoneQuery && row.client.phone && phoneNumbersMatch(row.client.phone, query.phone!)) {
      return true;
    }
    if (hasNameQuery) {
      const nameScore = row.client.name ? queryMatchRatio(name, row.client.name) : 0;
      const companyScore = row.client.companyName ? queryMatchRatio(name, row.client.companyName) : 0;
      if (Math.max(nameScore, companyScore) >= NAME_MATCH_THRESHOLD) return true;
    }
    return false;
  });
}

/**
 * A single client plus their income history (division-scoped like every
 * other read in the system). Returns null when the client doesn't exist.
 */
export async function getClientWithHistory(user: SessionUser, clientId: string) {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) return null;

  const divisionIds = await allowedDivisionIds(user);
  const records =
    divisionIds.length === 0
      ? []
      : await db
          .select({
            record: incomeRecords,
            divisionCode: divisions.code,
            divisionName: divisions.name,
            payment: payments,
          })
          .from(incomeRecords)
          .innerJoin(divisions, eq(incomeRecords.divisionId, divisions.id))
          .leftJoin(payments, eq(payments.incomeRecordId, incomeRecords.id))
          .where(
            and(
              eq(incomeRecords.clientId, clientId),
              isNull(incomeRecords.deletedAt),
              inArray(incomeRecords.divisionId, divisionIds)
            )
          )
          .orderBy(desc(incomeRecords.date));

  return { client, records };
}
