import { Router } from "express";
import { db, customersTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../lib/auth";
import type { IRouter } from "express";

const router: IRouter = Router();

// Customer register
router.post("/auth/register", async (req, res): Promise<void> => {
  const { name, mobile, email, password } = req.body;
  if (!name || !mobile || !password) {
    res.status(400).json({ error: "الاسم والهاتف وكلمة المرور مطلوبة" });
    return;
  }

  const existing = await db.select().from(customersTable).where(eq(customersTable.mobile, mobile));
  if (existing.length > 0) {
    res.status(400).json({ error: "رقم الهاتف مسجل بالفعل" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [customer] = await db.insert(customersTable).values({ name, mobile, email: email || null, passwordHash }).returning();

  
  req.session.customerId = customer.id;
  req.session.customerName = customer.name;

  res.status(201).json({ customer: { id: customer.id, name: customer.name, email: customer.email, mobile: customer.mobile, isBlocked: customer.isBlocked, createdAt: customer.createdAt } });
});

// Customer login
router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان" });
    return;
  }

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.email, email));
  if (!customer || !customer.passwordHash) {
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }

  const valid = await verifyPassword(password, customer.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }

  if (customer.isBlocked) {
    res.status(403).json({ error: "هذا الحساب محظور" });
    return;
  }

  
  req.session.customerId = customer.id;
  req.session.customerName = customer.name;

  res.json({ customer: { id: customer.id, name: customer.name, email: customer.email, mobile: customer.mobile, isBlocked: customer.isBlocked, createdAt: customer.createdAt } });
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
  if (!customer) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ id: customer.id, name: customer.name, email: customer.email, mobile: customer.mobile, isBlocked: customer.isBlocked, createdAt: customer.createdAt });
});

// Admin login
router.post("/auth/admin/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || !user.isActive) {
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }

  
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
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, permissions: user.permissions });
});

export default router;
