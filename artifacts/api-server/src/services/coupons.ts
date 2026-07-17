import { couponUsageTable, couponsTable, db } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

export type CouponItem = {
  productId: number;
  categoryId: number | null;
  quantity: number;
  unitPrice: number;
};

export type CouponApplication = {
  couponId: number;
  code: string;
  discount: number;
  freeShipping: boolean;
  eligibleValue: number;
};

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Transaction;

export class CouponValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "CouponValidationError";
  }
}

function couponDate(value: string | null, endOfDay = false): Date | null {
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = new Date(dateOnly ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z` : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function validateCoupon(
  code: string,
  input: { subtotal: number; items: CouponItem[]; customerId?: number | null; now?: Date },
  options: { executor?: Executor; lock?: boolean } = {},
): Promise<CouponApplication> {
  const executor = options.executor ?? db;
  const normalizedCode = code.trim().toUpperCase();
  const baseQuery = executor.select().from(couponsTable).where(sql`lower(${couponsTable.code}) = lower(${normalizedCode})`).limit(1);
  const rows = options.lock ? await baseQuery.for("update") : await baseQuery;
  const coupon = rows[0];
  if (!coupon || !coupon.isActive) throw new CouponValidationError("INACTIVE", "كود الخصم غير صالح أو غير نشط");

  const now = input.now ?? new Date();
  const startsAt = couponDate(coupon.startDate);
  const endsAt = couponDate(coupon.endDate, true);
  if (coupon.startDate && !startsAt) throw new CouponValidationError("INVALID_DATE", "تاريخ بداية الكوبون غير صحيح");
  if (coupon.endDate && !endsAt) throw new CouponValidationError("INVALID_DATE", "تاريخ نهاية الكوبون غير صحيح");
  if (startsAt && now < startsAt) throw new CouponValidationError("NOT_STARTED", "الكوبون لم يبدأ بعد");
  if (endsAt && now > endsAt) throw new CouponValidationError("EXPIRED", "انتهت صلاحية الكوبون");
  if (coupon.minOrderAmount != null && input.subtotal < Number(coupon.minOrderAmount)) {
    throw new CouponValidationError("MIN_ORDER", `الحد الأدنى لاستخدام الكوبون ${Number(coupon.minOrderAmount)} ج.م`);
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    throw new CouponValidationError("MAX_USES", "تم استنفاد عدد استخدامات الكوبون");
  }

  if (coupon.perCustomerLimit != null && input.customerId) {
    const [usage] = await executor.select({ count: sql<number>`count(*)::int` }).from(couponUsageTable).where(and(
      eq(couponUsageTable.couponId, coupon.id),
      eq(couponUsageTable.customerId, input.customerId),
    ));
    if (usage.count >= coupon.perCustomerLimit) throw new CouponValidationError("CUSTOMER_LIMIT", "تم استنفاد استخداماتك لهذا الكوبون");
  }

  const restrictedProducts = new Set(coupon.productIds);
  const restrictedCategories = new Set(coupon.categoryIds);
  const hasRestrictions = restrictedProducts.size > 0 || restrictedCategories.size > 0;
  const eligibleValue = input.items.reduce((total, item) => {
    const eligible = !hasRestrictions || restrictedProducts.has(item.productId) || (item.categoryId != null && restrictedCategories.has(item.categoryId));
    return eligible ? total + item.unitPrice * item.quantity : total;
  }, 0);
  if (eligibleValue <= 0) throw new CouponValidationError("NO_ELIGIBLE_ITEMS", "الكوبون لا ينطبق على منتجات السلة");

  const value = Number(coupon.value);
  if (!Number.isFinite(value) || value < 0) throw new CouponValidationError("INVALID_VALUE", "قيمة الكوبون غير صحيحة");
  if (coupon.type === "percentage" && value > 100) throw new CouponValidationError("INVALID_PERCENTAGE", "نسبة الخصم يجب أن تكون بين 0 و100");

  const discount = coupon.type === "percentage"
    ? eligibleValue * value / 100
    : coupon.type === "fixed" ? Math.min(value, eligibleValue) : 0;

  return {
    couponId: coupon.id,
    code: coupon.code,
    discount: Math.max(0, Math.min(discount, eligibleValue)),
    freeShipping: coupon.type === "free_shipping",
    eligibleValue,
  };
}

export async function recordCouponUsage(
  tx: Transaction,
  application: CouponApplication,
  orderId: number,
  customerId?: number | null,
): Promise<void> {
  const updated = await tx.update(couponsTable)
    .set({ usedCount: sql`${couponsTable.usedCount} + 1` })
    .where(and(
      eq(couponsTable.id, application.couponId),
      sql`${couponsTable.maxUses} IS NULL OR ${couponsTable.usedCount} < ${couponsTable.maxUses}`,
    ))
    .returning({ id: couponsTable.id });
  if (!updated.length) throw new CouponValidationError("MAX_USES", "تم استنفاد عدد استخدامات الكوبون");
  await tx.insert(couponUsageTable).values({
    couponId: application.couponId,
    orderId,
    customerId: customerId ?? null,
    discountAmount: String(application.discount),
  });
}
