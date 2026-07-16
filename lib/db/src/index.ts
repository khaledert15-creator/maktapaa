import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const readPositiveInteger = (name: string, fallback: number): number => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
};

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: readPositiveInteger("DB_POOL_MAX", 20),
  idleTimeoutMillis: readPositiveInteger("DB_IDLE_TIMEOUT_MS", 30_000),
  connectionTimeoutMillis: readPositiveInteger("DB_CONNECTION_TIMEOUT_MS", 5_000),
  statement_timeout: readPositiveInteger("DB_STATEMENT_TIMEOUT_MS", 15_000),
  application_name: process.env.DB_APPLICATION_NAME ?? "maktaba-api",
});
export const db = drizzle(pool, { schema });

export * from "./schema";
