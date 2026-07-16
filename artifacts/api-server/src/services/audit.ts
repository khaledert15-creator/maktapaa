import type { Request } from "express";
import { auditLogsTable, db } from "@workspace/db";

type AuditInput = {
  action: string;
  entityType: string;
  entityId?: string | number | null;
  description: string;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
};

export async function writeAuditLog(req: Request, input: AuditInput): Promise<void> {
  await db.insert(auditLogsTable).values({
    employeeId: req.session.adminId ?? null,
    employeeName: null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId == null ? null : String(input.entityId),
    description: input.description,
    beforeData: input.beforeData ?? null,
    afterData: input.afterData ?? null,
    ipAddress: req.ip,
  });
}
