import { Router, type IRouter } from "express";
import { couponsTable, db } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "@workspace/api-zod";
import { requireAdminAuth, requireAdminPermission } from "../../lib/auth";
import { parseBody } from "../../lib/validation";
import { writeAuditLog } from "../../services/audit";

const router: IRouter = Router();
router.use(requireAdminAuth);

const couponFields = {
  code: z.string().trim().min(2).max(50).transform(value => value.toUpperCase()),
  type: z.enum(["percentage", "fixed", "free_shipping"]),
  value: z.coerce.number().min(0),
  minOrderAmount: z.coerce.number().min(0).nullable().optional(),
  maxUses: z.coerce.number().int().min(0).nullable().optional(),
  perCustomerLimit: z.coerce.number().int().positive().nullable().optional(),
  productIds: z.array(z.coerce.number().int().positive()).max(500).optional(),
  categoryIds: z.array(z.coerce.number().int().positive()).max(100).optional(),
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
  isActive: z.boolean().optional(),
};
const createCouponSchema = z.object(couponFields).superRefine((value, ctx) => {
  if (value.type === "percentage" && value.value > 100) ctx.addIssue({ code: "custom", path: ["value"], message: "نسبة الخصم يجب ألا تتجاوز 100" });
  if (value.startDate && value.endDate && value.endDate < value.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "تاريخ النهاية يسبق البداية" });
});
const updateCouponSchema = z.object(couponFields).partial().superRefine((value, ctx) => {
  if (value.type === "percentage" && value.value != null && value.value > 100) ctx.addIssue({ code: "custom", path: ["value"], message: "نسبة الخصم يجب ألا تتجاوز 100" });
});

function mapCoupon(coupon: typeof couponsTable.$inferSelect) {
  return { ...coupon, value: Number(coupon.value), minOrderAmount: coupon.minOrderAmount == null ? null : Number(coupon.minOrderAmount) };
}

router.get("/admin/coupons", requireAdminPermission("coupons.view"), async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
  const [items, [{ count }]] = await Promise.all([
    db.select().from(couponsTable).limit(limit).offset((page - 1) * limit),
    db.select({ count: sql<number>`count(*)::int` }).from(couponsTable),
  ]);
  res.json({ items: items.map(mapCoupon), total: count, page, limit });
});

router.post("/admin/coupons", requireAdminPermission("coupons.manage"), async (req, res): Promise<void> => {
  const input = parseBody(createCouponSchema, req.body, res); if (!input) return;
  const [coupon] = await db.insert(couponsTable).values({
    ...input, value: String(input.value),
    minOrderAmount: input.minOrderAmount == null ? null : String(input.minOrderAmount),
    productIds: input.productIds ?? [], categoryIds: input.categoryIds ?? [],
  }).returning();
  await writeAuditLog(req, { action: "coupon.create", entityType: "coupon", entityId: coupon.id, description: `إنشاء الكوبون ${coupon.code}` });
  res.status(201).json(mapCoupon(coupon));
});

router.patch("/admin/coupons/:id", requireAdminPermission("coupons.manage"), async (req, res): Promise<void> => {
  const input = parseBody(updateCouponSchema, req.body, res); if (!input) return;
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const [existing] = await db.select().from(couponsTable).where(eq(couponsTable.id, id));
  if (!existing) { res.status(404).json({ error: "الكوبون غير موجود" }); return; }
  const resultingType = input.type ?? existing.type;
  const resultingValue = input.value ?? Number(existing.value);
  if (resultingType === "percentage" && resultingValue > 100) { res.status(400).json({ error: "نسبة الخصم يجب ألا تتجاوز 100" }); return; }
  const { value, minOrderAmount, ...updates } = input;
  const [coupon] = await db.update(couponsTable).set({
    ...updates,
    ...(value != null && { value: String(value) }),
    ...(minOrderAmount !== undefined && { minOrderAmount: minOrderAmount == null ? null : String(minOrderAmount) }),
  }).where(eq(couponsTable.id, id)).returning();
  await writeAuditLog(req, { action: "coupon.update", entityType: "coupon", entityId: id, description: `تعديل الكوبون ${coupon.code}` });
  res.json(mapCoupon(coupon));
});

router.delete("/admin/coupons/:id", requireAdminPermission("coupons.manage"), async (req, res): Promise<void> => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const [coupon] = await db.update(couponsTable).set({ isActive: false }).where(eq(couponsTable.id, id)).returning();
  if (!coupon) { res.status(404).json({ error: "الكوبون غير موجود" }); return; }
  await writeAuditLog(req, { action: "coupon.disable", entityType: "coupon", entityId: id, description: `تعطيل الكوبون ${coupon.code}` });
  res.sendStatus(204);
});

export default router;
