import { Router, type IRouter } from "express";
import { db, ordersTable, orderItemsTable, orderStatusHistoryTable, cancellationRequestsTable, productsTable, stockMovementsTable } from "@workspace/db";
import { eq, and, ilike, desc, gte, lte, sql } from "drizzle-orm";
import { requireAdminAuth, requireAdminPermission } from "../../lib/auth";

const router: IRouter = Router();
router.use(requireAdminAuth);
router.use(requireAdminPermission("orders.manage"));

function mapAdminOrder(order: typeof ordersTable.$inferSelect, items: typeof orderItemsTable.$inferSelect[], history: typeof orderStatusHistoryTable.$inferSelect[]) {
  return {
    id: order.id, orderNumber: order.orderNumber,
    status: order.status, paymentStatus: order.paymentStatus, paymentMethod: order.paymentMethod,
    customerName: order.customerName, mobile: order.mobile, altMobile: order.altMobile,
    governorate: order.governorateName, city: order.city,
    detailedAddress: order.detailedAddress, landmark: order.landmark,
    deliveryNotes: order.deliveryNotes, orderNotes: order.orderNotes, internalNotes: order.internalNotes,
    subtotal: Number(order.subtotal), discount: Number(order.discount),
    couponDiscount: Number(order.couponDiscount), couponCode: order.couponCode,
    shippingCost: Number(order.shippingCost), total: Number(order.total),
    estimatedDeliveryDate: order.estimatedDeliveryDate,
    trackingNumber: order.trackingNumber, shippingCompany: order.shippingCompany,
    assignedTo: order.assignedToName,
    cancellationReason: null,
    items: items.map(i => ({
      productId: i.productId, nameAr: i.nameAr, coverImage: i.coverImage,
      quantity: i.quantity, unitPrice: Number(i.unitPrice),
      subtotal: Number(i.subtotal), discount: Number(i.discount),
    })),
    statusHistory: history.map(h => ({ status: h.status, notes: h.notes, createdAt: h.createdAt })),
    createdAt: order.createdAt, updatedAt: order.updatedAt,
  };
}

router.get("/admin/orders", async (req, res): Promise<void> => {
  const { page = "1", limit = "20", q, status, paymentStatus, dateFrom, dateTo } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const conditions: ReturnType<typeof eq>[] = [];
  if (q) conditions.push(ilike(ordersTable.orderNumber, `%${q}%`));
  if (status) conditions.push(eq(ordersTable.status, status as typeof ordersTable.$inferSelect["status"]));
  if (paymentStatus) conditions.push(eq(ordersTable.paymentStatus, paymentStatus as typeof ordersTable.$inferSelect["paymentStatus"]));
  if (dateFrom) conditions.push(gte(ordersTable.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(ordersTable.createdAt, new Date(dateTo)));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, [{ count }]] = await Promise.all([
    db.select().from(ordersTable).where(whereClause).orderBy(desc(ordersTable.createdAt)).limit(limitNum).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(whereClause),
  ]);

  res.json({
    items: items.map(o => ({
      id: o.id, orderNumber: o.orderNumber, customerName: o.customerName, mobile: o.mobile,
      governorate: o.governorateName, status: o.status, paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod, total: Number(o.total), itemCount: 0, createdAt: o.createdAt,
    })),
    total: count, page: pageNum, limit: limitNum,
  });
});

router.get("/admin/orders/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const [items, history] = await Promise.all([
    db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id)),
    db.select().from(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.orderId, id)).orderBy(desc(orderStatusHistoryTable.createdAt)),
  ]);

  res.json(mapAdminOrder(order, items, history));
});

router.patch("/admin/orders/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { customerName, mobile, altMobile, city, detailedAddress, landmark, deliveryNotes, orderNotes, internalNotes, trackingNumber, shippingCompany, estimatedDeliveryDate } = req.body;

  const [order] = await db.update(ordersTable).set({
    ...(customerName && { customerName }), ...(mobile && { mobile }), ...(altMobile !== undefined && { altMobile }),
    ...(city && { city }), ...(detailedAddress && { detailedAddress }), ...(landmark !== undefined && { landmark }),
    ...(deliveryNotes !== undefined && { deliveryNotes }), ...(orderNotes !== undefined && { orderNotes }),
    ...(internalNotes !== undefined && { internalNotes }), ...(trackingNumber !== undefined && { trackingNumber }),
    ...(shippingCompany !== undefined && { shippingCompany }), ...(estimatedDeliveryDate !== undefined && { estimatedDeliveryDate }),
  }).where(eq(ordersTable.id, id)).returning();

  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const [items, history] = await Promise.all([
    db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id)),
    db.select().from(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.orderId, id)).orderBy(desc(orderStatusHistoryTable.createdAt)),
  ]);

  res.json(mapAdminOrder(order, items, history));
});

router.patch("/admin/orders/:id/status", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { status, notes, trackingNumber, shippingCompany } = req.body;
  

  const [order] = await db.update(ordersTable).set({
    status, ...(trackingNumber && { trackingNumber }), ...(shippingCompany && { shippingCompany }),
  }).where(eq(ordersTable.id, id)).returning();

  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  await db.insert(orderStatusHistoryTable).values({
    orderId: id, status, notes: notes || null, employeeId: req.session.adminId as number || null,
  });

  const [items, history] = await Promise.all([
    db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id)),
    db.select().from(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.orderId, id)).orderBy(desc(orderStatusHistoryTable.createdAt)),
  ]);

  res.json(mapAdminOrder(order, items, history));
});

router.patch("/admin/orders/:id/cancellation", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { decision, notes } = req.body;

  if (decision !== "approved" && decision !== "rejected") {
    res.status(400).json({ error: "القرار يجب أن يكون موافقة أو رفض" });
    return;
  }

  const [pendingRequest] = await db.select().from(cancellationRequestsTable)
    .where(and(
      eq(cancellationRequestsTable.orderId, id),
      eq(cancellationRequestsTable.status, "pending"),
    ));
  if (!pendingRequest) {
    res.status(404).json({ error: "لا يوجد طلب إلغاء قيد المراجعة" });
    return;
  }
  

  await db.update(cancellationRequestsTable).set({
    status: decision, employeeNotes: notes || null,
    employeeId: req.session.adminId as number || null, decidedAt: new Date(),
  }).where(eq(cancellationRequestsTable.id, pendingRequest.id));

  if (decision === "approved") {
    await db.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, id));
    await db.insert(orderStatusHistoryTable).values({
      orderId: id, status: "cancelled", notes: notes || "تمت الموافقة على طلب الإلغاء",
      employeeId: req.session.adminId as number || null,
    });
    // Restore stock
    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
    for (const item of items) {
      if (item.productId) {
        const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
        if (!product) continue;
        const quantityAfter = product.stockQuantity + item.quantity;
        await db.update(productsTable).set({ stockQuantity: sql`${productsTable.stockQuantity} + ${item.quantity}` }).where(eq(productsTable.id, item.productId));
        await db.insert(stockMovementsTable).values({
          productId: item.productId,
          movementType: "reservation_release",
          quantityBefore: product.stockQuantity,
          quantityAfter,
          quantityChanged: item.quantity,
          reason: `استعادة مخزون الطلب الملغي رقم ${id}`,
          orderId: id,
          employeeId: req.session.adminId || null,
        });
      }
    }
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  const [items2, history] = await Promise.all([
    db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id)),
    db.select().from(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.orderId, id)).orderBy(desc(orderStatusHistoryTable.createdAt)),
  ]);

  res.json(mapAdminOrder(order, items2, history));
});

export default router;
