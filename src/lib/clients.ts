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
  lastActivity: string | null;
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
    .groupBy(clients.id)
    .orderBy(desc(clients.createdAt));

  return rows.map((r) => ({
    client: r.client,
    recordCount: Number(r.recordCount),
    totalBilled: Number(r.totalBilled),
    totalVat: Number(r.totalVat),
    outstanding: Number(r.outstanding),
    lastActivity: r.lastActivity,
  }));
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
