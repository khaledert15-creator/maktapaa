import { Router, type IRouter } from "express";
import { db, governoratesTable, citiesTable, productsTable, couponsTable } from "@workspace/db";
import { eq, asc, and, inArray } from "drizzle-orm";
import { calculateShipping } from "../services/shipping";

const router: IRouter = Router();

router.get("/governorates", async (_req, res): Promise<void> => {
  const govs = await db.select().from(governoratesTable)
    .where(eq(governoratesTable.isActive, true))
    .orderBy(asc(governoratesTable.nameAr));
  res.json(govs.map(g => ({
    id: g.id, nameAr: g.nameAr, nameEn: g.nameEn,
    shippingCost: Number(g.shippingCost),
    freeShippingThreshold: g.freeShippingThreshold ? Number(g.freeShippingThreshold) : null,
    estimatedDays: g.estimatedDays, isActive: g.isActive,
  })));
});

router.get("/governorates/:id/cities", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const governorateId = Number(raw);
  const rows = await db.select().from(citiesTable)
    .where(and(eq(citiesTable.governorateId, governorateId), eq(citiesTable.isActive, true)))
    .orderBy(asc(citiesTable.nameAr));
  res.json(rows.map(city => ({
    id: city.id,
    governorateId: city.governorateId,
    nameAr: city.nameAr,
    surcharge: Number(city.surcharge),
    shippingPriceOverride: city.shippingPriceOverride ? Number(city.shippingPriceOverride) : null,
  })));
});

router.post("/shipping/quote", async (req, res): Promise<void> => {
  const governorateId = Number(req.body.governorateId);
  const cityName = typeof req.body.city === "string" ? req.body.city.trim() : "";
  const requestedItems = Array.isArray(req.body.items) ? req.body.items : req.session.cart?.items;
  if (!Number.isInteger(governorateId) || !Array.isArray(requestedItems) || requestedItems.length === 0) {
    res.status(400).json({ error: "المحافظة ومنتجات السلة مطلوبة لحساب الشحن" });
    return;
  }
  const [governorate] = await db.select().from(governoratesTable)
    .where(and(eq(governoratesTable.id, governorateId), eq(governoratesTable.isActive, true)));
  if (!governorate) { res.status(400).json({ error: "المحافظة غير متاحة للشحن" }); return; }

  const normalizedItems = requestedItems
    .map((item: { productId?: unknown; quantity?: unknown }) => ({ productId: Number(item.productId), quantity: Number(item.quantity) }))
    .filter((item: { productId: number; quantity: number }) => Number.isInteger(item.productId) && Number.isInteger(item.quantity) && item.quantity > 0);
  if (normalizedItems.length !== requestedItems.length) { res.status(400).json({ error: "بيانات السلة غير صحيحة" }); return; }
  const products = await db.select().from(productsTable).where(inArray(productsTable.id, normalizedItems.map(item => item.productId)));
  if (products.length !== new Set(normalizedItems.map(item => item.productId)).size) { res.status(400).json({ error: "أحد المنتجات غير متاح" }); return; }
  const productMap = new Map(products.map(product => [product.id, product]));
  const subtotal = normalizedItems.reduce((sum: number, item: { productId: number; quantity: number }) => sum + Number(productMap.get(item.productId)!.price) * item.quantity, 0);

  const [city] = cityName ? await db.select().from(citiesTable).where(and(
    eq(citiesTable.governorateId, governorateId),
    eq(citiesTable.nameAr, cityName),
    eq(citiesTable.isActive, true),
  )) : [];

  let freeShippingCoupon = false;
  const couponCode = typeof req.body.couponCode === "string" ? req.body.couponCode.trim() : req.session.cart?.couponCode;
  if (couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, couponCode));
    freeShippingCoupon = Boolean(coupon?.isActive && coupon.type === "free_shipping");
  }
  const calculation = calculateShipping({
    products: normalizedItems.map((item: { productId: number; quantity: number }) => {
      const product = productMap.get(item.productId)!;
      return { price: Number(product.price), quantity: item.quantity, freeShipping: product.freeShipping, freeShippingStartAt: product.freeShippingStartAt, freeShippingEndAt: product.freeShippingEndAt };
    }),
    subtotal,
    baseShippingCost: Number(governorate.shippingCost),
    governorateThreshold: governorate.freeShippingThreshold ? Number(governorate.freeShippingThreshold) : null,
    cityPriceOverride: city?.shippingPriceOverride ? Number(city.shippingPriceOverride) : null,
    surcharge: city ? Number(city.surcharge) : Number(governorate.remoteAreaSurcharge),
    freeShippingCoupon,
  });
  res.json({
    ...calculation,
    governorateId,
    governorateName: governorate.nameAr,
    city: cityName || null,
    cityId: city?.id ?? null,
    subtotal,
    estimatedDays: governorate.estimatedDays,
    estimatedDeliveryText: governorate.estimatedDeliveryText,
    snapshot: {
      rule: calculation.rule,
      governorateId,
      governorateName: governorate.nameAr,
      city: cityName || null,
      cityId: city?.id ?? null,
      baseCost: calculation.baseCost,
      surcharge: calculation.surcharge,
      discount: calculation.discount,
      finalCost: calculation.finalCost,
      calculatedAt: new Date().toISOString(),
    },
  });
});

export default router;
