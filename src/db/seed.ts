import "dotenv/config";
import { db, pool } from "./index";
import { divisions, users, userDivisionAccess } from "./schema";
import { hashPassword, normalizeUsername } from "../lib/auth";
import { eq } from "drizzle-orm";

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
