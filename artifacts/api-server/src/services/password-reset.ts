import { createHash, randomBytes } from "node:crypto";
import { auditLogsTable, customersTable, db, passwordResetTokensTable, userSessionsTable } from "@workspace/db";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { hashPassword } from "../lib/auth";
import { mailAdapter } from "./email";
import { logger } from "../lib/logger";

export const PASSWORD_RESET_TTL_MS = 30 * 60_000;
export const genericResetResponse = "إذا كان البريد مسجلاً فستصلك رسالة تحتوي على خطوات إعادة تعيين كلمة المرور.";

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.email, normalizedEmail));
  if (!customer || customer.isBlocked || !customer.email) return;

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(token);
  await db.transaction(async tx => {
    await tx.update(passwordResetTokensTable).set({ usedAt: new Date() }).where(and(eq(passwordResetTokensTable.customerId, customer.id), isNull(passwordResetTokensTable.usedAt)));
    await tx.insert(passwordResetTokensTable).values({ customerId: customer.id, tokenHash, expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS) });
  });
  try {
    await mailAdapter.sendPasswordReset({ email: customer.email, customerName: customer.name, token });
  } catch (error) {
    logger.error({ err: error, customerId: customer.id }, "Password reset email delivery failed");
  }
}

export async function validateResetToken(token: string): Promise<boolean> {
  const [row] = await db.select({ id: passwordResetTokensTable.id }).from(passwordResetTokensTable).where(and(
    eq(passwordResetTokensTable.tokenHash, hashResetToken(token)),
    isNull(passwordResetTokensTable.usedAt),
    gt(passwordResetTokensTable.expiresAt, new Date()),
  ));
  return Boolean(row);
}

export class PasswordResetError extends Error {
  constructor(message = "رابط إعادة تعيين كلمة المرور غير صالح أو انتهت صلاحيته") {
    super(message);
    this.name = "PasswordResetError";
  }
}

export async function resetPassword(input: { token: string; password: string; ipAddress?: string | null }): Promise<void> {
  const tokenHash = hashResetToken(input.token);
  await db.transaction(async tx => {
    const [resetToken] = await tx.select().from(passwordResetTokensTable).where(eq(passwordResetTokensTable.tokenHash, tokenHash)).for("update");
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) throw new PasswordResetError();
    const [customer] = await tx.select().from(customersTable).where(eq(customersTable.id, resetToken.customerId)).for("update");
    if (!customer || customer.isBlocked) throw new PasswordResetError();

    await tx.update(customersTable).set({ passwordHash: await hashPassword(input.password), updatedAt: new Date() }).where(eq(customersTable.id, customer.id));
    await tx.update(passwordResetTokensTable).set({ usedAt: new Date() }).where(eq(passwordResetTokensTable.id, resetToken.id));
    await tx.update(passwordResetTokensTable).set({ usedAt: new Date() }).where(and(eq(passwordResetTokensTable.customerId, customer.id), isNull(passwordResetTokensTable.usedAt)));
    await tx.delete(userSessionsTable).where(sql`${userSessionsTable.sess}->>'customerId' = ${String(customer.id)}`);
    await tx.insert(auditLogsTable).values({
      action: "customer.password_reset", entityType: "customer", entityId: String(customer.id),
      description: "إعادة تعيين كلمة مرور العميل وإبطال الجلسات", ipAddress: input.ipAddress ?? null,
    });
  });
}
