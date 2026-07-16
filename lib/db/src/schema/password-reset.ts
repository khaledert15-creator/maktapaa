import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const passwordResetTokensTable = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("password_reset_tokens_hash_unique").on(table.tokenHash),
  index("password_reset_tokens_customer_created_idx").on(table.customerId, table.createdAt),
  index("password_reset_tokens_expires_idx").on(table.expiresAt),
]);

export type PasswordResetToken = typeof passwordResetTokensTable.$inferSelect;
