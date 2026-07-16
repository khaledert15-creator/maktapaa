import { Router, type IRouter } from "express";
import { db, ordersTable, orderItemsTable, orderStatusHistoryTable } from "@workspace/db";
import { eq, and, or, ilike, desc, gte, lte, sql } from "drizzle-orm";
import { requireAdminAuth, requireAdminPermission } from "../../lib/auth";
import { writeAuditLog } from "../../services/audit";
import { decideCancellation, OrderStateError, transitionOrderStatus } from "../../services/order-state";
import { parseBody } from "../../lib/validation";
import { z } from "@workspace/api-zod";

const router: IRouter = Router();
router.use(requireAdminAuth);
const orderStatuses = z.enum(["new", "awaiting_confirmation", "confirmed", "preparing", "ready_for_shipping", "shipped", "out_for_delivery", "delivered", "delivery_failed", "returned", "partially_returned", "cancelled"]);
const orderEditSchema = z.object({ customerName: z.string().trim().min(2).max(200).optional(), mobile: z.string().trim().min(8).max(30).optional(), altMobile: z.string().trim().max(30).nullable().optional(), city: z.string().trim().min(2).max(200).optional(), detailedAddress: z.string().trim().min(5).max(2000).optional(), landmark: z.string().max(500).nullable().optional(), deliveryNotes: z.string().max(2000).nullable().optional(), orderNotes: z.string().max(2000).nullable().optional(), internalNotes: z.string().max(5000).nullable().optional(), trackingNumber: z.string().max(200).nullable().optional(), shippingCompany: z.string().max(200).nullable().optional(), estimatedDeliveryDate: z.string().max(100).nullable().optional() });
const statusSchema = z.object({ status: orderStatuses, notes: z.string().max(2000).nullable().optional(), trackingNumber: z.string().max(200).nullable().optional(), shippingCompany: z.string().max(200).nullable().optional() });
const cancellationSchema = z.object({ decision: z.enum(["approved", "rejected"]), notes: z.string().max(2000).nullable().optional() });

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

router.get("/admin/orders", requireAdminPermission("orders.view"), async (req, res): Promise<void> => {
  const { page = "1", limit = "20", q, status, paymentStatus, paymentMethod, governorate, dateFrom, dateTo } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const conditions: ReturnType<typeof eq>[] = [];
  if (q) conditions.push(or(ilike(ordersTable.orderNumber, `%${q}%`), ilike(ordersTable.customerName, `%${q}%`), ilike(ordersTable.mobile, `%${q}%`)) as ReturnType<typeof eq>);
  if (status) conditions.push(eq(ordersTable.status, status as typeof ordersTable.$inferSelect["status"]));
  if (paymentStatus) conditions.push(eq(ordersTable.paymentStatus, paymentStatus as typeof ordersTable.$inferSelect["paymentStatus"]));
  if (paymentMethod) conditions.push(eq(ordersTable.paymentMethod, paymentMethod as typeof ordersTable.$inferSelect["paymentMethod"]));
  if (governorate) conditions.push(eq(ordersTable.governorateName, governorate));
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

router.get("/admin/orders/:id", requireAdminPermission("orders.view"), async (req, res): Promise<void> => {
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

router.patch("/admin/orders/:id", requireAdminPermission("orders.edit"), async (req, res): Promise<void> => {
  const input = parseBody(orderEditSchema, req.body, res); if (!input) return;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { customerName, mobile, altMobile, city, detailedAddress, landmark, deliveryNotes, orderNotes, internalNotes, trackingNumber, shippingCompany, estimatedDeliveryDate } = input;
  const [before] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));

  const [order] = await db.update(ordersTable).set({
    ...(customerName && { customerName }), ...(mobile && { mobile }), ...(altMobile !== undefined && { altMobile }),
    ...(city && { city }), ...(detailedAddress && { detailedAddress }), ...(landmark !== undefined && { landmark }),
    ...(deliveryNotes !== undefined && { deliveryNotes }), ...(orderNotes !== undefined && { orderNotes }),
    ...(internalNotes !== undefined && { internalNotes }), ...(trackingNumber !== undefined && { trackingNumber }),
    ...(shippingCompany !== undefined && { shippingCompany }), ...(estimatedDeliveryDate !== undefined && { estimatedDeliveryDate }),
  }).where(eq(ordersTable.id, id)).returning();

  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  await writeAuditLog(req, { action: "order.update", entityType: "order", entityId: id, description: `تعديل الطلب ${order.orderNumber}`, beforeData: before ?? null, afterData: order });

  const [items, history] = await Promise.all([
    db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id)),
    db.select().from(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.orderId, id)).orderBy(desc(orderStatusHistoryTable.createdAt)),
  ]);

  res.json(mapAdminOrder(order, items, history));
});

router.patch("/admin/orders/:id/status", requireAdminPermission("orders.edit"), async (req, res): Promise<void> => {
  const input = parseBody(statusSchema, req.body, res); if (!input) return;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { status, notes, trackingNumber, shippingCompany } = input;
  let order: typeof ordersTable.$inferSelect;
  try {
    order = await transitionOrderStatus({ orderId: id, targetStatus: status, notes, trackingNumber, shippingCompany, actor: { employeeId: req.session.adminId!, ipAddress: req.ip } });
  } catch (error) {
    if (error instanceof OrderStateError) { res.status(error.code === "NOT_FOUND" ? 404 : 409).json({ error: error.message }); return; }
    throw error;
  }

  const [items, history] = await Promise.all([
    db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id)),
    db.select().from(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.orderId, id)).orderBy(desc(orderStatusHistoryTable.createdAt)),
  ]);

  res.json(mapAdminOrder(order, items, history));
});

router.patch("/admin/orders/:id/cancellation", requireAdminPermission("orders.edit"), async (req, res): Promise<void> => {
  const input = parseBody(cancellationSchema, req.body, res); if (!input) return;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { decision, notes } = input;
  let order: typeof ordersTable.$inferSelect;
  try {
    order = await decideCancellation({ orderId: id, decision, notes, actor: { employeeId: req.session.adminId!, ipAddress: req.ip } });
  } catch (error) {
    if (error instanceof OrderStateError) { res.status(error.code === "NOT_FOUND" || error.code === "NO_PENDING_REQUEST" ? 404 : 409).json({ error: error.message }); return; }
    throw error;
  }
  const [items2, history] = await Promise.all([
    db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id)),
    db.select().from(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.orderId, id)).orderBy(desc(orderStatusHistoryTable.createdAt)),
  ]);

  res.json(mapAdminOrder(order, items2, history));
});

export default router;
