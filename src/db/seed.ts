import "dotenv/config";
import { db, pool } from "./index";
import { divisions, users, userDivisionAccess, incomeRecords, expenseRecords } from "./schema";
import { hashPassword, normalizeUsername } from "../lib/auth";
import { eq, isNull, isNotNull, asc } from "drizzle-orm";

/**
 * Assigns a reference number (refYear/refSeq) to any income/expense rows
 * that don't have one yet — either brand-new columns on an existing
 * database, or rows created before this feature existed. Numbers are
 * assigned in creation order, continuing from whatever's already been
 * numbered for that year, and this is safe to re-run: rows that already
 * have a number are left untouched.
 */
async function backfillReferenceNumbers() {
  for (const table of [incomeRecords, expenseRecords] as const) {
    const unnumbered = await db
      .select()
      .from(table)
      .where(isNull(table.refYear))
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
