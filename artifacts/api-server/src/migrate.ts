import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "@workspace/db";

const migrationsFolder = path.resolve(process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), "lib/db/drizzle"));

try {
  await migrate(db, { migrationsFolder });
  process.stdout.write(`Database migrations applied from ${migrationsFolder}\n`);
} finally {
  await pool.end();
}
