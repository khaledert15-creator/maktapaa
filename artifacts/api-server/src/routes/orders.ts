import { Router, type IRouter } from "express";
import { db, ordersTable, orderItemsTable, orderStatusHistoryTable, cancellationRequestsTable, productsTable, governoratesTable, citiesTable, couponsTable, customersTable, stockMovementsTable, favoritesTable, addressesTable } from "@workspace/db";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { calculateShipping } from "../services/shipping";
import { enrichProductSummaries } from "../services/catalog";

const router: IRouter = Router();

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
router.post("/orders", async (req, res): Promise<void> => {
  const {
    customerName, mobile, altMobile, governorateId, city, detailedAddress,
    landmark, deliveryNotes, orderNotes, paymentMethod, couponCode, checkoutToken,
  } = req.body;
  const cartItems = Array.isArray(req.body.cartItems) ? req.body.cartItems : req.session.cart?.items;

  if (paymentMethod && paymentMethod !== "cash_on_delivery") {
    res.status(400).json({ error: "الدفع عند الاستلام هو وسيلة الدفع المتاحة حاليًا" });
    return;
  }

  if (!customerName || !mobile || !governorateId || !city || !detailedAddress) {
    res.status(400).json({ error: "البيانات المطلوبة ناقصة" });
    return;
  }

  if (checkoutToken && (typeof checkoutToken !== "string" || checkoutToken.length < 12 || checkoutToken.length > 100)) {
    res.status(400).json({ error: "رمز تأكيد الطلب غير صحيح" });
    return;
  }

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

  const [gov] = await db.select().from(governoratesTable).where(eq(governoratesTable.id, parseInt(governorateId, 10)));
  if (!gov) { res.status(400).json({ error: "المحافظة غير صحيحة" }); return; }

  // Validate stock and compute totals
  let subtotal = 0;
  const resolvedItems: { product: typeof productsTable.$inferSelect; quantity: number }[] = [];
  for (const ci of cartItems) {
    if (!Number.isInteger(ci.productId) || !Number.isInteger(ci.quantity) || ci.quantity < 1 || ci.quantity > 99) {
      res.status(400).json({ error: "بيانات كمية المنتج غير صحيحة" });
      return;
    }
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, ci.productId));
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

  let freeShippingCoupon = false;
  let appliedCouponId: number | null = null;

  let couponDiscount = 0;
  if (couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, couponCode));
    if (coupon && coupon.isActive) {
      if (coupon.type === "percentage") couponDiscount = subtotal * (Number(coupon.value) / 100);
      else if (coupon.type === "fixed") couponDiscount = Math.min(Number(coupon.value), subtotal);
      else if (coupon.type === "free_shipping") freeShippingCoupon = true;
      appliedCouponId = coupon.id;
    }
  }

  const [matchedCity] = await db.select().from(citiesTable).where(and(eq(citiesTable.governorateId, gov.id), eq(citiesTable.nameAr, city), eq(citiesTable.isActive, true)));
  const shipping = calculateShipping({
    products: resolvedItems.map(({ product, quantity }) => ({ price: Number(product.price), quantity, freeShipping: product.freeShipping, freeShippingStartAt: product.freeShippingStartAt, freeShippingEndAt: product.freeShippingEndAt })),
    subtotal,
    baseShippingCost: Number(gov.shippingCost),
    governorateThreshold: gov.freeShippingThreshold ? Number(gov.freeShippingThreshold) : null,
    cityPriceOverride: matchedCity?.shippingPriceOverride ? Number(matchedCity.shippingPriceOverride) : null,
    surcharge: matchedCity ? Number(matchedCity.surcharge) : Number(gov.remoteAreaSurcharge),
    freeShippingCoupon,
  });
  const shippingCost = shipping.finalCost;

  const total = Math.max(0, subtotal - couponDiscount + shippingCost);
  const orderNumber = generateOrderNumber();

  
  const customerId = req.session.customerId ? (req.session.customerId as number) : null;

  let order: typeof ordersTable.$inferSelect;
  try {
    order = await db.transaction(async (tx) => {
      if (appliedCouponId) {
        await tx.update(couponsTable).set({ usedCount: sql`${couponsTable.usedCount} + 1` }).where(eq(couponsTable.id, appliedCouponId));
      }
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
        shippingRuleSnapshot: { rule: shipping.rule, governorateId: gov.id, governorateName: gov.nameAr, city, cityId: matchedCity?.id ?? null, baseCost: shipping.baseCost, surcharge: shipping.surcharge, discount: shipping.discount, finalCost: shipping.finalCost, calculatedAt: new Date().toISOString() },
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
      return createdOrder;
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("OUT_OF_STOCK:")) {
      res.status(409).json({ error: `الكمية المطلوبة لم تعد متاحة للمنتج: ${error.message.slice(13)}` });
      return;
    }
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

  const orderData = await Promise.all(orders.map(async (o) => {
    const [items, history] = await Promise.all([
      db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, o.id)),
      db.select().from(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.orderId, o.id)).orderBy(desc(orderStatusHistoryTable.createdAt)),
    ]);
    return mapOrder(o, items, history);
  }));

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
  const { reason } = req.body;

  if (!reason) { res.status(400).json({ error: "سبب الإلغاء مطلوب" }); return; }

  if (typeof reason !== "string" || reason.trim().length < 5 || reason.trim().length > 500) {
    res.status(400).json({ error: "سبب الإلغاء يجب أن يكون بين 5 و500 حرف" });
    return;
  }

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

  const [cr] = await db.insert(cancellationRequestsTable).values({
    orderId: id, customerId: req.session.customerId as number, reason: reason.trim(), status: "pending",
  }).returning();

  res.status(201).json({ id: cr.id, orderId: cr.orderId, reason: cr.reason, status: cr.status, createdAt: cr.createdAt });
});

// Customer profile update
router.patch("/customers/me/profile", async (req, res): Promise<void> => {
  
  if (!req.session.customerId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { name, email, mobile } = req.body;
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
  const { governorateId, city, detailedAddress, landmark, isDefault } = req.body;
  if (!Number.isInteger(governorateId) || !city?.trim() || !detailedAddress?.trim()) {
    res.status(400).json({ error: "بيانات العنوان المطلوبة ناقصة" });
    return;
  }
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

  const governorateId = req.body.governorateId ?? existing.governorateId;
  const [governorate] = await db.select().from(governoratesTable).where(and(eq(governoratesTable.id, governorateId), eq(governoratesTable.isActive, true)));
  if (!governorate) { res.status(400).json({ error: "المحافظة غير صحيحة" }); return; }
  const updated = await db.transaction(async tx => {
    if (req.body.isDefault) {
      await tx.update(addressesTable).set({ isDefault: false }).where(eq(addressesTable.customerId, req.session.customerId!));
    }
    const [address] = await tx.update(addressesTable).set({
      governorateId,
      governorateName: governorate.nameAr,
      city: req.body.city?.trim() || existing.city,
      detailedAddress: req.body.detailedAddress?.trim() || existing.detailedAddress,
      landmark: req.body.landmark === undefined ? existing.landmark : req.body.landmark?.trim() || null,
      isDefault: req.body.isDefault === undefined ? existing.isDefault : Boolean(req.body.isDefault),
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
