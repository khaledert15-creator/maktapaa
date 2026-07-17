import { db, pool, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "../lib/auth";

const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "مدير النظام";
if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) throw new Error("BOOTSTRAP_ADMIN_EMAIL is required");
if (!password || password.length < 12) throw new Error("BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters");

try {
  const [owner] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "owner")).limit(1);
  if (owner) throw new Error("An owner already exists; use the authorized employee management workflow instead");
  await db.insert(usersTable).values({ name, email, passwordHash: await hashPassword(password), role: "owner", permissions: [], isActive: true });
  process.stdout.write(`Owner account created for ${email}. The password was not logged. Remove bootstrap credentials from the environment now.\n`);
} finally { await pool.end(); }
