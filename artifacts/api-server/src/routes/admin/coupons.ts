import { Router, type IRouter } from "express";
import { couponUsageTable, couponsTable, db } from "@workspace/db";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "@workspace/api-zod";
import { requireAdminAuth, requireAdminPermission } from "../../lib/auth";
import { parseBody } from "../../lib/validation";
import { writeAuditLog } from "../../services/audit";

const router: IRouter = Router();
router.use(requireAdminAuth);

const couponFields = {
  code: z.string().trim().min(2).max(50).transform(value => value.toUpperCase()),
  type: z.enum(["percentage", "fixed", "free_shipping"]), value: z.coerce.number().min(0),
  minOrderAmount: z.coerce.number().min(0).nullable().optional(), maxUses: z.coerce.number().int().min(0).nullable().optional(),
  perCustomerLimit: z.coerce.number().int().positive().nullable().optional(), productIds: z.array(z.coerce.number().int().positive()).max(500).optional(),
  categoryIds: z.array(z.coerce.number().int().positive()).max(100).optional(), startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(), isActive: z.boolean().optional(),
};
function validateCouponDates(value: { type?: string; value?: number; startDate?: string | null; endDate?: string | null }, ctx: z.RefinementCtx) {
  if (value.type === "percentage" && value.value != null && value.value > 100) ctx.addIssue({ code: "custom", path: ["value"], message: "نسبة الخصم يجب ألا تتجاوز 100" });
  if (value.startDate && value.endDate && value.endDate < value.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "تاريخ النهاية يجب ألا يسبق تاريخ البداية" });
}
const createCouponSchema = z.object(couponFields).superRefine(validateCouponDates);
const updateCouponSchema = z.object(couponFields).partial().superRefine(validateCouponDates);
const duplicateSchema = z.object({ code: couponFields.code.optional() });
const listSchema = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(1).max(100).default(20), q: z.string().trim().max(100).optional(), status: z.enum(["all", "active", "inactive", "archived", "expired", "scheduled"]).default("all"), type: z.enum(["all", "percentage", "fixed", "free_shipping"]).default("all"), validFrom: z.string().date().optional(), validTo: z.string().date().optional(), sort: z.enum(["newest", "code", "usage"]).default("newest") });

function mapCoupon(coupon: typeof couponsTable.$inferSelect) {
  return { ...coupon, value: Number(coupon.value), minOrderAmount: coupon.minOrderAmount == null ? null : Number(coupon.minOrderAmount) };
}

router.get("/admin/coupons", requireAdminPermission("coupons.view"), async (req, res): Promise<void> => {
  const query = parseBody(listSchema, req.query, res); if (!query) return;
  const today = new Date().toISOString().slice(0, 10); const conditions = [];
  if (query.q) conditions.push(ilike(couponsTable.code, `%${query.q}%`));
  if (query.type !== "all") conditions.push(eq(couponsTable.type, query.type));
  if (query.status === "active") conditions.push(and(eq(couponsTable.isActive, true), sql`${couponsTable.archivedAt} is null`, sql`(${couponsTable.startDate} is null or ${couponsTable.startDate} <= ${today})`, sql`(${couponsTable.endDate} is null or ${couponsTable.endDate} >= ${today})`));
  if (query.status === "inactive") conditions.push(and(eq(couponsTable.isActive, false), sql`${couponsTable.archivedAt} is null`));
  if (query.status === "archived") conditions.push(sql`${couponsTable.archivedAt} is not null`);
  if (query.status === "expired") conditions.push(sql`${couponsTable.endDate} < ${today}`);
  if (query.status === "scheduled") conditions.push(sql`${couponsTable.startDate} > ${today}`);
  if (query.validFrom) conditions.push(sql`(${couponsTable.endDate} is null or ${couponsTable.endDate} >= ${query.validFrom})`);
  if (query.validTo) conditions.push(sql`(${couponsTable.startDate} is null or ${couponsTable.startDate} <= ${query.validTo})`);
  const where = conditions.length ? and(...conditions) : undefined;
  const order = query.sort === "code" ? asc(couponsTable.code) : query.sort === "usage" ? desc(couponsTable.usedCount) : desc(couponsTable.createdAt);
  const [items, [{ count }]] = await Promise.all([
    db.select().from(couponsTable).where(where).orderBy(order).limit(query.limit).offset((query.page - 1) * query.limit),
    db.select({ count: sql<number>`count(*)::int` }).from(couponsTable).where(where),
  ]);
  res.json({ items: items.map(mapCoupon), total: count, page: query.page, limit: query.limit });
});

router.post("/admin/coupons", requireAdminPermission("coupons.manage"), async (req, res): Promise<void> => {
  const input = parseBody(createCouponSchema, req.body, res); if (!input) return;
  const [coupon] = await db.insert(couponsTable).values({ ...input, value: String(input.value), minOrderAmount: input.minOrderAmount == null ? null : String(input.minOrderAmount), productIds: input.productIds ?? [], categoryIds: input.categoryIds ?? [] }).returning();
  await writeAuditLog(req, { action: "coupon.create", entityType: "coupon", entityId: coupon.id, description: `إنشاء الكوبون ${coupon.code}`, afterData: coupon });
  res.status(201).json(mapCoupon(coupon));
});

router.patch("/admin/coupons/:id", requireAdminPermission("coupons.manage"), async (req, res): Promise<void> => {
  const input = parseBody(updateCouponSchema, req.body, res); if (!input) return;
  const id = Number(req.params.id); const [existing] = await db.select().from(couponsTable).where(eq(couponsTable.id, id));
  if (!existing) { res.status(404).json({ error: "الكوبون غير موجود" }); return; }
  const type = input.type ?? existing.type; const value = input.value ?? Number(existing.value); const start = input.startDate === undefined ? existing.startDate : input.startDate; const end = input.endDate === undefined ? existing.endDate : input.endDate;
  if (type === "percentage" && value > 100) { res.status(400).json({ error: "نسبة الخصم يجب ألا تتجاوز 100" }); return; }
  if (start && end && end < start) { res.status(400).json({ error: "تاريخ النهاية يجب ألا يسبق تاريخ البداية" }); return; }
  const { value: nextValue, minOrderAmount, ...updates } = input;
  const [coupon] = await db.update(couponsTable).set({ ...updates, ...(nextValue !== undefined && { value: String(nextValue) }), ...(minOrderAmount !== undefined && { minOrderAmount: minOrderAmount == null ? null : String(minOrderAmount) }), ...(input.isActive === true && { archivedAt: null }) }).where(eq(couponsTable.id, id)).returning();
  await writeAuditLog(req, { action: input.isActive !== undefined ? "coupon.status" : "coupon.update", entityType: "coupon", entityId: id, description: `تعديل الكوبون ${coupon.code}`, beforeData: existing, afterData: coupon });
  res.json(mapCoupon(coupon));
});

router.post("/admin/coupons/:id/duplicate", requireAdminPermission("coupons.manage"), async (req, res): Promise<void> => {
  const input = parseBody(duplicateSchema, req.body, res); if (!input) return;
  const id = Number(req.params.id); const [source] = await db.select().from(couponsTable).where(eq(couponsTable.id, id));
  if (!source) { res.status(404).json({ error: "الكوبون غير موجود" }); return; }
  const code = input.code || `${source.code}-COPY-${Date.now().toString().slice(-6)}`;
  const [coupon] = await db.insert(couponsTable).values({ code, type: source.type, value: source.value, minOrderAmount: source.minOrderAmount, maxUses: source.maxUses, perCustomerLimit: source.perCustomerLimit, productIds: source.productIds, categoryIds: source.categoryIds, startDate: source.startDate, endDate: source.endDate, isActive: false }).returning();
  await writeAuditLog(req, { action: "coupon.duplicate", entityType: "coupon", entityId: coupon.id, description: `نسخ الكوبون ${source.code} إلى ${coupon.code}`, afterData: coupon });
  res.status(201).json(mapCoupon(coupon));
});

router.delete("/admin/coupons/:id", requireAdminPermission("coupons.manage"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const outcome = await db.transaction(async tx => {
    const [coupon] = await tx.select().from(couponsTable).where(eq(couponsTable.id, id)).for("update");
    if (!coupon) return null;
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(couponUsageTable).where(eq(couponUsageTable.couponId, id));
    if (count > 0 || coupon.usedCount > 0) {
      const [archived] = await tx.update(couponsTable).set({ isActive: false, archivedAt: new Date() }).where(eq(couponsTable.id, id)).returning();
      return { mode: "archived" as const, coupon: archived, usageCount: Math.max(count, coupon.usedCount) };
    }
    await tx.delete(couponsTable).where(eq(couponsTable.id, id));
    return { mode: "deleted" as const, coupon, usageCount: 0 };
  });
  if (!outcome) { res.status(404).json({ error: "الكوبون غير موجود" }); return; }
  await writeAuditLog(req, { action: `coupon.${outcome.mode}`, entityType: "coupon", entityId: id, description: `${outcome.mode === "archived" ? "أرشفة" : "حذف"} الكوبون ${outcome.coupon.code}`, beforeData: outcome.coupon });
  res.json({ mode: outcome.mode, usageCount: outcome.usageCount });
});

export default router;
