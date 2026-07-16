import { Router, type IRouter } from "express";
import { db, ordersTable, orderItemsTable, orderStatusHistoryTable, cancellationRequestsTable, productsTable, governoratesTable, citiesTable, customersTable, stockMovementsTable, favoritesTable, addressesTable } from "@workspace/db";
import { eq, and, desc, gte, sql, inArray } from "drizzle-orm";
import { calculateShipping } from "../services/shipping";
import { enrichProductSummaries } from "../services/catalog";
import { CouponValidationError, recordCouponUsage, validateCoupon } from "../services/coupons";
import { parseBody } from "../lib/validation";
import { z } from "@workspace/api-zod";
import { rateLimit } from "../lib/rate-limit";

const router: IRouter = Router();
const orderRateLimit = rateLimit({ namespace: "order-create", windowMs: 15 * 60_000, max: 20 });
const orderCreateSchema = z.object({ customerName: z.string().trim().min(2).max(200), mobile: z.string().trim().min(8).max(30), altMobile: z.string().trim().max(30).nullable().optional(), governorateId: z.coerce.number().int().positive(), city: z.string().trim().min(2).max(200), detailedAddress: z.string().trim().min(5).max(2000), landmark: z.string().max(500).nullable().optional(), deliveryNotes: z.string().max(2000).nullable().optional(), orderNotes: z.string().max(2000).nullable().optional(), paymentMethod: z.literal("cash_on_delivery").optional(), couponCode: z.string().trim().max(50).transform(value => value.toUpperCase()).nullable().optional(), checkoutToken: z.string().min(12).max(100).nullable().optional(), cartItems: z.array(z.object({ productId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().positive().max(99) })).max(100).optional() });
const cancellationRequestSchema = z.object({ reason: z.string().trim().min(5).max(500) });
const profileSchema = z.object({ name: z.string().trim().min(2).max(200).optional(), email: z.string().email().max(200).nullable().optional(), mobile: z.string().trim().min(8).max(30).optional() });
const addressSchema = z.object({ governorateId: z.coerce.number().int().positive(), city: z.string().trim().min(2).max(200), detailedAddress: z.string().trim().min(5).max(2000), landmark: z.string().trim().max(500).nullable().optional(), isDefault: z.boolean().optional() });

function generateOrderNumber(): string {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `MK${y}${m}${d}-${rand}`;
}

function mapOrder(order: typeof ordersTable.$inferSelect, items: typeof orderItemsTable.$inferSelect[], history: typeof orderStatusHistoryTable.$inferSelect[]) {
  return {
    id: order.id, orderNumber: order.orderNumber,
    status: order.status, paymentStatus: order.paymentStatus, paymentMethod: order.paymentMethod,
    customerName: order.customerName, mobile: order.mobile, altMobile: order.altMobile,
    governorate: order.governorateName, city: order.city,
    detailedAddress: order.detailedAddress, landmark: order.landmark,
    deliveryNotes: order.deliveryNotes, orderNotes: order.orderNotes,
    subtotal: Number(order.subtotal), discount: Number(order.discount),
    couponDiscount: Number(order.couponDiscount), shippingCost: Number(order.shippingCost),
    couponCode: order.couponCode,
    shippingBaseCost: Number(order.shippingBaseCost),
    shippingSurcharge: Number(order.shippingSurcharge),
    shippingDiscount: Number(order.shippingDiscount),
    freeShippingReason: order.freeShippingReason,
    shippingRuleSnapshot: order.shippingRuleSnapshot,
    total: Number(order.total), estimatedDeliveryDate: order.estimatedDeliveryDate,
    trackingNumber: order.trackingNumber, shippingCompany: order.shippingCompany,
    items: items.map(i => ({
      productId: i.productId, nameAr: i.nameAr, coverImage: i.coverImage,
      quantity: i.quantity, unitPrice: Number(i.unitPrice),
      subtotal: Number(i.subtotal), discount: Number(i.discount),
    })),
    statusHistory: history.map(h => ({ status: h.status, notes: h.notes, createdAt: h.createdAt })),
    createdAt: order.createdAt,
  };
}

// Create order
router.post("/orders", orderRateLimit, async (req, res): Promise<void> => {
  const input = parseBody(orderCreateSchema, req.body, res); if (!input) return;
  const {
    customerName, mobile, altMobile, governorateId, city, detailedAddress,
    landmark, deliveryNotes, orderNotes, couponCode, checkoutToken,
  } = input;
  const cartItems = input.cartItems ?? req.session.cart?.items;

  if (checkoutToken) {
    const [existingOrder] = await db.select().from(ordersTable).where(eq(ordersTable.checkoutToken, checkoutToken));
    if (existingOrder) {
      const [items, history] = await Promise.all([
        db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, existingOrder.id)),
        db.select().from(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.orderId, existingOrder.id)),
      ]);
      res.json(mapOrder(existingOrder, items, history));
      return;
    }
  }

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    res.status(400).json({ error: "السلة فارغة" });
    return;
  }

  const [gov] = await db.select().from(governoratesTable).where(and(eq(governoratesTable.id, governorateId), eq(governoratesTable.isActive, true)));
  if (!gov) { res.status(400).json({ error: "المحافظة غير صحيحة" }); return; }

  // Load the complete cart in one query. Stock is checked again atomically in
  // the transaction below so this read is only used for validation and totals.
  let subtotal = 0;
  const resolvedItems: { product: typeof productsTable.$inferSelect; quantity: number }[] = [];
  const requestedProductIds = [...new Set(cartItems.map(item => item.productId))];
  const productRows = await db.select().from(productsTable).where(inArray(productsTable.id, requestedProductIds));
  const productMap = new Map(productRows.map(product => [product.id, product]));
  for (const ci of cartItems) {
    if (!Number.isInteger(ci.productId) || !Number.isInteger(ci.quantity) || ci.quantity < 1 || ci.quantity > 99) {
      res.status(400).json({ error: "بيانات كمية المنتج غير صحيحة" });
      return;
    }
    const product = productMap.get(ci.productId);
    if (!product || product.status !== "active") {
      res.status(400).json({ error: `المنتج غير متاح` });
      return;
    }
    if (product.stockQuantity < ci.quantity) {
      res.status(400).json({ error: `الكمية المطلوبة غير متاحة للمنتج: ${product.nameAr}` });
      return;
    }
    subtotal += Number(product.price) * ci.quantity;
    resolvedItems.push({ product, quantity: ci.quantity });
  }

  const [matchedCity] = await db.select().from(citiesTable).where(and(eq(citiesTable.governorateId, gov.id), eq(citiesTable.nameAr, city), eq(citiesTable.isActive, true)));
  const orderNumber = generateOrderNumber();

  
  const customerId = req.session.customerId ? (req.session.customerId as number) : null;

  let order: typeof ordersTable.$inferSelect;
  try {
    order = await db.transaction(async (tx) => {
      const coupon = couponCode ? await validateCoupon(couponCode, { subtotal, customerId, items: resolvedItems.map(({ product, quantity }) => ({ productId: product.id, categoryId: product.categoryId, quantity, unitPrice: Number(product.price) })) }, { executor: tx, lock: true }) : null;
      const couponDiscount = coupon?.discount ?? 0;
      const shipping = calculateShipping({
        products: resolvedItems.map(({ product, quantity }) => ({ price: Number(product.price), quantity, freeShipping: product.freeShipping, freeShippingStartAt: product.freeShippingStartAt, freeShippingEndAt: product.freeShippingEndAt })),
        subtotal, baseShippingCost: Number(gov.shippingCost), governorateThreshold: gov.freeShippingThreshold ? Number(gov.freeShippingThreshold) : null,
        cityPriceOverride: matchedCity?.shippingPriceOverride ? Number(matchedCity.shippingPriceOverride) : null,
        surcharge: matchedCity ? Number(matchedCity.surcharge) : Number(gov.remoteAreaSurcharge), freeShippingCoupon: coupon?.freeShipping ?? false,
      });
      const shippingCost = shipping.finalCost;
      const total = Math.max(0, subtotal - couponDiscount + shippingCost);
      const [createdOrder] = await tx.insert(ordersTable).values({
        orderNumber, checkoutToken: checkoutToken || null, customerId, customerName, mobile, altMobile: altMobile || null,
        governorateId: gov.id, governorateName: gov.nameAr,
        city, detailedAddress, landmark: landmark || null,
        deliveryNotes: deliveryNotes || null, orderNotes: orderNotes || null,
        paymentMethod: "cash_on_delivery", paymentStatus: "cash_on_delivery",
        subtotal: String(subtotal), discount: "0", couponDiscount: String(couponDiscount),
        couponCode: couponCode || null, shippingCost: String(shippingCost),
        shippingBaseCost: String(shipping.baseCost), shippingSurcharge: String(shipping.surcharge),
        shippingDiscount: String(shipping.discount), freeShippingReason: shipping.freeShippingReason,
        shippingRuleSnapshot: { rule: shipping.rule, governorateId: gov.id, governorateName: gov.nameAr, city, cityId: matchedCity?.id ?? null, baseCost: shipping.baseCost, surcharge: shipping.surcharge, discount: shipping.discount, finalCost: shipping.finalCost, minDeliveryDays: matchedCity?.minDeliveryDays ?? gov.minDeliveryDays, maxDeliveryDays: matchedCity?.maxDeliveryDays ?? gov.maxDeliveryDays, calculatedAt: new Date().toISOString() },
        total: String(total), status: "new",
      }).returning();

      for (const { product, quantity } of resolvedItems) {
        const [updatedStock] = await tx.update(productsTable).set({
          stockQuantity: sql`${productsTable.stockQuantity} - ${quantity}`,
          salesCount: sql`${productsTable.salesCount} + ${quantity}`,
        }).where(and(eq(productsTable.id, product.id), gte(productsTable.stockQuantity, quantity))).returning({ stockQuantity: productsTable.stockQuantity });
        if (!updatedStock) throw new Error(`OUT_OF_STOCK:${product.nameAr}`);
        await tx.insert(orderItemsTable).values({
          orderId: createdOrder.id, productId: product.id, nameAr: product.nameAr,
          coverImage: product.coverImage, quantity, unitPrice: product.price,
          discount: "0", subtotal: String(Number(product.price) * quantity),
        });
        await tx.insert(stockMovementsTable).values({
          productId: product.id, movementType: "sale",
          quantityBefore: updatedStock.stockQuantity + quantity,
          quantityAfter: updatedStock.stockQuantity, quantityChanged: -quantity,
          reason: `حجز للطلب ${createdOrder.orderNumber}`, orderId: createdOrder.id,
        });
      }
      await tx.insert(orderStatusHistoryTable).values({ orderId: createdOrder.id, status: "new", notes: "تم إنشاء الطلب" });
      if (coupon) await recordCouponUsage(tx, coupon, createdOrder.id, customerId);
      return createdOrder;
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("OUT_OF_STOCK:")) {
      res.status(409).json({ error: `الكمية المطلوبة لم تعد متاحة للمنتج: ${error.message.slice(13)}` });
      return;
    }
    if (error instanceof CouponValidationError) { res.status(400).json({ error: error.message, code: error.code }); return; }
    throw error;
  }

  // Clear cart only after the transaction completed successfully and keep the
  // confirmation reference in the signed session for guest checkout.
  delete (req.session).cart;
  req.session.lastOrderNumber = order.orderNumber;

  const [items, history] = await Promise.all([
    db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id)),
    db.select().from(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.orderId, order.id)),
  ]);

  res.status(201).json(mapOrder(order, items, history));
});

// Guest customers can only reopen the order just created in the same signed
// session. Signed-in customers can reopen any of their own orders.
router.get("/orders/confirmation/:orderNumber", async (req, res): Promise<void> => {
  const orderNumber = Array.isArray(req.params.orderNumber) ? req.params.orderNumber[0] : req.params.orderNumber;
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.orderNumber, orderNumber));
  const ownsOrder = order && req.session.customerId && order.customerId === req.session.customerId;
  const isRecentGuestOrder = order && req.session.lastOrderNumber === order.orderNumber;
  if (!order || (!ownsOrder && !isRecentGuestOrder)) {
    res.status(404).json({ error: "الطلب غير موجود" });
    return;
  }
  const [items, history] = await Promise.all([
    db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id)),
    db.select().from(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.orderId, order.id)).orderBy(desc(orderStatusHistoryTable.createdAt)),
  ]);
  res.json(mapOrder(order, items, history));
});

// Track order by number + mobile
router.get("/orders/track", async (req, res): Promise<void> => {
  const { orderNumber, mobile } = req.query as { orderNumber: string; mobile: string };
  if (!orderNumber || !mobile) { res.status(400).json({ error: "رقم الطلب والهاتف مطلوبان" }); return; }

  const [order] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.orderNumber, orderNumber), eq(ordersTable.mobile, mobile)));

  if (!order) { res.status(404).json({ error: "الطلب غير موجود" }); return; }

  const history = await db.select().from(orderStatusHistoryTable)
    .where(eq(orderStatusHistoryTable.orderId, order.id))
    .orderBy(desc(orderStatusHistoryTable.createdAt));

  res.json({
    orderNumber: order.orderNumber, status: order.status,
    paymentMethod: order.paymentMethod,
    estimatedDeliveryDate: order.estimatedDeliveryDate,
    trackingNumber: order.trackingNumber, shippingCompany: order.shippingCompany,
    statusHistory: history.map(h => ({ status: h.status, notes: h.notes, createdAt: h.createdAt })),
    createdAt: order.createdAt,
  });
});

// My orders (authenticated customer)
router.get("/orders/my", async (req, res): Promise<void> => {
  
  if (!req.session.customerId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { page = "1", limit = "10" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const [orders, [{ count }]] = await Promise.all([
    db.select().from(ordersTable)
      .where(eq(ordersTable.customerId, req.session.customerId as number))
      .orderBy(desc(ordersTable.createdAt))
      .limit(limitNum).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(ordersTable)
      .where(eq(ordersTable.customerId, req.session.customerId as number)),
  ]);

  const orderIds = orders.map(order => order.id);
  const [allItems, allHistory] = orderIds.length ? await Promise.all([
    db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds)),
    db.select().from(orderStatusHistoryTable).where(inArray(orderStatusHistoryTable.orderId, orderIds)).orderBy(desc(orderStatusHistoryTable.createdAt)),
  ]) : [[], []];
  const orderData = orders.map(order => mapOrder(
    order,
    allItems.filter(item => item.orderId === order.id),
    allHistory.filter(history => history.orderId === order.id),
  ));

  res.json({ items: orderData, total: count, page: pageNum, limit: limitNum });
});

// My order detail
router.get("/orders/my/:id", async (req, res): Promise<void> => {
  
  if (!req.session.customerId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [order] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, id), eq(ordersTable.customerId, req.session.customerId as number)));

  if (!order) { res.status(404).json({ error: "الطلب غير موجود" }); return; }

  const [items, history] = await Promise.all([
    db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id)),
    db.select().from(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.orderId, order.id)).orderBy(desc(orderStatusHistoryTable.createdAt)),
  ]);

  res.json(mapOrder(order, items, history));
});

// Cancellation request
router.post("/orders/:id/cancel-request", async (req, res): Promise<void> => {
  
  if (!req.session.customerId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const input = parseBody(cancellationRequestSchema, req.body, res); if (!input) return;
  const { reason } = input;

  const [order] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, id), eq(ordersTable.customerId, req.session.customerId as number)));

  if (!order) { res.status(404).json({ error: "الطلب غير موجود" }); return; }

  if (!["new", "awaiting_confirmation", "confirmed"].includes(order.status)) {
    res.status(400).json({ error: "لا يمكن طلب إلغاء هذا الطلب في وضعه الحالي" });
    return;
  }

  const [existingRequest] = await db.select().from(cancellationRequestsTable)
    .where(and(
      eq(cancellationRequestsTable.orderId, id),
      eq(cancellationRequestsTable.status, "pending"),
    ));
  if (existingRequest) {
    res.status(409).json({ error: "يوجد طلب إلغاء قيد المراجعة بالفعل" });
    return;
  }

  let cr: typeof cancellationRequestsTable.$inferSelect;
  try {
    [cr] = await db.insert(cancellationRequestsTable).values({
      orderId: id, customerId: req.session.customerId as number, reason, status: "pending",
    }).returning();
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") { res.status(409).json({ error: "يوجد طلب إلغاء قيد المراجعة بالفعل" }); return; }
    throw error;
  }

  res.status(201).json({ id: cr.id, orderId: cr.orderId, reason: cr.reason, status: cr.status, createdAt: cr.createdAt });
});

// Customer profile update
router.patch("/customers/me/profile", async (req, res): Promise<void> => {
  
  if (!req.session.customerId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const input = parseBody(profileSchema, req.body, res); if (!input) return;
  const { name, email, mobile } = input;
  const [customer] = await db.update(customersTable)
    .set({ ...(name && { name }), ...(email && { email }), ...(mobile && { mobile }) })
    .where(eq(customersTable.id, req.session.customerId as number))
    .returning();

  res.json({ id: customer.id, name: customer.name, email: customer.email, mobile: customer.mobile, isBlocked: customer.isBlocked, createdAt: customer.createdAt });
});

// Favorites
router.get("/customers/me/favorites", async (req, res): Promise<void> => {
  if (!req.session.customerId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = await db.select({ product: productsTable })
    .from(favoritesTable)
    .innerJoin(productsTable, eq(favoritesTable.productId, productsTable.id))
    .where(and(eq(favoritesTable.customerId, req.session.customerId), eq(productsTable.status, "active")))
    .orderBy(desc(favoritesTable.createdAt));
  res.json(await enrichProductSummaries(rows.map(row => row.product)));
});

router.post("/customers/me/favorites/:productId", async (req, res): Promise<void> => {
  if (!req.session.customerId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = Number(raw);
  const [product] = await db.select({ id: productsTable.id }).from(productsTable)
    .where(and(eq(productsTable.id, productId), eq(productsTable.status, "active")));
  if (!product) { res.status(404).json({ error: "المنتج غير موجود" }); return; }
  await db.insert(favoritesTable).values({ customerId: req.session.customerId, productId }).onConflictDoNothing();
  res.sendStatus(204);
});

router.delete("/customers/me/favorites/:productId", async (req, res): Promise<void> => {
  if (!req.session.customerId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  await db.delete(favoritesTable).where(and(
    eq(favoritesTable.customerId, req.session.customerId),
    eq(favoritesTable.productId, Number(raw)),
  ));
  res.sendStatus(204);
});

// Addresses
router.get("/customers/me/addresses", async (req, res): Promise<void> => {
  if (!req.session.customerId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = await db.select().from(addressesTable)
    .where(eq(addressesTable.customerId, req.session.customerId))
    .orderBy(desc(addressesTable.isDefault), desc(addressesTable.createdAt));
  res.json(rows.map(address => ({
    id: address.id,
    governorateId: address.governorateId,
    governorate: address.governorateName,
    city: address.city,
    detailedAddress: address.detailedAddress,
    landmark: address.landmark,
    isDefault: address.isDefault,
  })));
});

router.post("/customers/me/addresses", async (req, res): Promise<void> => {
  if (!req.session.customerId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const input = parseBody(addressSchema, req.body, res); if (!input) return;
  const { governorateId, city, detailedAddress, landmark, isDefault } = input;
  const [governorate] = await db.select().from(governoratesTable)
    .where(and(eq(governoratesTable.id, governorateId), eq(governoratesTable.isActive, true)));
  if (!governorate) { res.status(400).json({ error: "المحافظة غير صحيحة" }); return; }

  const created = await db.transaction(async tx => {
    const [firstAddress] = await tx.select({ id: addressesTable.id }).from(addressesTable)
      .where(eq(addressesTable.customerId, req.session.customerId!)).limit(1);
    const makeDefault = Boolean(isDefault) || !firstAddress;
    if (makeDefault) {
      await tx.update(addressesTable).set({ isDefault: false })
        .where(eq(addressesTable.customerId, req.session.customerId!));
    }
    const [address] = await tx.insert(addressesTable).values({
      customerId: req.session.customerId!,
      governorateId,
      governorateName: governorate.nameAr,
      city: city.trim(),
      detailedAddress: detailedAddress.trim(),
      landmark: landmark?.trim() || null,
      isDefault: makeDefault,
    }).returning();
    return address;
  });
  res.status(201).json({ id: created.id, governorateId: created.governorateId, governorate: created.governorateName, city: created.city, detailedAddress: created.detailedAddress, landmark: created.landmark, isDefault: created.isDefault });
});

router.patch("/customers/me/addresses/:id", async (req, res): Promise<void> => {
  if (!req.session.customerId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  const [existing] = await db.select().from(addressesTable).where(and(eq(addressesTable.id, id), eq(addressesTable.customerId, req.session.customerId)));
  if (!existing) { res.status(404).json({ error: "العنوان غير موجود" }); return; }

  const input = parseBody(addressSchema.partial(), req.body, res); if (!input) return;
  const governorateId = input.governorateId ?? existing.governorateId;
  const [governorate] = await db.select().from(governoratesTable).where(and(eq(governoratesTable.id, governorateId), eq(governoratesTable.isActive, true)));
  if (!governorate) { res.status(400).json({ error: "المحافظة غير صحيحة" }); return; }
  const updated = await db.transaction(async tx => {
    if (input.isDefault) {
      await tx.update(addressesTable).set({ isDefault: false }).where(eq(addressesTable.customerId, req.session.customerId!));
    }
    const [address] = await tx.update(addressesTable).set({
      governorateId,
      governorateName: governorate.nameAr,
      city: input.city || existing.city,
      detailedAddress: input.detailedAddress || existing.detailedAddress,
      landmark: input.landmark === undefined ? existing.landmark : input.landmark || null,
      isDefault: input.isDefault === undefined ? existing.isDefault : input.isDefault,
    }).where(and(eq(addressesTable.id, id), eq(addressesTable.customerId, req.session.customerId!))).returning();
    return address;
  });
  res.json({ id: updated.id, governorateId: updated.governorateId, governorate: updated.governorateName, city: updated.city, detailedAddress: updated.detailedAddress, landmark: updated.landmark, isDefault: updated.isDefault });
});

router.delete("/customers/me/addresses/:id", async (req, res): Promise<void> => {
  if (!req.session.customerId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  await db.transaction(async tx => {
    const [removed] = await tx.delete(addressesTable).where(and(eq(addressesTable.id, id), eq(addressesTable.customerId, req.session.customerId!))).returning();
    if (removed?.isDefault) {
      const [next] = await tx.select({ id: addressesTable.id }).from(addressesTable)
        .where(eq(addressesTable.customerId, req.session.customerId!)).orderBy(desc(addressesTable.createdAt)).limit(1);
      if (next) await tx.update(addressesTable).set({ isDefault: true }).where(eq(addressesTable.id, next.id));
    }
  });
  res.sendStatus(204);
});

export default router;
