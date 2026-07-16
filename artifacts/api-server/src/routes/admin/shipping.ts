import { Router, type IRouter } from "express";
import { citiesTable, db, governoratesTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { requireAdminAuth, requireAdminPermission } from "../../lib/auth";
import { writeAuditLog } from "../../services/audit";
import { parseBody } from "../../lib/validation";
import { z } from "@workspace/api-zod";

const router: IRouter = Router();
router.use(requireAdminAuth);
const governorateUpdateSchema = z.object({ shippingCost: z.coerce.number().min(0).optional(), remoteAreaSurcharge: z.coerce.number().min(0).optional(), freeShippingThreshold: z.coerce.number().min(0).nullable().optional(), estimatedDays: z.coerce.number().int().positive().max(90).optional(), estimatedDeliveryText: z.string().max(500).nullable().optional(), shippingNotes: z.string().max(2000).nullable().optional(), deliveryAvailable: z.boolean().optional(), isActive: z.boolean().optional() });
const governorateBulkSchema = z.array(z.object({ id: z.coerce.number().int().positive(), shippingCost: z.coerce.number().min(0), freeShippingThreshold: z.coerce.number().min(0).nullable().optional(), isActive: z.boolean().optional() })).min(1).max(27);
const cityCreateSchema = z.object({ nameAr: z.string().trim().min(2).max(200), nameEn: z.string().trim().max(200).nullable().optional(), shippingPriceOverride: z.coerce.number().min(0).nullable().optional(), surcharge: z.coerce.number().min(0).default(0), isActive: z.boolean().optional() });
const cityUpdateSchema = cityCreateSchema.partial();

router.get("/admin/shipping/governorates", requireAdminPermission("shipping.view"), async (_req, res) => {
  const rows = await db.select().from(governoratesTable).orderBy(asc(governoratesTable.nameAr));
  res.json(rows.map(row => ({ ...row, shippingCost: Number(row.shippingCost), remoteAreaSurcharge: Number(row.remoteAreaSurcharge), freeShippingThreshold: row.freeShippingThreshold ? Number(row.freeShippingThreshold) : null })));
});

router.patch("/admin/shipping/governorates/:id", requireAdminPermission("shipping.edit"), async (req, res): Promise<void> => {
  const input = parseBody(governorateUpdateSchema, req.body, res); if (!input) return;
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const [before] = await db.select().from(governoratesTable).where(eq(governoratesTable.id, id));
  if (!before) { res.status(404).json({ error: "المحافظة غير موجودة" }); return; }
  const { shippingCost, remoteAreaSurcharge, freeShippingThreshold, estimatedDays, estimatedDeliveryText, shippingNotes, deliveryAvailable, isActive } = input;
  const [updated] = await db.update(governoratesTable).set({
    ...(shippingCost !== undefined && { shippingCost: String(Math.max(0, Number(shippingCost))) }),
    ...(remoteAreaSurcharge !== undefined && { remoteAreaSurcharge: String(Math.max(0, Number(remoteAreaSurcharge))) }),
    ...(freeShippingThreshold !== undefined && { freeShippingThreshold: freeShippingThreshold === null ? null : String(freeShippingThreshold) }),
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
  const updates = parseBody(governorateBulkSchema, req.body, res); if (!updates) return;
  const results = await db.transaction(async (tx) => {
    const rows = [];
    for (const update of updates) {
      const id = Number(update.id);
      const [row] = await tx.update(governoratesTable).set({ shippingCost: String(update.shippingCost), ...(update.freeShippingThreshold !== undefined && { freeShippingThreshold: update.freeShippingThreshold === null ? null : String(update.freeShippingThreshold) }), ...(update.isActive !== undefined && { isActive: update.isActive }), updatedBy: req.session.adminId }).where(eq(governoratesTable.id, id)).returning();
      if (!row) throw new Error(`Governorate ${id} not found`);
      rows.push(row);
    }
    return rows;
  });
  await writeAuditLog(req, { action: "shipping.bulk_update", entityType: "governorate", description: `تحديث أسعار شحن ${results.length} محافظة` });
  res.json(results);
});

router.get("/admin/shipping/governorates/:id/cities", requireAdminPermission("shipping.view"), async (req, res) => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  res.json(await db.select().from(citiesTable).where(eq(citiesTable.governorateId, id)).orderBy(asc(citiesTable.nameAr)));
});

router.post("/admin/shipping/governorates/:id/cities", requireAdminPermission("shipping.edit"), async (req, res): Promise<void> => {
  const input = parseBody(cityCreateSchema, req.body, res); if (!input) return;
  const governorateId = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const [city] = await db.insert(citiesTable).values({ governorateId, nameAr: input.nameAr, nameEn: input.nameEn || null, shippingPriceOverride: input.shippingPriceOverride == null ? null : String(input.shippingPriceOverride), surcharge: String(input.surcharge), isActive: input.isActive !== false }).returning();
  await writeAuditLog(req, { action: "shipping.city_create", entityType: "city", entityId: city.id, description: `إضافة مدينة ${city.nameAr}` });
  res.status(201).json(city);
});

router.patch("/admin/shipping/cities/:id", requireAdminPermission("shipping.edit"), async (req, res): Promise<void> => {
  const input = parseBody(cityUpdateSchema, req.body, res); if (!input) return;
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const { shippingPriceOverride, surcharge, ...updates } = input;
  const [city] = await db.update(citiesTable).set({ ...updates, ...(shippingPriceOverride !== undefined && { shippingPriceOverride: shippingPriceOverride == null ? null : String(shippingPriceOverride) }), ...(surcharge !== undefined && { surcharge: String(surcharge) }) }).where(eq(citiesTable.id, id)).returning();
  if (!city) { res.status(404).json({ error: "المدينة غير موجودة" }); return; }
  await writeAuditLog(req, { action: "shipping.city_update", entityType: "city", entityId: id, description: `تعديل مدينة ${city.nameAr}` });
  res.json(city);
});

export default router;
