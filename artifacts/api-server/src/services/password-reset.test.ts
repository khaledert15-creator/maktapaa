import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { auditLogsTable, customersTable, db, passwordResetTokensTable, pool, userSessionsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { PasswordResetError, genericResetResponse, hashResetToken, resetPassword, validateResetToken } from "./password-reset";
import { verifyPassword } from "../lib/auth";

after(() => pool.end());

test("password reset token is hashed, expires, is single-use, invalidates sessions and writes an audit log", async () => {
  const suffix = randomUUID();
  const token = `${randomUUID()}${randomUUID()}`;
  const expiredToken = `${randomUUID()}${randomUUID()}`;
  const [customer] = await db.insert(customersTable).values({ name: "عميل استعادة", email: `reset-${suffix}@example.com`, primaryPhone: `01${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 15) }).returning();
  try {
    const [row] = await db.insert(passwordResetTokensTable).values({ customerId: customer.id, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + 60_000) }).returning();
    await db.insert(passwordResetTokensTable).values({ customerId: customer.id, tokenHash: hashResetToken(expiredToken), expiresAt: new Date(Date.now() - 1_000) });
    await db.insert(userSessionsTable).values({ sid: `reset-session-${suffix}`, sess: { cookie: {}, customerId: customer.id }, expire: new Date(Date.now() + 60_000) });

    assert.equal(await validateResetToken(token), true);
    assert.equal(await validateResetToken(expiredToken), false);
    assert.notEqual(row.tokenHash, token, "raw reset token is never stored");
    await resetPassword({ token, password: "NewPassword@2026", ipAddress: "127.0.0.1" });

    const [updatedCustomer] = await db.select().from(customersTable).where(eq(customersTable.id, customer.id));
    assert.equal(await verifyPassword("NewPassword@2026", updatedCustomer.passwordHash!), true);
    assert.equal(await validateResetToken(token), false);
    await assert.rejects(() => resetPassword({ token, password: "AnotherPassword@2026" }), PasswordResetError);
    assert.equal((await db.select().from(userSessionsTable).where(eq(userSessionsTable.sid, `reset-session-${suffix}`))).length, 0);
    assert.equal((await db.select().from(auditLogsTable).where(and(eq(auditLogsTable.entityType, "customer"), eq(auditLogsTable.entityId, String(customer.id)), eq(auditLogsTable.action, "customer.password_reset")))).length, 1);
    assert.match(genericResetResponse, /إذا كان البريد مسجلاً/);
  } finally {
    await db.delete(auditLogsTable).where(and(eq(auditLogsTable.entityType, "customer"), eq(auditLogsTable.entityId, String(customer.id))));
    await db.delete(customersTable).where(eq(customersTable.id, customer.id));
  }
});
