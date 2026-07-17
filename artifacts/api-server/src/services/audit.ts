import type { Request } from "express";
import { auditLogsTable, db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type AuditInput = {
  action: string;
  entityType: string;
  entityId?: string | number | null;
  description: string;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
};

export async function writeAuditLog(req: Request, input: AuditInput): Promise<void> {
  const employeeId = req.session.adminId ?? null;
  const [employee] = employeeId
    ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, employeeId)).limit(1)
    : [];
  await db.insert(auditLogsTable).values({
    employeeId,
    employeeName: employee?.name ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId == null ? null : String(input.entityId),
    description: input.description,
    beforeData: input.beforeData ?? null,
    afterData: input.afterData ?? null,
    ipAddress: req.ip,
  });
}
