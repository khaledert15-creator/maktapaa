import {
  auditLogsTable, cancellationRequestsTable, db, orderItemsTable, ordersTable,
  orderStatusHistoryTable, productsTable, stockMovementsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";

type OrderStatus = typeof ordersTable.$inferSelect.status;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const allowedTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ["awaiting_confirmation", "confirmed", "cancelled"],
  awaiting_confirmation: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready_for_shipping", "cancelled"],
  ready_for_shipping: ["shipped", "cancelled"],
  shipped: ["out_for_delivery", "delivery_failed", "returned"],
  out_for_delivery: ["delivered", "delivery_failed", "returned"],
  delivered: ["returned", "partially_returned"],
  delivery_failed: ["out_for_delivery", "returned"],
  returned: [],
  partially_returned: [],
  cancelled: [],
};

export class OrderStateError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "INVALID_TRANSITION" | "NO_PENDING_REQUEST", message: string) {
    super(message);
    this.name = "OrderStateError";
  }
}

type Actor = { employeeId: number; employeeName?: string | null; ipAddress?: string | null };

async function insertAudit(tx: Transaction, actor: Actor, input: { action: string; orderId: number; description: string; afterData?: Record<string, unknown> }) {
  await tx.insert(auditLogsTable).values({
    employeeId: actor.employeeId,
    employeeName: actor.employeeName ?? null,
    ipAddress: actor.ipAddress ?? null,
    action: input.action,
    entityType: "order",
    entityId: String(input.orderId),
    description: input.description,
    afterData: input.afterData ?? null,
  });
}

async function cancelOrderTx(tx: Transaction, input: { orderId: number; notes?: string | null; actor: Actor }) {
  const [order] = await tx.select().from(ordersTable).where(eq(ordersTable.id, input.orderId)).for("update");
  if (!order) throw new OrderStateError("NOT_FOUND", "الطلب غير موجود");
  if (order.status === "cancelled") return { order, restored: false };
  if (!allowedTransitions[order.status].includes("cancelled")) {
    throw new OrderStateError("INVALID_TRANSITION", `لا يمكن إلغاء الطلب من الحالة ${order.status}`);
  }

  const items = await tx.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  const quantities = new Map<number, number>();
  for (const item of items) if (item.productId) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);

  for (const [productId, quantity] of quantities) {
    const referenceKey = `cancellation:${order.id}:product:${productId}`;
    const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, productId)).for("update");
    if (!product) continue;
    const quantityAfter = product.stockQuantity + quantity;
    const inserted = await tx.insert(stockMovementsTable).values({
      productId,
      movementType: "reservation_release",
      quantityBefore: product.stockQuantity,
      quantityAfter,
      quantityChanged: quantity,
      reason: `استعادة مخزون الطلب الملغي ${order.orderNumber}`,
      orderId: order.id,
      employeeId: input.actor.employeeId,
      employeeName: input.actor.employeeName ?? null,
      referenceKey,
    }).onConflictDoNothing({ target: stockMovementsTable.referenceKey }).returning({ id: stockMovementsTable.id });
    if (inserted.length) await tx.update(productsTable).set({ stockQuantity: quantityAfter }).where(eq(productsTable.id, productId));
  }

  const [updated] = await tx.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, order.id)).returning();
  await tx.insert(orderStatusHistoryTable).values({
    orderId: order.id,
    status: "cancelled",
    notes: input.notes || "تم إلغاء الطلب واستعادة المخزون",
    employeeId: input.actor.employeeId,
    employeeName: input.actor.employeeName ?? null,
  });
  await insertAudit(tx, input.actor, {
    action: "order.cancelled",
    orderId: order.id,
    description: `إلغاء الطلب ${order.orderNumber} واستعادة مخزونه`,
    afterData: { status: "cancelled", notes: input.notes ?? null },
  });
  return { order: updated, restored: true };
}

export async function transitionOrderStatus(input: {
  orderId: number;
  targetStatus: OrderStatus;
  notes?: string | null;
  trackingNumber?: string | null;
  shippingCompany?: string | null;
  actor: Actor;
}) {
  return db.transaction(async tx => {
    if (input.targetStatus === "cancelled") {
      await tx.select({ id: cancellationRequestsTable.id }).from(cancellationRequestsTable)
        .where(and(eq(cancellationRequestsTable.orderId, input.orderId), eq(cancellationRequestsTable.status, "pending"))).for("update");
      const result = await cancelOrderTx(tx, input);
      await tx.update(cancellationRequestsTable).set({
        status: "approved", employeeDecision: "approved", employeeNotes: input.notes ?? null,
        employeeId: input.actor.employeeId, decidedAt: new Date(),
      }).where(and(eq(cancellationRequestsTable.orderId, input.orderId), eq(cancellationRequestsTable.status, "pending")));
      return result.order;
    }
    const [order] = await tx.select().from(ordersTable).where(eq(ordersTable.id, input.orderId)).for("update");
    if (!order) throw new OrderStateError("NOT_FOUND", "الطلب غير موجود");
    if (order.status === input.targetStatus) return order;
    if (!allowedTransitions[order.status].includes(input.targetStatus)) {
      throw new OrderStateError("INVALID_TRANSITION", `انتقال غير مسموح من ${order.status} إلى ${input.targetStatus}`);
    }
    const [updated] = await tx.update(ordersTable).set({
      status: input.targetStatus,
      ...(input.trackingNumber != null && { trackingNumber: input.trackingNumber }),
      ...(input.shippingCompany != null && { shippingCompany: input.shippingCompany }),
    }).where(eq(ordersTable.id, input.orderId)).returning();
    await tx.insert(orderStatusHistoryTable).values({
      orderId: input.orderId, status: input.targetStatus, notes: input.notes ?? null,
      employeeId: input.actor.employeeId, employeeName: input.actor.employeeName ?? null,
    });
    await insertAudit(tx, input.actor, {
      action: "order.status_update", orderId: input.orderId,
      description: `تغيير حالة الطلب ${order.orderNumber} إلى ${input.targetStatus}`,
      afterData: { status: input.targetStatus, notes: input.notes ?? null },
    });
    return updated;
  });
}

export async function decideCancellation(input: {
  orderId: number;
  decision: "approved" | "rejected";
  notes?: string | null;
  actor: Actor;
}) {
  return db.transaction(async tx => {
    const requests = await tx.select().from(cancellationRequestsTable)
      .where(eq(cancellationRequestsTable.orderId, input.orderId)).orderBy(cancellationRequestsTable.createdAt).for("update");
    const request = requests.find(row => row.status === "pending") ?? requests.at(-1);
    if (!request) throw new OrderStateError("NO_PENDING_REQUEST", "لا يوجد طلب إلغاء للمراجعة");
    if (request.status !== "pending") {
      if (request.status === input.decision) {
        const [order] = await tx.select().from(ordersTable).where(eq(ordersTable.id, input.orderId));
        if (!order) throw new OrderStateError("NOT_FOUND", "الطلب غير موجود");
        return order;
      }
      throw new OrderStateError("NO_PENDING_REQUEST", "تم اتخاذ قرار سابق على طلب الإلغاء");
    }

    if (input.decision === "approved") await cancelOrderTx(tx, input);
    const [updatedRequest] = await tx.update(cancellationRequestsTable).set({
      status: input.decision,
      employeeDecision: input.decision,
      employeeNotes: input.notes ?? null,
      employeeId: input.actor.employeeId,
      decidedAt: new Date(),
    }).where(and(eq(cancellationRequestsTable.id, request.id), eq(cancellationRequestsTable.status, "pending"))).returning();
    if (!updatedRequest) throw new OrderStateError("NO_PENDING_REQUEST", "تم اتخاذ قرار سابق على طلب الإلغاء");

    if (input.decision === "rejected") {
      await insertAudit(tx, input.actor, {
        action: "order.cancellation_rejected", orderId: input.orderId,
        description: "رفض طلب إلغاء الطلب", afterData: { notes: input.notes ?? null },
      });
    }
    const [order] = await tx.select().from(ordersTable).where(eq(ordersTable.id, input.orderId));
    if (!order) throw new OrderStateError("NOT_FOUND", "الطلب غير موجود");
    return order;
  });
}
