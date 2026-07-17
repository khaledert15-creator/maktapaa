import { Router } from "express";
import { db, customersTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../lib/auth";
import type { IRouter } from "express";
import { egyptianPhoneSchema, optionalEgyptianPhoneSchema, resolvePreferredWhatsAppPhone, z } from "@workspace/api-zod";
import { parseBody } from "../lib/validation";
import { rateLimit } from "../lib/rate-limit";
import { genericResetResponse, PasswordResetError, requestPasswordReset, resetPassword, validateResetToken } from "../services/password-reset";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const customerRegisterSchema = z.object({ name: z.string().trim().min(2).max(200), mobile: egyptianPhoneSchema, primaryPhoneHasWhatsApp: z.boolean().default(true), alternatePhone: optionalEgyptianPhoneSchema, alternatePhoneHasWhatsApp: z.boolean().default(false), preferredWhatsAppPhone: optionalEgyptianPhoneSchema, email: z.string().email().max(200).nullable().optional(), password: z.string().min(8).max(200) });
const loginSchema = z.object({ email: z.string().email().max(200).transform(value => value.toLowerCase()), password: z.string().min(1).max(200) });
const loginRateLimit = rateLimit({ namespace: "login", windowMs: 15 * 60_000, max: 10 });
const forgotPasswordRateLimit = rateLimit({ namespace: "forgot-password", windowMs: 60 * 60_000, max: 5 });
const resetPasswordRateLimit = rateLimit({ namespace: "reset-password", windowMs: 60 * 60_000, max: 10 });
const forgotPasswordSchema = z.object({ email: z.string().email().max(200).transform(value => value.toLowerCase()) });
const resetPasswordSchema = z.object({ token: z.string().min(32).max(200), password: z.string().min(8).max(200) });

function regenerateSession(req: Parameters<typeof router.post>[1] extends (...args: infer A) => unknown ? A[0] : never): Promise<void> {
  return new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
}

// Customer register
router.post("/auth/register", async (req, res): Promise<void> => {
  const input = parseBody(customerRegisterSchema, req.body, res); if (!input) return;
  const { name, mobile, email, password, primaryPhoneHasWhatsApp, alternatePhone, alternatePhoneHasWhatsApp } = input;
  const preferredWhatsAppPhone = resolvePreferredWhatsAppPhone({ primaryPhone: mobile, primaryPhoneHasWhatsApp, alternatePhone, alternatePhoneHasWhatsApp, preferredWhatsAppPhone: input.preferredWhatsAppPhone });
  if (input.preferredWhatsAppPhone && !preferredWhatsAppPhone) { res.status(400).json({ error: "رقم واتساب المفضل يجب أن يكون رقمًا صالحًا ومحددًا عليه واتساب" }); return; }

  const existing = await db.select().from(customersTable).where(eq(customersTable.primaryPhone, mobile));
  if (existing.length > 0) {
    res.status(400).json({ error: "رقم الهاتف مسجل بالفعل" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [customer] = await db.insert(customersTable).values({ name, primaryPhone: mobile, primaryPhoneHasWhatsApp, alternatePhone: alternatePhone || null, alternatePhoneHasWhatsApp, preferredWhatsAppPhone, email: email?.toLowerCase() || null, passwordHash }).returning();

  
  const existingCart = req.session.cart;
  await regenerateSession(req);
  if (existingCart) req.session.cart = existingCart;
  req.session.customerId = customer.id;
  req.session.customerName = customer.name;

  res.status(201).json({ customer: { id: customer.id, name: customer.name, email: customer.email, mobile: customer.primaryPhone, primaryPhone: customer.primaryPhone, primaryPhoneHasWhatsApp: customer.primaryPhoneHasWhatsApp, alternatePhone: customer.alternatePhone, alternatePhoneHasWhatsApp: customer.alternatePhoneHasWhatsApp, preferredWhatsAppPhone: customer.preferredWhatsAppPhone, isBlocked: customer.isBlocked, createdAt: customer.createdAt } });
});

// Customer login
router.post("/auth/login", loginRateLimit, async (req, res): Promise<void> => {
  const input = parseBody(loginSchema, req.body, res); if (!input) return;
  const { email, password } = input;

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.email, email));
  if (!customer || !customer.passwordHash) {
    logger.warn({ event: "customer_login_failed", email }, "Customer authentication failed");
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }

  const valid = await verifyPassword(password, customer.passwordHash);
  if (!valid) {
    logger.warn({ event: "customer_login_failed", customerId: customer.id }, "Customer authentication failed");
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }

  if (customer.isBlocked) {
    res.status(403).json({ error: "هذا الحساب محظور" });
    return;
  }

  
  const existingCart = req.session.cart;
  await regenerateSession(req);
  if (existingCart) req.session.cart = existingCart;
  req.session.customerId = customer.id;
  req.session.customerName = customer.name;

  res.json({ customer: { id: customer.id, name: customer.name, email: customer.email, mobile: customer.primaryPhone, primaryPhone: customer.primaryPhone, primaryPhoneHasWhatsApp: customer.primaryPhoneHasWhatsApp, alternatePhone: customer.alternatePhone, alternatePhoneHasWhatsApp: customer.alternatePhoneHasWhatsApp, preferredWhatsAppPhone: customer.preferredWhatsAppPhone, isBlocked: customer.isBlocked, createdAt: customer.createdAt } });
});

// Customer logout
router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {
    res.sendStatus(204);
  });
});

// Get current customer
router.get("/auth/me", async (req, res): Promise<void> => {
  
  if (!req.session.customerId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, req.session.customerId as number));
  if (!customer || customer.isBlocked) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ id: customer.id, name: customer.name, email: customer.email, mobile: customer.primaryPhone, primaryPhone: customer.primaryPhone, primaryPhoneHasWhatsApp: customer.primaryPhoneHasWhatsApp, alternatePhone: customer.alternatePhone, alternatePhoneHasWhatsApp: customer.alternatePhoneHasWhatsApp, preferredWhatsAppPhone: customer.preferredWhatsAppPhone, isBlocked: customer.isBlocked, createdAt: customer.createdAt });
});

// Admin login
router.post("/auth/admin/login", loginRateLimit, async (req, res): Promise<void> => {
  const input = parseBody(loginSchema, req.body, res); if (!input) return;
  const { email, password } = input;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || !user.isActive) {
    logger.warn({ event: "admin_login_failed", email }, "Admin authentication failed");
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    logger.warn({ event: "admin_login_failed", userId: user.id }, "Admin authentication failed");
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }

  
  await regenerateSession(req);
  req.session.adminId = user.id;
  req.session.adminRole = user.role;
  req.session.adminPermissions = user.permissions;

  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, permissions: user.permissions } });
});

// Admin logout
router.post("/auth/admin/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {
    res.sendStatus(204);
  });
});

// Get current admin
router.get("/auth/admin/me", async (req, res): Promise<void> => {
  
  if (!req.session.adminId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.adminId as number));
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, permissions: user.permissions });
});

router.post("/auth/forgot-password", forgotPasswordRateLimit, async (req, res): Promise<void> => {
  const input = parseBody(forgotPasswordSchema, req.body, res); if (!input) return;
  const startedAt = performance.now();
  await requestPasswordReset(input.email);
  const remainingDelay = 300 - (performance.now() - startedAt);
  if (remainingDelay > 0) await new Promise(resolve => setTimeout(resolve, remainingDelay));
  res.status(202).json({ message: genericResetResponse });
});

router.get("/auth/reset-password/validate", resetPasswordRateLimit, async (req, res): Promise<void> => {
  const parsed = z.string().min(32).max(200).safeParse(req.query.token);
  if (!parsed.success) { res.status(400).json({ valid: false }); return; }
  res.json({ valid: await validateResetToken(parsed.data) });
});

router.post("/auth/reset-password", resetPasswordRateLimit, async (req, res): Promise<void> => {
  const input = parseBody(resetPasswordSchema, req.body, res); if (!input) return;
  try {
    await resetPassword({ ...input, ipAddress: req.ip });
    res.json({ message: "تم تعيين كلمة المرور الجديدة. يمكنك تسجيل الدخول الآن." });
  } catch (error) {
    if (error instanceof PasswordResetError) { res.status(400).json({ error: error.message }); return; }
    throw error;
  }
});

export default router;
