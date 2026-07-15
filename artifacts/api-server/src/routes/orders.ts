import { Router, type IRouter } from "express";
import { db, ordersTable, orderItemsTable, orderStatusHistoryTable, cancellationRequestsTable, productsTable, governoratesTable, couponsTable, customersTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

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
    landmark, deliveryNotes, orderNotes, paymentMethod, couponCode, cartItems,
  } = req.body;

  if (!customerName || !mobile || !governorateId || !city || !detailedAddress) {
    res.status(400).json({ error: "البيانات المطلوبة ناقصة" });
    return;
  }

  if (!cartItems || cartItems.length === 0) {
    res.status(400).json({ error: "السلة فارغة" });
    return;
  }

  const [gov] = await db.select().from(governoratesTable).where(eq(governoratesTable.id, parseInt(governorateId, 10)));
  if (!gov) { res.status(400).json({ error: "المحافظة غير صحيحة" }); return; }

  // Validate stock and compute totals
  let subtotal = 0;
  const resolvedItems: { product: typeof productsTable.$inferSelect; quantity: number }[] = [];
  for (const ci of cartItems) {
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

  let shippingCost = Number(gov.shippingCost);
  if (gov.freeShippingThreshold && subtotal >= Number(gov.freeShippingThreshold)) shippingCost = 0;

  let couponDiscount = 0;
  if (couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, couponCode));
    if (coupon && coupon.isActive) {
      if (coupon.type === "percentage") couponDiscount = subtotal * (Number(coupon.value) / 100);
      else if (coupon.type === "fixed") couponDiscount = Math.min(Number(coupon.value), subtotal);
      else if (coupon.type === "free_shipping") shippingCost = 0;
      await db.update(couponsTable).set({ usedCount: sql`${couponsTable.usedCount} + 1` }).where(eq(couponsTable.id, coupon.id));
    }
  }

  const total = Math.max(0, subtotal - couponDiscount + shippingCost);
  const orderNumber = generateOrderNumber();

  
  const customerId = req.session.customerId ? (req.session.customerId as number) : null;

  const [order] = await db.insert(ordersTable).values({
    orderNumber, customerId, customerName, mobile, altMobile: altMobile || null,
    governorateId: gov.id, governorateName: gov.nameAr,
    city, detailedAddress, landmark: landmark || null,
    deliveryNotes: deliveryNotes || null, orderNotes: orderNotes || null,
    paymentMethod: paymentMethod || "cash_on_delivery",
    paymentStatus: paymentMethod === "cash_on_delivery" ? "cash_on_delivery" : "pending",
    subtotal: String(subtotal), discount: "0", couponDiscount: String(couponDiscount),
    couponCode: couponCode || null, shippingCost: String(shippingCost),
    total: String(total), status: "new",
  }).returning();

  // Insert order items and update stock
  for (const { product, quantity } of resolvedItems) {
    await db.insert(orderItemsTable).values({
      orderId: order.id, productId: product.id, nameAr: product.nameAr,
      coverImage: product.coverImage, quantity, unitPrice: String(product.price),
      discount: "0", subtotal: String(Number(product.price) * quantity),
    });
    await db.update(productsTable).set({
      stockQuantity: product.stockQuantity - quantity,
      salesCount: sql`${productsTable.salesCount} + ${quantity}`,
    }).where(eq(productsTable.id, product.id));
  }

  await db.insert(orderStatusHistoryTable).values({ orderId: order.id, status: "new", notes: "تم إنشاء الطلب" });

  // Clear cart
  delete (req.session).cart;

  const [items, history] = await Promise.all([
    db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id)),
    db.select().from(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.orderId, order.id)),
  ]);

  res.status(201).json(mapOrder(order, items, history));
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

  const [order] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, id), eq(ordersTable.customerId, req.session.customerId as number)));

  if (!order) { res.status(404).json({ error: "الطلب غير موجود" }); return; }

  if (!["new", "awaiting_confirmation", "confirmed"].includes(order.status)) {
    res.status(400).json({ error: "لا يمكن طلب إلغاء هذا الطلب في وضعه الحالي" });
    return;
  }

  const [cr] = await db.insert(cancellationRequestsTable).values({
    orderId: id, customerId: req.session.customerId as number, reason, status: "pending",
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
  res.json([]);
});

router.post("/customers/me/favorites/:productId", async (req, res): Promise<void> => {
  res.sendStatus(204);
});

router.delete("/customers/me/favorites/:productId", async (req, res): Promise<void> => {
  res.sendStatus(204);
});

// Addresses
router.get("/customers/me/addresses", async (req, res): Promise<void> => {
  
  if (!req.session.customerId) { res.status(401).json({ error: "Unauthorized" }); return; }
  res.json([]);
});

router.post("/customers/me/addresses", async (req, res): Promise<void> => {
  
  if (!req.session.customerId) { res.status(401).json({ error: "Unauthorized" }); return; }
  res.status(201).json({ id: 1, governorate: "", city: req.body.city, detailedAddress: req.body.detailedAddress, landmark: null, isDefault: false });
});

export default router;
