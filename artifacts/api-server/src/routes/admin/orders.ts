import { Router, type IRouter } from "express";
import { auditLogsTable, cancellationRequestsTable, db, ordersTable, orderItemsTable, orderStatusHistoryTable, productsTable, stockMovementsTable } from "@workspace/db";
import { eq, and, or, ilike, desc, gte, lte, sql } from "drizzle-orm";
import { requireAdminAuth, requireAdminPermission } from "../../lib/auth";
import { writeAuditLog } from "../../services/audit";
import { decideCancellation, OrderStateError, transitionOrderStatus } from "../../services/order-state";
import { parseBody } from "../../lib/validation";
import { egyptianPhoneSchema, optionalEgyptianPhoneSchema, resolvePreferredWhatsAppPhone, z } from "@workspace/api-zod";
import { buildOrderWhatsAppLink } from "../../services/order-whatsapp";

const router: IRouter = Router();
router.use(requireAdminAuth);
const orderStatuses = z.enum(["new", "awaiting_confirmation", "confirmed", "preparing", "ready_for_shipping", "shipped", "out_for_delivery", "delivered", "delivery_failed", "returned", "partially_returned", "cancelled"]);
const orderEditSchema = z.object({ customerName: z.string().trim().min(2).max(200).optional(), mobile: egyptianPhoneSchema.optional(), primaryPhoneHasWhatsApp: z.boolean().optional(), altMobile: optionalEgyptianPhoneSchema, alternatePhoneHasWhatsApp: z.boolean().optional(), preferredWhatsAppPhone: optionalEgyptianPhoneSchema, city: z.string().trim().min(2).max(200).optional(), detailedAddress: z.string().trim().min(5).max(2000).optional(), landmark: z.string().max(500).nullable().optional(), deliveryNotes: z.string().max(2000).nullable().optional(), orderNotes: z.string().max(2000).nullable().optional(), internalNotes: z.string().max(5000).nullable().optional(), trackingNumber: z.string().max(200).nullable().optional(), shippingCompany: z.string().max(200).nullable().optional(), estimatedDeliveryDate: z.string().max(100).nullable().optional() });
const statusSchema = z.object({ status: orderStatuses, notes: z.string().max(2000).nullable().optional(), trackingNumber: z.string().max(200).nullable().optional(), shippingCompany: z.string().max(200).nullable().optional() });
const cancellationSchema = z.object({ decision: z.enum(["approved", "rejected"]), notes: z.string().max(2000).nullable().optional() });

type MovementRow = typeof stockMovementsTable.$inferSelect & { productNameAr?: string | null };
function mapAdminOrder(order: typeof ordersTable.$inferSelect, items: typeof orderItemsTable.$inferSelect[], history: typeof orderStatusHistoryTable.$inferSelect[], movements: MovementRow[] = [], audits: (typeof auditLogsTable.$inferSelect)[] = [], cancellationRequests: (typeof cancellationRequestsTable.$inferSelect)[] = []) {
  return {
    id: order.id, orderNumber: order.orderNumber,
    status: order.status, paymentStatus: order.paymentStatus, paymentMethod: order.paymentMethod,
    customerName: order.customerName, mobile: order.mobile, primaryPhone: order.mobile, primaryPhoneHasWhatsApp: order.primaryPhoneHasWhatsApp, altMobile: order.altMobile, alternatePhone: order.altMobile, alternatePhoneHasWhatsApp: order.alternatePhoneHasWhatsApp, preferredWhatsAppPhone: order.preferredWhatsAppPhone,
    governorate: order.governorateName, city: order.city,
    detailedAddress: order.detailedAddress, landmark: order.landmark,
    deliveryNotes: order.deliveryNotes, orderNotes: order.orderNotes, internalNotes: order.internalNotes,
    subtotal: Number(order.subtotal), discount: Number(order.discount),
    couponDiscount: Number(order.couponDiscount), couponCode: order.couponCode,
    shippingCost: Number(order.shippingCost), total: Number(order.total),
    shippingBaseCost: Number(order.shippingBaseCost), shippingSurcharge: Number(order.shippingSurcharge),
    shippingDiscount: Number(order.shippingDiscount), freeShippingReason: order.freeShippingReason,
    shippingRuleSnapshot: order.shippingRuleSnapshot,
    estimatedDeliveryDate: order.estimatedDeliveryDate,
    trackingNumber: order.trackingNumber, shippingCompany: order.shippingCompany,
    assignedTo: order.assignedToName,
    cancellationReason: cancellationRequests[0]?.reason ?? null,
    cancellationRequests: cancellationRequests.map(request => ({ id: request.id, reason: request.reason, status: request.status, employeeDecision: request.employeeDecision, employeeNotes: request.employeeNotes, decidedAt: request.decidedAt, createdAt: request.createdAt })),
    items: items.map(i => ({
      productId: i.productId, nameAr: i.nameAr, coverImage: i.coverImage,
      quantity: i.quantity, unitPrice: Number(i.unitPrice),
      subtotal: Number(i.subtotal), discount: Number(i.discount),
    })),
    statusHistory: history.map(h => ({ status: h.status, notes: h.notes, employeeName: h.employeeName, createdAt: h.createdAt })),
    inventoryMovements: movements.map(movement => ({ id: movement.id, productId: movement.productId, productNameAr: movement.productNameAr, movementType: movement.movementType, quantityBefore: movement.quantityBefore, quantityAfter: movement.quantityAfter, quantityChanged: movement.quantityChanged, reason: movement.reason, employeeName: movement.employeeName, createdAt: movement.createdAt })),
    auditHistory: audits.map(audit => ({ id: audit.id, action: audit.action, description: audit.description, employeeName: audit.employeeName, beforeData: audit.beforeData, afterData: audit.afterData, createdAt: audit.createdAt })),
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
    db.select({ order: ordersTable, itemCount: sql<number>`(select coalesce(sum(quantity), 0)::int from order_items where order_id = ${ordersTable.id})` }).from(ordersTable).where(whereClause).orderBy(desc(ordersTable.createdAt)).limit(limitNum).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(whereClause),
  ]);

  res.json({
    items: items.map(({ order: o, itemCount }) => ({
      id: o.id, orderNumber: o.orderNumber, customerName: o.customerName, mobile: o.mobile,
      governorate: o.governorateName, status: o.status, paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod, total: Number(o.total), itemCount, createdAt: o.createdAt,
    })),
    total: count, page: pageNum, limit: limitNum,
  });
});

router.get("/admin/orders/:id", requireAdminPermission("orders.view"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "الطلب غير موجود أو تم حذفه" }); return; }

  const [items, history, movements, audits, cancellationRequests] = await Promise.all([
    db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id)),
    db.select().from(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.orderId, id)).orderBy(desc(orderStatusHistoryTable.createdAt)),
    db.select({ movement: stockMovementsTable, productNameAr: productsTable.nameAr }).from(stockMovementsTable).leftJoin(productsTable, eq(stockMovementsTable.productId, productsTable.id)).where(eq(stockMovementsTable.orderId, id)).orderBy(desc(stockMovementsTable.createdAt)),
    db.select().from(auditLogsTable).where(and(eq(auditLogsTable.entityType, "order"), eq(auditLogsTable.entityId, String(id)))).orderBy(desc(auditLogsTable.createdAt)),
    db.select().from(cancellationRequestsTable).where(eq(cancellationRequestsTable.orderId, id)).orderBy(desc(cancellationRequestsTable.createdAt)),
  ]);

  res.json(mapAdminOrder(order, items, history, movements.map(({ movement, productNameAr }) => ({ ...movement, productNameAr })), audits, cancellationRequests));
});

router.post("/admin/orders/:id/whatsapp", requireAdminPermission("orders.view"), requireAdminPermission("orders.whatsapp"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "الطلب غير موجود" }); return; }
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
  const link = buildOrderWhatsAppLink(order, items);
  if (!link) { res.status(409).json({ error: "لا يوجد رقم مسجل عليه واتساب لهذا الطلب" }); return; }
  await writeAuditLog(req, { action: "order.whatsapp_open", entityType: "order", entityId: id, description: `فتح محادثة واتساب للطلب ${order.orderNumber}`, afterData: { phone: link.phone } });
  res.json(link);
});

router.patch("/admin/orders/:id", requireAdminPermission("orders.edit"), async (req, res): Promise<void> => {
  const input = parseBody(orderEditSchema, req.body, res); if (!input) return;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { customerName, mobile, altMobile, city, detailedAddress, landmark, deliveryNotes, orderNotes, internalNotes, trackingNumber, shippingCompany, estimatedDeliveryDate } = input;
  const [before] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!before) { res.status(404).json({ error: "الطلب غير موجود أو تم حذفه" }); return; }
  const primaryPhone = mobile ?? before.mobile;
  const primaryPhoneHasWhatsApp = input.primaryPhoneHasWhatsApp ?? before.primaryPhoneHasWhatsApp;
  const alternatePhone = altMobile === undefined ? before.altMobile : altMobile;
  const alternatePhoneHasWhatsApp = input.alternatePhoneHasWhatsApp ?? before.alternatePhoneHasWhatsApp;
  const preferredWhatsAppPhone = resolvePreferredWhatsAppPhone({ primaryPhone, primaryPhoneHasWhatsApp, alternatePhone, alternatePhoneHasWhatsApp, preferredWhatsAppPhone: input.preferredWhatsAppPhone === undefined ? before.preferredWhatsAppPhone : input.preferredWhatsAppPhone });
  if (input.preferredWhatsAppPhone && !preferredWhatsAppPhone) { res.status(400).json({ error: "رقم واتساب المفضل غير صالح" }); return; }

  const [order] = await db.update(ordersTable).set({
    ...(customerName && { customerName }), mobile: primaryPhone, primaryPhoneHasWhatsApp, altMobile: alternatePhone || null, alternatePhoneHasWhatsApp, preferredWhatsAppPhone,
    ...(city && { city }), ...(detailedAddress && { detailedAddress }), ...(landmark !== undefined && { landmark }),
    ...(deliveryNotes !== undefined && { deliveryNotes }), ...(orderNotes !== undefined && { orderNotes }),
    ...(internalNotes !== undefined && { internalNotes }), ...(trackingNumber !== undefined && { trackingNumber }),
    ...(shippingCompany !== undefined && { shippingCompany }), ...(estimatedDeliveryDate !== undefined && { estimatedDeliveryDate }),
  }).where(eq(ordersTable.id, id)).returning();

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
