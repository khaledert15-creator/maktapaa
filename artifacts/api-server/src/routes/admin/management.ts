import { Router, type IRouter } from "express";
import { auditLogsTable, bannersTable, brandAssetsTable, db, faqsTable, helpLinksTable, helpSectionsTable, pool, siteSettingsTable, usersTable } from "@workspace/db";
import { asc, desc, eq, inArray } from "drizzle-orm";
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
const brandUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, ["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(file.mimetype)),
});

const roles = z.enum(["owner", "administrator", "sales", "customer_service", "warehouse", "shipping", "accountant", "content_manager"]);
const employeeCreateSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().email().max(200), password: z.string().min(8).max(200), role: roles.default("sales"), permissions: z.array(z.string().trim().min(1).max(100)).max(100).default([]) });
const employeeUpdateSchema = z.object({ name: z.string().trim().min(2).max(120).optional(), email: z.string().email().max(200).optional(), password: z.string().min(8).max(200).optional(), role: roles.optional(), permissions: z.array(z.string().trim().min(1).max(100)).max(100).optional(), isActive: z.boolean().optional() });
const settingSchema = z.object({ value: z.union([z.string().max(20_000), z.number(), z.boolean(), z.null()]) });
const imageVariantsSchema = z.record(z.string(), z.object({ url: z.string().url(), width: z.number().int().positive(), height: z.number().int().positive(), size: z.number().int().positive() }));
const nullableLinkSchema = z.string().trim().max(2000).nullable().optional().refine(value => !value || (value.startsWith("/") && !value.startsWith("//")) || /^https?:\/\//i.test(value), "الرابط يجب أن يكون داخليًا أو يبدأ بـ http/https");
const nullableDateSchema = z.preprocess(value => value === "" ? null : value, z.coerce.date().nullable().optional());
const announcementSchema = z.object({
  text: z.string().trim().min(1).max(500),
  isActive: z.boolean(),
  link: nullableLinkSchema,
  startAt: nullableDateSchema,
  endAt: nullableDateSchema,
}).refine(value => !value.startAt || !value.endAt || value.endAt >= value.startAt, { message: "تاريخ النهاية يجب أن يلي تاريخ البداية", path: ["endAt"] });
const bannerFieldsSchema = z.object({
  imageUrl: z.string().trim().min(1).max(2000),
  imageStorageKey: z.string().max(1000).nullable().optional(),
  imageWidth: z.number().int().positive().nullable().optional(),
  imageHeight: z.number().int().positive().nullable().optional(),
  imageVariants: imageVariantsSchema.nullable().optional(),
  titleAr: z.string().trim().min(1).max(300),
  subtitleAr: z.string().trim().max(600).nullable().optional(),
  badgeText: z.string().trim().max(120).nullable().optional(),
  primaryButtonText: z.string().trim().max(120).nullable().optional(),
  primaryButtonUrl: nullableLinkSchema,
  secondaryButtonText: z.string().trim().max(120).nullable().optional(),
  secondaryButtonUrl: nullableLinkSchema,
  textAlignment: z.enum(["right", "center", "left"]),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
  isActive: z.boolean(),
  startAt: nullableDateSchema,
  endAt: nullableDateSchema,
});
const bannerSchema = bannerFieldsSchema.extend({
  textAlignment: z.enum(["right", "center", "left"]).default("right"),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
}).refine(value => !value.startAt || !value.endAt || value.endAt >= value.startAt, { message: "تاريخ النهاية يجب أن يلي تاريخ البداية", path: ["endAt"] });
const bannerUpdateSchema = bannerFieldsSchema.partial();
const faqSchema = z.object({ questionAr: z.string().trim().min(3).max(500), answerAr: z.string().trim().min(3).max(10_000), sortOrder: z.coerce.number().int().min(0).max(10_000).optional(), isActive: z.boolean().optional() });
const helpSectionSchema = z.object({ titleAr: z.string().trim().min(2).max(160), isActive: z.boolean() });
const helpLinkFieldsSchema = z.object({
  textAr: z.string().trim().min(2).max(160),
  textEn: z.preprocess(value => value === "" ? null : value, z.string().trim().max(160).nullable().optional()),
  url: z.string().trim().min(1).max(2000).refine(value => (value.startsWith("/") && !value.startsWith("//")) || /^https?:\/\//i.test(value), "الرابط يجب أن يكون داخليًا أو يبدأ بـ http/https"),
  target: z.enum(["same_tab", "new_tab"]),
  icon: z.enum(["help-circle", "package-search", "truck", "rotate-ccw", "shield", "file-text", "message-circle", "phone", "mail", "book-open"]).nullable().optional(),
  deviceVisibility: z.enum(["all", "desktop", "mobile"]),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
  isActive: z.boolean(),
  startAt: nullableDateSchema,
  endAt: nullableDateSchema,
});
const helpLinkSchema = helpLinkFieldsSchema.refine(value => !value.startAt || !value.endAt || value.endAt >= value.startAt, { message: "تاريخ النهاية يجب أن يلي تاريخ البداية", path: ["endAt"] });
const helpLinkUpdateSchema = helpLinkFieldsSchema.partial();
const helpReorderSchema = z.object({ items: z.array(z.object({ id: z.number().int().positive(), sortOrder: z.number().int().min(0).max(10_000) })).min(1).max(100) });
const brandKindSchema = z.enum(["main", "dark_background", "light_background", "mobile", "favicon", "admin", "social"]);

const announcementKeys = ["announcementBar", "announcementEnabled", "announcementLink", "announcementStartAt", "announcementEndAt"] as const;
const announcementFromSettings = (settings: Record<string, string>) => ({
  text: settings.announcementBar || "",
  isActive: settings.announcementEnabled === "true",
  link: settings.announcementLink || null,
  startAt: settings.announcementStartAt || null,
  endAt: settings.announcementEndAt || null,
});

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

router.get("/admin/content/settings", requireAdminPermission("content.view"), async (_req, res) => res.json(await db.select().from(siteSettingsTable).orderBy(asc(siteSettingsTable.key))));
router.put("/admin/content/settings/:key", requireAdminPermission("content.manage"), async (req, res) => {
  const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
  if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(key)) { res.status(400).json({ error: "مفتاح الإعداد غير صحيح" }); return; }
  const input = parseBody(settingSchema, req.body, res); if (!input) return;
  const [row] = await db.insert(siteSettingsTable).values({ key, value: String(input.value ?? "") }).onConflictDoUpdate({ target: siteSettingsTable.key, set: { value: String(input.value ?? ""), updatedAt: new Date() } }).returning();
  await writeAuditLog(req, { action: "content.setting_update", entityType: "setting", entityId: key, description: `تعديل إعداد ${key}` });
  res.json(row);
});
router.get("/admin/content/announcement", requireAdminPermission("content.view"), async (_req, res) => {
  const rows = await db.select().from(siteSettingsTable).where(inArray(siteSettingsTable.key, [...announcementKeys]));
  res.json(announcementFromSettings(Object.fromEntries(rows.map(row => [row.key, row.value || ""]))));
});
router.put("/admin/content/announcement", requireAdminPermission("content.manage"), async (req, res): Promise<void> => {
  const input = parseBody(announcementSchema, req.body, res); if (!input) return;
  const beforeRows = await db.select().from(siteSettingsTable).where(inArray(siteSettingsTable.key, [...announcementKeys]));
  const before = announcementFromSettings(Object.fromEntries(beforeRows.map(row => [row.key, row.value || ""])));
  const values: Record<(typeof announcementKeys)[number], string> = {
    announcementBar: input.text,
    announcementEnabled: String(input.isActive),
    announcementLink: input.link || "",
    announcementStartAt: input.startAt?.toISOString() || "",
    announcementEndAt: input.endAt?.toISOString() || "",
  };
  await db.transaction(async tx => {
    for (const key of announcementKeys) {
      await tx.insert(siteSettingsTable).values({ key, value: values[key] }).onConflictDoUpdate({ target: siteSettingsTable.key, set: { value: values[key], updatedAt: new Date() } });
    }
  });
  const after = announcementFromSettings(values);
  await writeAuditLog(req, { action: "content.announcement_update", entityType: "announcement", entityId: "homepage", description: "تعديل شريط الإعلان في الصفحة الرئيسية", beforeData: before, afterData: after });
  res.json(after);
});
router.get("/admin/content/banners", requireAdminPermission("content.view"), async (_req, res) => res.json(await db.select().from(bannersTable).orderBy(asc(bannersTable.sortOrder))));
router.post("/admin/content/banners/upload", requireAdminPermission("content.manage"), bannerUpload.single("image"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "اختر صورة البانر" }); return; }
  const stored = await imageStorage.saveImage(req.file.buffer, "banners");
  await writeAuditLog(req, { action: "content.banner_image_upload", entityType: "banner", description: "رفع صورة جديدة للبانر", afterData: { imageUrl: stored.url, imageStorageKey: stored.storageKey } });
  res.status(201).json({ imageUrl: stored.url, imageStorageKey: stored.storageKey, imageWidth: stored.width, imageHeight: stored.height, imageVariants: stored.variants });
});
router.post("/admin/content/banners", requireAdminPermission("content.manage"), async (req, res): Promise<void> => {
  const input = parseBody(bannerSchema, req.body, res); if (!input) return;
  const [row] = await db.insert(bannersTable).values({ ...input, linkUrl: input.primaryButtonUrl || null }).returning();
  await writeAuditLog(req, { action: "content.banner_create", entityType: "banner", entityId: row.id, description: `إنشاء شريحة البانر ${row.titleAr || row.id}`, afterData: row });
  res.status(201).json(row);
});
router.patch("/admin/content/banners/:id", requireAdminPermission("content.manage"), async (req, res): Promise<void> => {
  const input = parseBody(bannerUpdateSchema, req.body, res); if (!input) return;
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const [before] = await db.select().from(bannersTable).where(eq(bannersTable.id, id));
  if (!before) { res.status(404).json({ error: "البانر غير موجود" }); return; }
  const nextStart = input.startAt === undefined ? before.startAt : input.startAt;
  const nextEnd = input.endAt === undefined ? before.endAt : input.endAt;
  if (nextStart && nextEnd && nextEnd < nextStart) { res.status(400).json({ error: "تاريخ النهاية يجب أن يلي تاريخ البداية" }); return; }
  const updates = { ...input, ...(input.primaryButtonUrl !== undefined ? { linkUrl: input.primaryButtonUrl } : {}) };
  const [row] = await db.update(bannersTable).set(updates).where(eq(bannersTable.id, id)).returning();
  await writeAuditLog(req, { action: input.isActive === undefined ? "content.banner_update" : "content.banner_status", entityType: "banner", entityId: id, description: `تعديل شريحة البانر ${row.titleAr || id}`, beforeData: before, afterData: row });
  res.json(row);
});
router.put("/admin/content/banners/:id/image", requireAdminPermission("content.manage"), bannerUpload.single("image"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "اختر صورة البانر" }); return; }
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const [existing] = await db.select().from(bannersTable).where(eq(bannersTable.id, id));
  if (!existing) { res.status(404).json({ error: "البانر غير موجود" }); return; }
  const stored = existing.imageStorageKey ? await imageStorage.replaceImage(existing.imageStorageKey, req.file.buffer, "banners") : await imageStorage.saveImage(req.file.buffer, "banners");
  const [row] = await db.update(bannersTable).set({ imageUrl: stored.url, imageStorageKey: stored.storageKey, imageWidth: stored.width, imageHeight: stored.height, imageVariants: stored.variants }).where(eq(bannersTable.id, id)).returning();
  await writeAuditLog(req, { action: "content.banner_image_update", entityType: "banner", entityId: id, description: `تغيير صورة شريحة البانر ${row.titleAr || id}`, beforeData: existing, afterData: row });
  res.json(row);
});
router.delete("/admin/content/banners/:id", requireAdminPermission("content.manage"), async (req, res): Promise<void> => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const [banner] = await db.delete(bannersTable).where(eq(bannersTable.id, id)).returning();
  if (!banner) { res.status(404).json({ error: "البانر غير موجود" }); return; }
  if (banner.imageStorageKey) await imageStorage.deleteImage(banner.imageStorageKey);
  await writeAuditLog(req, { action: "content.banner_delete", entityType: "banner", entityId: id, description: `حذف شريحة البانر ${banner.titleAr || id}`, beforeData: banner });
  res.sendStatus(204);
});
router.get("/admin/content/help", requireAdminPermission("content.view"), async (_req, res) => {
  const [section] = await db.select().from(helpSectionsTable).orderBy(asc(helpSectionsTable.id)).limit(1);
  const items = section ? await db.select().from(helpLinksTable).where(eq(helpLinksTable.sectionId, section.id)).orderBy(asc(helpLinksTable.sortOrder), asc(helpLinksTable.id)) : [];
  res.json({ section: section ?? null, items });
});
router.put("/admin/content/help/section", requireAdminPermission("content.manage"), async (req, res): Promise<void> => {
  const input = parseBody(helpSectionSchema, req.body, res); if (!input) return;
  const [before] = await db.select().from(helpSectionsTable).orderBy(asc(helpSectionsTable.id)).limit(1);
  const [section] = before
    ? await db.update(helpSectionsTable).set(input).where(eq(helpSectionsTable.id, before.id)).returning()
    : await db.insert(helpSectionsTable).values(input).returning();
  await writeAuditLog(req, { action: "content.help_section_update", entityType: "help_section", entityId: section.id, description: "تعديل عنوان أو ظهور قسم مساعدة وخدمة العملاء", beforeData: before ?? null, afterData: section });
  res.json(section);
});
router.post("/admin/content/help/items", requireAdminPermission("content.manage"), async (req, res): Promise<void> => {
  const input = parseBody(helpLinkSchema, req.body, res); if (!input) return;
  const [section] = await db.select().from(helpSectionsTable).orderBy(asc(helpSectionsTable.id)).limit(1);
  if (!section) { res.status(409).json({ error: "احفظ عنوان القسم أولًا" }); return; }
  const [item] = await db.insert(helpLinksTable).values({ ...input, sectionId: section.id }).returning();
  await writeAuditLog(req, { action: "content.help_item_create", entityType: "help_link", entityId: item.id, description: `إضافة رابط المساعدة ${item.textAr}`, afterData: item });
  res.status(201).json(item);
});
router.patch("/admin/content/help/items/:id", requireAdminPermission("content.manage"), async (req, res): Promise<void> => {
  const input = parseBody(helpLinkUpdateSchema, req.body, res); if (!input) return;
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const [before] = await db.select().from(helpLinksTable).where(eq(helpLinksTable.id, id));
  if (!before) { res.status(404).json({ error: "الرابط غير موجود" }); return; }
  const nextStart = input.startAt === undefined ? before.startAt : input.startAt;
  const nextEnd = input.endAt === undefined ? before.endAt : input.endAt;
  if (nextStart && nextEnd && nextEnd < nextStart) { res.status(400).json({ error: "تاريخ النهاية يجب أن يلي تاريخ البداية" }); return; }
  const [item] = await db.update(helpLinksTable).set(input).where(eq(helpLinksTable.id, id)).returning();
  await writeAuditLog(req, { action: "content.help_item_update", entityType: "help_link", entityId: id, description: `تعديل رابط المساعدة ${item.textAr}`, beforeData: before, afterData: item });
  res.json(item);
});
router.put("/admin/content/help/reorder", requireAdminPermission("content.manage"), async (req, res): Promise<void> => {
  const input = parseBody(helpReorderSchema, req.body, res); if (!input) return;
  const ids = input.items.map(item => item.id);
  const existing = await db.select({ id: helpLinksTable.id }).from(helpLinksTable).where(inArray(helpLinksTable.id, ids));
  if (existing.length !== new Set(ids).size) { res.status(404).json({ error: "تعذر العثور على أحد الروابط" }); return; }
  await db.transaction(async tx => { for (const item of input.items) await tx.update(helpLinksTable).set({ sortOrder: item.sortOrder }).where(eq(helpLinksTable.id, item.id)); });
  await writeAuditLog(req, { action: "content.help_reorder", entityType: "help_section", entityId: "primary", description: "إعادة ترتيب روابط المساعدة", afterData: input });
  res.json(await db.select().from(helpLinksTable).where(inArray(helpLinksTable.id, ids)).orderBy(asc(helpLinksTable.sortOrder)));
});
router.delete("/admin/content/help/items/:id", requireAdminPermission("content.manage"), async (req, res): Promise<void> => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const [item] = await db.delete(helpLinksTable).where(eq(helpLinksTable.id, id)).returning();
  if (!item) { res.status(404).json({ error: "الرابط غير موجود" }); return; }
  await writeAuditLog(req, { action: "content.help_item_delete", entityType: "help_link", entityId: id, description: `حذف رابط المساعدة ${item.textAr}`, beforeData: item });
  res.sendStatus(204);
});

router.get("/admin/content/branding", requireAdminPermission("content.view"), async (_req, res) => res.json(await db.select().from(brandAssetsTable).orderBy(asc(brandAssetsTable.kind))));
router.post("/admin/content/branding/:kind", requireAdminPermission("branding.manage"), brandUpload.single("image"), async (req, res): Promise<void> => {
  const kindResult = brandKindSchema.safeParse(Array.isArray(req.params.kind) ? req.params.kind[0] : req.params.kind);
  if (!kindResult.success) { res.status(400).json({ error: "نوع الشعار غير صحيح" }); return; }
  if (!req.file) { res.status(400).json({ error: "اختر ملف الشعار" }); return; }
  const altResult = z.string().trim().max(200).safeParse(req.body?.altTextAr || "شعار مكتبة دوت كوم");
  if (!altResult.success) { res.status(400).json({ error: "النص البديل غير صحيح" }); return; }
  const [before] = await db.select().from(brandAssetsTable).where(eq(brandAssetsTable.kind, kindResult.data));
  const stored = await imageStorage.saveBrandAsset(req.file.buffer, req.file.mimetype);
  try {
    const [asset] = await db.insert(brandAssetsTable).values({ kind: kindResult.data, url: stored.url, storageKey: stored.storageKey, mimeType: stored.mimeType, width: stored.width, height: stored.height, sizeBytes: stored.size, variants: stored.variants, altTextAr: altResult.data }).onConflictDoUpdate({ target: brandAssetsTable.kind, set: { url: stored.url, storageKey: stored.storageKey, mimeType: stored.mimeType, width: stored.width, height: stored.height, sizeBytes: stored.size, variants: stored.variants, altTextAr: altResult.data, updatedAt: new Date() } }).returning();
    if (before?.storageKey) await imageStorage.deleteImage(before.storageKey).catch(() => undefined);
    await writeAuditLog(req, { action: before ? "branding.asset_replace" : "branding.asset_upload", entityType: "brand_asset", entityId: kindResult.data, description: `حفظ شعار ${kindResult.data}`, beforeData: before ?? null, afterData: asset });
    res.status(before ? 200 : 201).json(asset);
  } catch (error) { await imageStorage.deleteImage(stored.storageKey).catch(() => undefined); throw error; }
});
router.delete("/admin/content/branding/:kind", requireAdminPermission("branding.manage"), async (req, res): Promise<void> => {
  const kindResult = brandKindSchema.safeParse(Array.isArray(req.params.kind) ? req.params.kind[0] : req.params.kind);
  if (!kindResult.success) { res.status(400).json({ error: "نوع الشعار غير صحيح" }); return; }
  const [asset] = await db.delete(brandAssetsTable).where(eq(brandAssetsTable.kind, kindResult.data)).returning();
  if (!asset) { res.status(404).json({ error: "لا يوجد شعار مخصص لهذا الاستخدام" }); return; }
  await imageStorage.deleteImage(asset.storageKey);
  await writeAuditLog(req, { action: "branding.asset_restore_default", entityType: "brand_asset", entityId: kindResult.data, description: `استعادة الشعار الافتراضي لـ ${kindResult.data}`, beforeData: asset });
  res.sendStatus(204);
});

router.get("/admin/content/faqs", requireAdminPermission("content.view"), async (_req, res) => res.json(await db.select().from(faqsTable).orderBy(asc(faqsTable.sortOrder))));
router.post("/admin/content/faqs", requireAdminPermission("content.manage"), async (req, res) => { const input = parseBody(faqSchema, req.body, res); if (!input) return; const [row] = await db.insert(faqsTable).values(input).returning(); res.status(201).json(row); });
router.patch("/admin/content/faqs/:id", requireAdminPermission("content.manage"), async (req, res) => { const input = parseBody(faqSchema.partial(), req.body, res); if (!input) return; const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id); const [row] = await db.update(faqsTable).set(input).where(eq(faqsTable.id, id)).returning(); res.json(row); });
router.delete("/admin/content/faqs/:id", requireAdminPermission("content.manage"), async (req, res) => { const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id); await db.delete(faqsTable).where(eq(faqsTable.id, id)); res.sendStatus(204); });

export default router;
