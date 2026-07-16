import { Router, type IRouter } from "express";
import { auditLogsTable, bannersTable, db, faqsTable, siteSettingsTable, usersTable } from "@workspace/db";
import { asc, desc, eq } from "drizzle-orm";
import { requireAdminAuth, requireAdminPermission, hashPassword } from "../../lib/auth";
import { writeAuditLog } from "../../services/audit";

const router: IRouter = Router();
router.use(requireAdminAuth);

router.get("/admin/audit-logs", requireAdminPermission("reports.view"), async (_req, res) => {
  res.json(await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(100));
});

router.get("/admin/employees", requireAdminPermission("employees.manage"), async (_req, res) => {
  const rows = await db.select().from(usersTable).orderBy(asc(usersTable.name));
  res.json(rows.map(({ passwordHash: _passwordHash, ...user }) => user));
});

router.post("/admin/employees", requireAdminPermission("employees.manage"), async (req, res): Promise<void> => {
  const { name, email, password, role, permissions } = req.body;
  if (!name || !email || typeof password !== "string" || password.length < 8) { res.status(400).json({ error: "الاسم والبريد وكلمة مرور من 8 أحرف مطلوبة" }); return; }
  const [user] = await db.insert(usersTable).values({ name, email: email.toLowerCase(), passwordHash: await hashPassword(password), role: role || "sales", permissions: Array.isArray(permissions) ? permissions : [] }).returning();
  await writeAuditLog(req, { action: "employee.create", entityType: "employee", entityId: user.id, description: `إضافة الموظف ${user.name}` });
  const { passwordHash: _passwordHash, ...safeUser } = user;
  res.status(201).json(safeUser);
});

router.patch("/admin/employees/:id", requireAdminPermission("employees.manage"), async (req, res): Promise<void> => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  if (id === req.session.adminId && req.body.isActive === false) { res.status(400).json({ error: "لا يمكنك تعطيل حسابك الحالي" }); return; }
  const { password, ...updates } = req.body;
  const [user] = await db.update(usersTable).set({ ...updates, ...(password ? { passwordHash: await hashPassword(password) } : {}) }).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "الموظف غير موجود" }); return; }
  await writeAuditLog(req, { action: "employee.update", entityType: "employee", entityId: id, description: `تعديل الموظف ${user.name}` });
  const { passwordHash: _passwordHash, ...safeUser } = user;
  res.json(safeUser);
});

router.get("/admin/content/settings", requireAdminPermission("content.manage"), async (_req, res) => res.json(await db.select().from(siteSettingsTable).orderBy(asc(siteSettingsTable.key))));
router.put("/admin/content/settings/:key", requireAdminPermission("content.manage"), async (req, res) => {
  const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
  const [row] = await db.insert(siteSettingsTable).values({ key, value: String(req.body.value ?? "") }).onConflictDoUpdate({ target: siteSettingsTable.key, set: { value: String(req.body.value ?? ""), updatedAt: new Date() } }).returning();
  await writeAuditLog(req, { action: "content.setting_update", entityType: "setting", entityId: key, description: `تعديل إعداد ${key}` });
  res.json(row);
});
router.get("/admin/content/banners", requireAdminPermission("content.manage"), async (_req, res) => res.json(await db.select().from(bannersTable).orderBy(asc(bannersTable.sortOrder))));
router.post("/admin/content/banners", requireAdminPermission("content.manage"), async (req, res) => { const [row] = await db.insert(bannersTable).values(req.body).returning(); res.status(201).json(row); });
router.patch("/admin/content/banners/:id", requireAdminPermission("content.manage"), async (req, res) => { const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id); const [row] = await db.update(bannersTable).set(req.body).where(eq(bannersTable.id, id)).returning(); res.json(row); });
router.get("/admin/content/faqs", requireAdminPermission("content.manage"), async (_req, res) => res.json(await db.select().from(faqsTable).orderBy(asc(faqsTable.sortOrder))));
router.post("/admin/content/faqs", requireAdminPermission("content.manage"), async (req, res) => { const [row] = await db.insert(faqsTable).values(req.body).returning(); res.status(201).json(row); });
router.patch("/admin/content/faqs/:id", requireAdminPermission("content.manage"), async (req, res) => { const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id); const [row] = await db.update(faqsTable).set(req.body).where(eq(faqsTable.id, id)).returning(); res.json(row); });

export default router;
