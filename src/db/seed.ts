import "dotenv/config";
import { db, pool } from "./index";
import { divisions, users, userDivisionAccess, incomeRecords, expenseRecords, clients } from "./schema";
import { hashPassword, normalizeUsername } from "../lib/auth";
import { and, eq, isNull, isNotNull, asc } from "drizzle-orm";

/**
 * Assigns a legacy-style reference number (refYear/refSeq) to any
 * income/expense rows that have neither that nor a refNumber — i.e. rows
 * created before reference numbers existed at all. Reference numbers are
 * now entered by the user at creation (see createIncomeSchema/
 * createExpenseSchema), so a row with refNumber set but no refYear/refSeq is
 * a normal new-style row, not a legacy one — this must NOT touch those.
 * Numbers are assigned in creation order, continuing from whatever's
 * already been numbered for that year, and this is safe to re-run: rows
 * that already have either kind of number are left untouched.
 */
async function backfillReferenceNumbers() {
  for (const table of [incomeRecords, expenseRecords] as const) {
    const unnumbered = await db
      .select()
      .from(table)
      .where(and(isNull(table.refYear), isNull(table.refNumber)))
      .orderBy(asc(table.createdAt));
    if (unnumbered.length === 0) continue;

    const numbered = await db.select({ refYear: table.refYear, refSeq: table.refSeq }).from(table).where(isNotNull(table.refYear));
    const maxSeqByYear = new Map<number, number>();
    for (const row of numbered) {
      if (row.refYear == null || row.refSeq == null) continue;
      maxSeqByYear.set(row.refYear, Math.max(maxSeqByYear.get(row.refYear) ?? 0, row.refSeq));
    }

    for (const row of unnumbered) {
      const year = new Date(row.createdAt).getFullYear();
      const nextSeq = (maxSeqByYear.get(year) ?? 0) + 1;
      maxSeqByYear.set(year, nextSeq);
      await db.update(table).set({ refYear: year, refSeq: nextSeq }).where(eq(table.id, row.id));
    }
    console.log(`Backfilled reference numbers for ${unnumbered.length} row(s) in ${table === incomeRecords ? "income_records" : "expense_records"}.`);
  }
}

/**
 * Historically every income record with client details inserted a fresh
 * clients row, so the same client can exist many times over. The income
 * routes now reuse an existing row when the details match exactly
 * (src/lib/clients.ts), and this backfill merges the duplicates that were
 * already created: income records are repointed at the earliest row with
 * identical details and the redundant rows are deleted. Idempotent — a
 * second run finds no duplicates and does nothing.
 */
async function mergeDuplicateClients() {
  const all = await db.select().from(clients).orderBy(asc(clients.createdAt));

  const identity = (c: (typeof all)[number]) =>
    JSON.stringify(
      [c.name, c.phone, c.email, c.companyName, c.trnNumber].map((v) => (v ?? "").trim().toLowerCase())
    );

  const groups = new Map<string, typeof all>();
  for (const c of all) {
    const key = identity(c);
    const group = groups.get(key);
    if (group) group.push(c);
    else groups.set(key, [c]);
  }

  let merged = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const [keeper, ...dupes] = group;
    for (const dupe of dupes) {
      await db.update(incomeRecords).set({ clientId: keeper.id }).where(eq(incomeRecords.clientId, dupe.id));
      await db.delete(clients).where(eq(clients.id, dupe.id));
      merged++;
    }
  }
  if (merged > 0) console.log(`Merged ${merged} duplicate client row(s).`);
}

async function main() {
  console.log("Seeding divisions...");
  const divisionSeed = [
    { code: "AMBULANCE" as const, name: "Ambulance Services" },
    { code: "HOME_HEALTHCARE" as const, name: "Home Healthcare Services" },
  ];

  const divisionRows = [];
  for (const d of divisionSeed) {
    const [existing] = await db.select().from(divisions).where(eq(divisions.code, d.code));
    if (existing) {
      divisionRows.push(existing);
      continue;
    }
    const [created] = await db.insert(divisions).values(d).returning();
    divisionRows.push(created);
  }

  // The master admin account. Username/password are both case-insensitive
  // (see src/lib/auth.ts) — "Noshaad" / "noshaad" / "NOSHAAD" are the same
  // account, as are any casing variants of the password.
  const adminUsername = normalizeUsername(process.env.SEED_ADMIN_USERNAME ?? "Noshaad");
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Noshaad123";

  const [existingAdmin] = await db.select().from(users).where(eq(users.username, adminUsername));
  let admin = existingAdmin;
  if (!admin) {
    console.log(`Creating master admin user "${adminUsername}"...`);
    const passwordHash = await hashPassword(adminPassword);
    const [created] = await db
      .insert(users)
      .values({
        username: adminUsername,
        fullName: "Noshaad",
        role: "ADMIN",
        passwordHash,
        createdById: null,
      })
      .returning();
    admin = created;

    for (const d of divisionRows) {
      await db.insert(userDivisionAccess).values({ userId: admin.id, divisionId: d.id });
    }
    console.log(`Master admin created. Username: ${adminUsername}  Password: ${adminPassword}`);
    console.log("IMPORTANT: change this password after first login (use the Users page, or re-run seed with new SEED_ADMIN_PASSWORD before first run).");
  } else {
    console.log("Master admin already exists, skipping.");
  }

  console.log("Backfilling reference numbers...");
  await backfillReferenceNumbers();

  console.log("Merging duplicate clients...");
  await mergeDuplicateClients();

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
