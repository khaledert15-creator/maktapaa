import { Router, type IRouter } from "express";
import { citiesTable, db, governoratesTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { requireAdminAuth, requireAdminPermission } from "../../lib/auth";
import { writeAuditLog } from "../../services/audit";

const router: IRouter = Router();
router.use(requireAdminAuth);

router.get("/admin/shipping/governorates", requireAdminPermission("shipping.view"), async (_req, res) => {
  const rows = await db.select().from(governoratesTable).orderBy(asc(governoratesTable.nameAr));
  res.json(rows.map(row => ({ ...row, shippingCost: Number(row.shippingCost), remoteAreaSurcharge: Number(row.remoteAreaSurcharge), freeShippingThreshold: row.freeShippingThreshold ? Number(row.freeShippingThreshold) : null })));
});

router.patch("/admin/shipping/governorates/:id", requireAdminPermission("shipping.edit"), async (req, res): Promise<void> => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const [before] = await db.select().from(governoratesTable).where(eq(governoratesTable.id, id));
  if (!before) { res.status(404).json({ error: "المحافظة غير موجودة" }); return; }
  const { shippingCost, remoteAreaSurcharge, freeShippingThreshold, estimatedDays, estimatedDeliveryText, shippingNotes, deliveryAvailable, isActive } = req.body;
  const [updated] = await db.update(governoratesTable).set({
    ...(shippingCost !== undefined && { shippingCost: String(Math.max(0, Number(shippingCost))) }),
    ...(remoteAreaSurcharge !== undefined && { remoteAreaSurcharge: String(Math.max(0, Number(remoteAreaSurcharge))) }),
    ...(freeShippingThreshold !== undefined && { freeShippingThreshold: freeShippingThreshold === null || freeShippingThreshold === "" ? null : String(Math.max(0, Number(freeShippingThreshold))) }),
    ...(estimatedDays !== undefined && { estimatedDays: Math.max(1, Number(estimatedDays)) }),
    ...(estimatedDeliveryText !== undefined && { estimatedDeliveryText }),
    ...(shippingNotes !== undefined && { shippingNotes }),
    ...(deliveryAvailable !== undefined && { deliveryAvailable: Boolean(deliveryAvailable) }),
    ...(isActive !== undefined && { isActive: Boolean(isActive) }),
    updatedBy: req.session.adminId,
  }).where(eq(governoratesTable.id, id)).returning();
  await writeAuditLog(req, { action: "shipping.update", entityType: "governorate", entityId: id, description: `تعديل شحن ${updated.nameAr}`, beforeData: before, afterData: updated });
  res.json(updated);
});

router.patch("/admin/shipping/governorates", requireAdminPermission("shipping.edit"), async (req, res): Promise<void> => {
  const updates = Array.isArray(req.body) ? req.body : [];
  if (!updates.length || updates.length > 27) { res.status(400).json({ error: "قائمة التحديث غير صحيحة" }); return; }
  const results = [];
  for (const update of updates) {
    const id = Number(update.id);
    const [row] = await db.update(governoratesTable).set({ shippingCost: String(Math.max(0, Number(update.shippingCost))), ...(update.freeShippingThreshold !== undefined && { freeShippingThreshold: update.freeShippingThreshold === null || update.freeShippingThreshold === "" ? null : String(Math.max(0, Number(update.freeShippingThreshold))) }), ...(update.isActive !== undefined && { isActive: Boolean(update.isActive) }), updatedBy: req.session.adminId }).where(eq(governoratesTable.id, id)).returning();
    if (row) results.push(row);
  }
  await writeAuditLog(req, { action: "shipping.bulk_update", entityType: "governorate", description: `تحديث أسعار شحن ${results.length} محافظة` });
  res.json(results);
});

router.get("/admin/shipping/governorates/:id/cities", requireAdminPermission("shipping.view"), async (req, res) => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  res.json(await db.select().from(citiesTable).where(eq(citiesTable.governorateId, id)).orderBy(asc(citiesTable.nameAr)));
});

router.post("/admin/shipping/governorates/:id/cities", requireAdminPermission("shipping.edit"), async (req, res): Promise<void> => {
  const governorateId = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  if (!req.body.nameAr?.trim()) { res.status(400).json({ error: "اسم المدينة مطلوب" }); return; }
  const [city] = await db.insert(citiesTable).values({ governorateId, nameAr: req.body.nameAr.trim(), nameEn: req.body.nameEn || null, shippingPriceOverride: req.body.shippingPriceOverride === "" || req.body.shippingPriceOverride == null ? null : String(Number(req.body.shippingPriceOverride)), surcharge: String(Number(req.body.surcharge || 0)), isActive: req.body.isActive !== false }).returning();
  await writeAuditLog(req, { action: "shipping.city_create", entityType: "city", entityId: city.id, description: `إضافة مدينة ${city.nameAr}` });
  res.status(201).json(city);
});

router.patch("/admin/shipping/cities/:id", requireAdminPermission("shipping.edit"), async (req, res): Promise<void> => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const [city] = await db.update(citiesTable).set(req.body).where(eq(citiesTable.id, id)).returning();
  if (!city) { res.status(404).json({ error: "المدينة غير موجودة" }); return; }
  await writeAuditLog(req, { action: "shipping.city_update", entityType: "city", entityId: id, description: `تعديل مدينة ${city.nameAr}` });
  res.json(city);
});

export default router;
