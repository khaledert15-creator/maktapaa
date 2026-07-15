import { pgTable, text, json, timestamp } from "drizzle-orm/pg-core";

// Session table for connect-pg-simple
export const userSessionsTable = pgTable("user_sessions", {
  sid: text("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6, withTimezone: false }).notNull(),
});
