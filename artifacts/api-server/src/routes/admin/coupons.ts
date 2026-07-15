import { Router, type IRouter } from "express";
import { db, couponsTable, governoratesTable, usersTable, bannersTable, faqsTable, siteSettingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAdminAuth } from "../../lib/auth";
import { hashPassword } from "../../lib/auth";

const router: IRouter = Router();
router.use(requireAdminAuth);

// COUPONS
router.get("/admin/coupons", async (req, res): Promise<void> => {
  const { page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const [items, [{ count }]] = await Promise.all([
    db.select().from(couponsTable).limit(limitNum).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(couponsTable),
  ]);

  res.json({ items: items.map(c => ({ ...c, value: Number(c.value), minOrderAmount: c.minOrderAmount ? Number(c.minOrderAmount) : null })), total: count, page: pageNum, limit: limitNum });
});

router.post("/admin/coupons", async (req, res): Promise<void> => {
  const { code, type, value, minOrderAmount, maxUses, startDate, endDate } = req.body;
  const [c] = await db.insert(couponsTable).values({ code, type, value: String(value), minOrderAmount: minOrderAmount ? String(minOrderAmount) : null, maxUses: maxUses || null, startDate: startDate || null, endDate: endDate || null }).returning();
  res.status(201).json({ ...c, value: Number(c.value), minOrderAmount: c.minOrderAmount ? Number(c.minOrderAmount) : null });
});

router.patch("/admin/coupons/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { value, minOrderAmount, ...rest } = req.body;
  const [c] = await db.update(couponsTable).set({ ...rest, ...(value !== undefined && { value: String(value) }), ...(minOrderAmount !== undefined && { minOrderAmount: minOrderAmount ? String(minOrderAmount) : null }) }).where(eq(couponsTable.id, id)).returning();
  if (!c) { res.status(404).json({ error: "Coupon not found" }); return; }
  res.json({ ...c, value: Number(c.value), minOrderAmount: c.minOrderAmount ? Number(c.minOrderAmount) : null });
});

router.delete("/admin/coupons/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(couponsTable).where(eq(couponsTable.id, id));
  res.sendStatus(204);
});

// GOVERNORATES (admin)
router.get("/admin/governorates", async (_req, res): Promise<void> => {
  const govs = await db.select().from(governoratesTable);
  res.json(govs.map(g => ({ ...g, shippingCost: Number(g.shippingCost), freeShippingThreshold: g.freeShippingThreshold ? Number(g.freeShippingThreshold) : null })));
});

router.post("/admin/governorates", async (req, res): Promise<void> => {
  const { nameAr, nameEn, shippingCost, freeShippingThreshold, estimatedDays } = req.body;
  const [g] = await db.insert(governoratesTable).values({ nameAr, nameEn: nameEn || null, shippingCost: String(shippingCost), freeShippingThreshold: freeShippingThreshold ? String(freeShippingThreshold) : null, estimatedDays }).returning();
  res.status(201).json({ ...g, shippingCost: Number(g.shippingCost), freeShippingThreshold: g.freeShippingThreshold ? Number(g.freeShippingThreshold) : null });
});

router.patch("/admin/governorates/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { shippingCost, freeShippingThreshold, ...rest } = req.body;
  const [g] = await db.update(governoratesTable).set({ ...rest, ...(shippingCost !== undefined && { shippingCost: String(shippingCost) }), ...(freeShippingThreshold !== undefined && { freeShippingThreshold: freeShippingThreshold ? String(freeShippingThreshold) : null }) }).where(eq(governoratesTable.id, id)).returning();
  if (!g) { res.status(404).json({ error: "Governorate not found" }); return; }
  res.json({ ...g, shippingCost: Number(g.shippingCost), freeShippingThreshold: g.freeShippingThreshold ? Number(g.freeShippingThreshold) : null });
});

// BANNERS (admin)
router.get("/admin/content/banners", async (_req, res): Promise<void> => {
  res.json(await db.select().from(bannersTable));
});
router.post("/admin/content/banners", async (req, res): Promise<void> => {
  const [b] = await db.insert(bannersTable).values(req.body).returning();
  res.status(201).json(b);
});
router.patch("/admin/content/banners/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [b] = await db.update(bannersTable).set(req.body).where(eq(bannersTable.id, id)).returning();
  res.json(b);
});
router.delete("/admin/content/banners/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(bannersTable).where(eq(bannersTable.id, id));
  res.sendStatus(204);
});

// FAQS (admin)
router.get("/admin/content/faqs", async (_req, res): Promise<void> => {
  res.json(await db.select().from(faqsTable));
});
router.post("/admin/content/faqs", async (req, res): Promise<void> => {
  const [f] = await db.insert(faqsTable).values(req.body).returning();
  res.status(201).json(f);
});
router.patch("/admin/content/faqs/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [f] = await db.update(faqsTable).set(req.body).where(eq(faqsTable.id, id)).returning();
  res.json(f);
});
router.delete("/admin/content/faqs/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(faqsTable).where(eq(faqsTable.id, id));
  res.sendStatus(204);
});

// SITE SETTINGS (admin)
router.patch("/admin/content/settings", async (req, res): Promise<void> => {
  for (const [key, value] of Object.entries(req.body)) {
    const existing = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.key, key));
    if (existing.length > 0) {
      await db.update(siteSettingsTable).set({ value: String(value) }).where(eq(siteSettingsTable.key, key));
    } else {
      await db.insert(siteSettingsTable).values({ key, value: String(value) });
    }
  }
  const rows = await db.select().from(siteSettingsTable);
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value || ""]));
  res.json({
    storeName: settings.storeName || "Maktaba Dot Com",
    storeNameAr: settings.storeNameAr || "مكتبة دوت كوم",
    logoUrl: settings.logoUrl || null,
    whatsappNumber: settings.whatsappNumber || null,
    phoneNumber: settings.phoneNumber || null,
    email: settings.email || null,
    address: settings.address || null,
    facebookUrl: settings.facebookUrl || null,
    instagramUrl: settings.instagramUrl || null,
    tiktokUrl: settings.tiktokUrl || null,
    telegramUrl: settings.telegramUrl || null,
    announcementBar: settings.announcementBar || null,
    announcementEnabled: settings.announcementEnabled === "true",
    seoTitle: settings.seoTitle || null,
    seoDescription: settings.seoDescription || null,
  });
});

// EMPLOYEES (admin)
router.get("/admin/employees", async (_req, res): Promise<void> => {
  const employees = await db.select().from(usersTable);
  res.json(employees.map(e => ({ id: e.id, name: e.name, email: e.email, role: e.role, isActive: e.isActive, permissions: e.permissions, createdAt: e.createdAt })));
});

router.post("/admin/employees", async (req, res): Promise<void> => {
  const { name, email, password, role, permissions } = req.body;
  const passwordHash = await hashPassword(password);
  const [e] = await db.insert(usersTable).values({ name, email, passwordHash, role: role || "sales", permissions: permissions || [] }).returning();
  res.status(201).json({ id: e.id, name: e.name, email: e.email, role: e.role, isActive: e.isActive, permissions: e.permissions, createdAt: e.createdAt });
});

router.patch("/admin/employees/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { password, ...rest } = req.body;
  const updateData: Record<string, unknown> = { ...rest };
  if (password) updateData.passwordHash = await hashPassword(password);
  const [e] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, id)).returning();
  if (!e) { res.status(404).json({ error: "Employee not found" }); return; }
  res.json({ id: e.id, name: e.name, email: e.email, role: e.role, isActive: e.isActive, permissions: e.permissions, createdAt: e.createdAt });
});

router.delete("/admin/employees/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.update(usersTable).set({ isActive: false }).where(eq(usersTable.id, id));
  res.sendStatus(204);
});

export default router;
