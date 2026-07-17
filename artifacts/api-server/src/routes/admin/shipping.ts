import { Router, type IRouter } from "express";
import { citiesTable, db, governoratesTable, usersTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { requireAdminAuth, requireAdminPermission } from "../../lib/auth";
import { writeAuditLog } from "../../services/audit";
import { parseBody } from "../../lib/validation";
import { z } from "@workspace/api-zod";

const router: IRouter = Router();
router.use(requireAdminAuth);

const deliveryRange = {
  minDeliveryDays: z.coerce.number().int().min(0, "الحد الأدنى لأيام التوصيل لا يمكن أن يكون سالبًا").max(90),
  maxDeliveryDays: z.coerce.number().int().min(0, "الحد الأقصى لأيام التوصيل لا يمكن أن يكون سالبًا").max(90),
};
const governorateFields = {
  shippingCost: z.coerce.number().min(0, "سعر الشحن لا يمكن أن يكون سالبًا"),
  remoteAreaSurcharge: z.coerce.number().min(0, "إضافة المنطقة لا يمكن أن تكون سالبة").optional(),
  freeShippingThreshold: z.coerce.number().min(0, "حد الشحن المجاني لا يمكن أن يكون سالبًا").nullable().optional(),
  ...deliveryRange,
  shippingNotes: z.string().trim().max(2000).nullable().optional(),
  deliveryAvailable: z.boolean().optional(), isActive: z.boolean().optional(),
};
const governorateUpdateSchema = z.object(governorateFields).partial().superRefine((value, ctx) => {
  if (value.minDeliveryDays != null && value.maxDeliveryDays != null && value.maxDeliveryDays < value.minDeliveryDays) ctx.addIssue({ code: "custom", path: ["maxDeliveryDays"], message: "الحد الأقصى يجب أن يساوي أو يزيد عن الحد الأدنى" });
});
const governorateBulkItemSchema = z.object({ id: z.coerce.number().int().positive(), ...governorateFields }).superRefine((value, ctx) => {
  if (value.maxDeliveryDays < value.minDeliveryDays) ctx.addIssue({ code: "custom", path: ["maxDeliveryDays"], message: "الحد الأقصى يجب أن يساوي أو يزيد عن الحد الأدنى" });
});
const governorateBulkSchema = z.array(governorateBulkItemSchema).min(1).max(27);
const cityCreateSchema = z.object({
  nameAr: z.string().trim().min(2).max(200), nameEn: z.string().trim().max(200).nullable().optional(),
  shippingPriceOverride: z.coerce.number().min(0, "سعر المدينة لا يمكن أن يكون سالبًا").nullable().optional(),
  surcharge: z.coerce.number().min(0, "إضافة المدينة لا يمكن أن تكون سالبة").default(0),
  minDeliveryDays: z.coerce.number().int().min(0).max(90).nullable().optional(),
  maxDeliveryDays: z.coerce.number().int().min(0).max(90).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(), isActive: z.boolean().optional(),
}).superRefine((value, ctx) => {
  if ((value.minDeliveryDays == null) !== (value.maxDeliveryDays == null)) ctx.addIssue({ code: "custom", path: ["maxDeliveryDays"], message: "أدخل الحد الأدنى والأقصى معًا أو اتركهما لاستخدام إعداد المحافظة" });
  if (value.minDeliveryDays != null && value.maxDeliveryDays != null && value.maxDeliveryDays < value.minDeliveryDays) ctx.addIssue({ code: "custom", path: ["maxDeliveryDays"], message: "الحد الأقصى يجب أن يساوي أو يزيد عن الحد الأدنى" });
});
const cityUpdateSchema = cityCreateSchema.partial().superRefine((value, ctx) => {
  if (value.minDeliveryDays != null && value.maxDeliveryDays != null && value.maxDeliveryDays < value.minDeliveryDays) ctx.addIssue({ code: "custom", path: ["maxDeliveryDays"], message: "الحد الأقصى يجب أن يساوي أو يزيد عن الحد الأدنى" });
});

function mapGovernorate(row: typeof governoratesTable.$inferSelect & { updatedByName?: string | null }) {
  return { ...row, shippingCost: Number(row.shippingCost), remoteAreaSurcharge: Number(row.remoteAreaSurcharge), freeShippingThreshold: row.freeShippingThreshold == null ? null : Number(row.freeShippingThreshold) };
}
function mapCity(row: typeof citiesTable.$inferSelect) {
  return { ...row, shippingPriceOverride: row.shippingPriceOverride == null ? null : Number(row.shippingPriceOverride), surcharge: Number(row.surcharge) };
}

router.get("/admin/shipping/governorates", requireAdminPermission("shipping.view"), async (_req, res) => {
  const rows = await db.select({ governorate: governoratesTable, updatedByName: usersTable.name }).from(governoratesTable).leftJoin(usersTable, eq(governoratesTable.updatedBy, usersTable.id)).orderBy(asc(governoratesTable.nameAr));
  res.json(rows.map(({ governorate, updatedByName }) => mapGovernorate({ ...governorate, updatedByName })));
});

router.patch("/admin/shipping/governorates/:id", requireAdminPermission("shipping.edit"), async (req, res): Promise<void> => {
  const input = parseBody(governorateUpdateSchema, req.body, res); if (!input) return;
  const id = Number(req.params.id);
  const [before] = await db.select().from(governoratesTable).where(eq(governoratesTable.id, id));
  if (!before) { res.status(404).json({ error: "المحافظة غير موجودة" }); return; }
  const min = input.minDeliveryDays ?? before.minDeliveryDays; const max = input.maxDeliveryDays ?? before.maxDeliveryDays;
  if (max < min) { res.status(400).json({ error: "الحد الأقصى لأيام التوصيل يجب أن يساوي أو يزيد عن الحد الأدنى" }); return; }
  const [updated] = await db.update(governoratesTable).set({
    ...(input.shippingCost !== undefined && { shippingCost: String(input.shippingCost) }),
    ...(input.remoteAreaSurcharge !== undefined && { remoteAreaSurcharge: String(input.remoteAreaSurcharge) }),
    ...(input.freeShippingThreshold !== undefined && { freeShippingThreshold: input.freeShippingThreshold == null ? null : String(input.freeShippingThreshold) }),
    ...(input.minDeliveryDays !== undefined && { minDeliveryDays: input.minDeliveryDays }), ...(input.maxDeliveryDays !== undefined && { maxDeliveryDays: input.maxDeliveryDays }),
    ...(input.shippingNotes !== undefined && { shippingNotes: input.shippingNotes }), ...(input.deliveryAvailable !== undefined && { deliveryAvailable: input.deliveryAvailable }),
    ...(input.isActive !== undefined && { isActive: input.isActive }), estimatedDays: max, updatedBy: req.session.adminId,
  }).where(eq(governoratesTable.id, id)).returning();
  await writeAuditLog(req, { action: "shipping.update", entityType: "governorate", entityId: id, description: `تعديل إعدادات شحن ${updated.nameAr}`, beforeData: before, afterData: updated });
  res.json(mapGovernorate(updated));
});

router.patch("/admin/shipping/governorates", requireAdminPermission("shipping.edit"), async (req, res): Promise<void> => {
  const updates = parseBody(governorateBulkSchema, req.body, res); if (!updates) return;
  const results = await db.transaction(async tx => {
    const rows = [];
    for (const update of updates) {
      const [existing] = await tx.select().from(governoratesTable).where(eq(governoratesTable.id, update.id)).for("update");
      if (!existing) throw new Error(`المحافظة رقم ${update.id} غير موجودة`);
      const [row] = await tx.update(governoratesTable).set({
        shippingCost: String(update.shippingCost), remoteAreaSurcharge: String(update.remoteAreaSurcharge ?? existing.remoteAreaSurcharge),
        freeShippingThreshold: update.freeShippingThreshold == null ? null : String(update.freeShippingThreshold),
        minDeliveryDays: update.minDeliveryDays, maxDeliveryDays: update.maxDeliveryDays, estimatedDays: update.maxDeliveryDays,
        shippingNotes: update.shippingNotes ?? null, deliveryAvailable: update.deliveryAvailable ?? existing.deliveryAvailable,
        isActive: update.isActive ?? existing.isActive, updatedBy: req.session.adminId,
      }).where(eq(governoratesTable.id, update.id)).returning();
      rows.push(row);
    }
    return rows;
  });
  await writeAuditLog(req, { action: "shipping.bulk_update", entityType: "governorate", description: `حفظ إعدادات شحن ${results.length} محافظة`, afterData: { ids: results.map(row => row.id) } });
  res.json(results.map(mapGovernorate));
});

router.get("/admin/shipping/governorates/:id/cities", requireAdminPermission("shipping.view"), async (req, res) => {
  const rows = await db.select().from(citiesTable).where(eq(citiesTable.governorateId, Number(req.params.id))).orderBy(asc(citiesTable.nameAr));
  res.json(rows.map(mapCity));
});

router.post("/admin/shipping/governorates/:id/cities", requireAdminPermission("shipping.edit"), async (req, res): Promise<void> => {
  const input = parseBody(cityCreateSchema, req.body, res); if (!input) return;
  const [city] = await db.insert(citiesTable).values({ governorateId: Number(req.params.id), nameAr: input.nameAr, nameEn: input.nameEn || null, shippingPriceOverride: input.shippingPriceOverride == null ? null : String(input.shippingPriceOverride), surcharge: String(input.surcharge), minDeliveryDays: input.minDeliveryDays ?? null, maxDeliveryDays: input.maxDeliveryDays ?? null, notes: input.notes ?? null, updatedBy: req.session.adminId, isActive: input.isActive !== false }).returning();
  await writeAuditLog(req, { action: "shipping.city_create", entityType: "city", entityId: city.id, description: `إضافة مدينة ${city.nameAr}`, afterData: city });
  res.status(201).json(mapCity(city));
});

router.patch("/admin/shipping/cities/:id", requireAdminPermission("shipping.edit"), async (req, res): Promise<void> => {
  const input = parseBody(cityUpdateSchema, req.body, res); if (!input) return;
  const id = Number(req.params.id); const [before] = await db.select().from(citiesTable).where(eq(citiesTable.id, id));
  if (!before) { res.status(404).json({ error: "المدينة غير موجودة" }); return; }
  const min = input.minDeliveryDays === undefined ? before.minDeliveryDays : input.minDeliveryDays; const max = input.maxDeliveryDays === undefined ? before.maxDeliveryDays : input.maxDeliveryDays;
  if ((min == null) !== (max == null) || (min != null && max != null && max < min)) { res.status(400).json({ error: "نطاق أيام توصيل المدينة غير صحيح" }); return; }
  const [city] = await db.update(citiesTable).set({
    ...(input.nameAr !== undefined && { nameAr: input.nameAr }), ...(input.nameEn !== undefined && { nameEn: input.nameEn }),
    ...(input.shippingPriceOverride !== undefined && { shippingPriceOverride: input.shippingPriceOverride == null ? null : String(input.shippingPriceOverride) }),
    ...(input.surcharge !== undefined && { surcharge: String(input.surcharge) }), ...(input.minDeliveryDays !== undefined && { minDeliveryDays: input.minDeliveryDays }),
    ...(input.maxDeliveryDays !== undefined && { maxDeliveryDays: input.maxDeliveryDays }), ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.isActive !== undefined && { isActive: input.isActive }), updatedBy: req.session.adminId,
  }).where(eq(citiesTable.id, id)).returning();
  await writeAuditLog(req, { action: "shipping.city_update", entityType: "city", entityId: id, description: `تعديل مدينة ${city.nameAr}`, beforeData: before, afterData: city });
  res.json(mapCity(city));
});

export default router;
