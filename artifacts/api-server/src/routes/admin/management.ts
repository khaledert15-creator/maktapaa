import { Router, type IRouter } from "express";
import { auditLogsTable, bannersTable, db, faqsTable, pool, siteSettingsTable, usersTable } from "@workspace/db";
import { asc, desc, eq } from "drizzle-orm";
import { requireAdminAuth, requireAdminPermission, hashPassword } from "../../lib/auth";
import { writeAuditLog } from "../../services/audit";
import { parseBody } from "../../lib/validation";
import { z } from "@workspace/api-zod";
import multer from "multer";
import { imageStorage } from "../../services/storage";

const router: IRouter = Router();
router.use(requireAdminAuth);
const bannerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
});

const roles = z.enum(["owner", "administrator", "sales", "customer_service", "warehouse", "shipping", "accountant", "content_manager"]);
const employeeCreateSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().email().max(200), password: z.string().min(8).max(200), role: roles.default("sales"), permissions: z.array(z.string().trim().min(1).max(100)).max(100).default([]) });
const employeeUpdateSchema = z.object({ name: z.string().trim().min(2).max(120).optional(), email: z.string().email().max(200).optional(), password: z.string().min(8).max(200).optional(), role: roles.optional(), permissions: z.array(z.string().trim().min(1).max(100)).max(100).optional(), isActive: z.boolean().optional() });
const settingSchema = z.object({ value: z.union([z.string().max(20_000), z.number(), z.boolean(), z.null()]) });
const imageVariantsSchema = z.record(z.string(), z.object({ url: z.string().url(), width: z.number().int().positive(), height: z.number().int().positive(), size: z.number().int().positive() }));
const bannerSchema = z.object({ imageUrl: z.string().trim().min(1).max(2000), imageStorageKey: z.string().max(1000).nullable().optional(), imageWidth: z.number().int().positive().nullable().optional(), imageHeight: z.number().int().positive().nullable().optional(), imageVariants: imageVariantsSchema.nullable().optional(), titleAr: z.string().max(300).nullable().optional(), subtitleAr: z.string().max(600).nullable().optional(), linkUrl: z.string().max(2000).nullable().optional(), sortOrder: z.coerce.number().int().min(0).max(10_000).optional(), isActive: z.boolean().optional() });
const faqSchema = z.object({ questionAr: z.string().trim().min(3).max(500), answerAr: z.string().trim().min(3).max(10_000), sortOrder: z.coerce.number().int().min(0).max(10_000).optional(), isActive: z.boolean().optional() });

router.get("/admin/audit-logs", requireAdminPermission("audit.view"), async (_req, res) => {
  res.json(await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(100));
});

router.get("/admin/diagnostics/pool", requireAdminPermission("reports.view"), async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount });
});

router.get("/admin/employees", requireAdminPermission("employees.manage"), async (_req, res) => {
  const rows = await db.select().from(usersTable).orderBy(asc(usersTable.name));
  res.json(rows.map(({ passwordHash: _passwordHash, ...user }) => user));
});

router.post("/admin/employees", requireAdminPermission("employees.manage"), async (req, res): Promise<void> => {
  const input = parseBody(employeeCreateSchema, req.body, res); if (!input) return;
  const { name, email, password, role, permissions } = input;
  const [user] = await db.insert(usersTable).values({ name, email: email.toLowerCase(), passwordHash: await hashPassword(password), role: role || "sales", permissions: Array.isArray(permissions) ? permissions : [] }).returning();
  await writeAuditLog(req, { action: "employee.create", entityType: "employee", entityId: user.id, description: `إضافة الموظف ${user.name}` });
  const { passwordHash: _passwordHash, ...safeUser } = user;
  res.status(201).json(safeUser);
});

router.patch("/admin/employees/:id", requireAdminPermission("employees.manage"), async (req, res): Promise<void> => {
  const input = parseBody(employeeUpdateSchema, req.body, res); if (!input) return;
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  if (id === req.session.adminId && input.isActive === false) { res.status(400).json({ error: "لا يمكنك تعطيل حسابك الحالي" }); return; }
  const { password, ...updates } = input;
  const [user] = await db.update(usersTable).set({ ...updates, ...(password ? { passwordHash: await hashPassword(password) } : {}) }).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "الموظف غير موجود" }); return; }
  await writeAuditLog(req, { action: "employee.update", entityType: "employee", entityId: id, description: `تعديل الموظف ${user.name}` });
  const { passwordHash: _passwordHash, ...safeUser } = user;
  res.json(safeUser);
});

router.get("/admin/content/settings", requireAdminPermission("content.manage"), async (_req, res) => res.json(await db.select().from(siteSettingsTable).orderBy(asc(siteSettingsTable.key))));
router.put("/admin/content/settings/:key", requireAdminPermission("content.manage"), async (req, res) => {
  const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
  if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(key)) { res.status(400).json({ error: "مفتاح الإعداد غير صحيح" }); return; }
  const input = parseBody(settingSchema, req.body, res); if (!input) return;
  const [row] = await db.insert(siteSettingsTable).values({ key, value: String(input.value ?? "") }).onConflictDoUpdate({ target: siteSettingsTable.key, set: { value: String(input.value ?? ""), updatedAt: new Date() } }).returning();
  await writeAuditLog(req, { action: "content.setting_update", entityType: "setting", entityId: key, description: `تعديل إعداد ${key}` });
  res.json(row);
});
router.get("/admin/content/banners", requireAdminPermission("content.manage"), async (_req, res) => res.json(await db.select().from(bannersTable).orderBy(asc(bannersTable.sortOrder))));
router.post("/admin/content/banners/upload", requireAdminPermission("content.manage"), bannerUpload.single("image"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "اختر صورة البانر" }); return; }
  const stored = await imageStorage.saveImage(req.file.buffer, "banners");
  res.status(201).json({ imageUrl: stored.url, imageStorageKey: stored.storageKey, imageWidth: stored.width, imageHeight: stored.height, imageVariants: stored.variants });
});
router.post("/admin/content/banners", requireAdminPermission("content.manage"), async (req, res) => { const input = parseBody(bannerSchema, req.body, res); if (!input) return; const [row] = await db.insert(bannersTable).values(input).returning(); res.status(201).json(row); });
router.patch("/admin/content/banners/:id", requireAdminPermission("content.manage"), async (req, res) => { const input = parseBody(bannerSchema.partial(), req.body, res); if (!input) return; const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id); const [row] = await db.update(bannersTable).set(input).where(eq(bannersTable.id, id)).returning(); res.json(row); });
router.put("/admin/content/banners/:id/image", requireAdminPermission("content.manage"), bannerUpload.single("image"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "اختر صورة البانر" }); return; }
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const [existing] = await db.select().from(bannersTable).where(eq(bannersTable.id, id));
  if (!existing) { res.status(404).json({ error: "البانر غير موجود" }); return; }
  const stored = existing.imageStorageKey ? await imageStorage.replaceImage(existing.imageStorageKey, req.file.buffer, "banners") : await imageStorage.saveImage(req.file.buffer, "banners");
  const [row] = await db.update(bannersTable).set({ imageUrl: stored.url, imageStorageKey: stored.storageKey, imageWidth: stored.width, imageHeight: stored.height, imageVariants: stored.variants }).where(eq(bannersTable.id, id)).returning();
  res.json(row);
});
router.delete("/admin/content/banners/:id", requireAdminPermission("content.manage"), async (req, res) => { const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id); const [banner] = await db.delete(bannersTable).where(eq(bannersTable.id, id)).returning(); if (banner?.imageStorageKey) await imageStorage.deleteImage(banner.imageStorageKey); res.sendStatus(204); });
router.get("/admin/content/faqs", requireAdminPermission("content.manage"), async (_req, res) => res.json(await db.select().from(faqsTable).orderBy(asc(faqsTable.sortOrder))));
router.post("/admin/content/faqs", requireAdminPermission("content.manage"), async (req, res) => { const input = parseBody(faqSchema, req.body, res); if (!input) return; const [row] = await db.insert(faqsTable).values(input).returning(); res.status(201).json(row); });
router.patch("/admin/content/faqs/:id", requireAdminPermission("content.manage"), async (req, res) => { const input = parseBody(faqSchema.partial(), req.body, res); if (!input) return; const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id); const [row] = await db.update(faqsTable).set(input).where(eq(faqsTable.id, id)).returning(); res.json(row); });
router.delete("/admin/content/faqs/:id", requireAdminPermission("content.manage"), async (req, res) => { const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id); await db.delete(faqsTable).where(eq(faqsTable.id, id)); res.sendStatus(204); });

export default router;
