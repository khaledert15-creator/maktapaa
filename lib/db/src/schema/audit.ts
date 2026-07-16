import { pgTable, text, serial, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id"),
  employeeName: text("employee_name"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  description: text("description").notNull(),
  beforeData: jsonb("before_data").$type<Record<string, unknown>>(),
  afterData: jsonb("after_data").$type<Record<string, unknown>>(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("audit_logs_created_idx").on(table.createdAt),
  index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  index("audit_logs_employee_created_idx").on(table.employeeId, table.createdAt),
]);

export type AuditLog = typeof auditLogsTable.$inferSelect;
