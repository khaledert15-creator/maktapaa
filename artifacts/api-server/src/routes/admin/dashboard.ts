import { Router, type IRouter } from "express";
import { db, ordersTable, productsTable, customersTable } from "@workspace/db";
import { eq, gte, sql, and } from "drizzle-orm";
import { requireAdminAuth } from "../../lib/auth";

const router: IRouter = Router();
router.use(requireAdminAuth);

router.get("/admin/dashboard/summary", async (_req, res): Promise<void> => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    [{ salesToday }], [{ salesWeek }], [{ salesMonth }],
    [{ totalOrders }], [{ newOrders }], [{ pendingOrders }],
    [{ preparingOrders }], [{ shippedOrders }], [{ deliveredOrders }],
    [{ cancelledOrders }], [{ returnedOrders }],
    [{ lowStockCount }], [{ outOfStockCount }],
    [{ totalCustomers }],
  ] = await Promise.all([
    db.select({ salesToday: sql<number>`coalesce(sum(total::numeric), 0)` }).from(ordersTable).where(and(gte(ordersTable.createdAt, todayStart), eq(ordersTable.status, "delivered"))),
    db.select({ salesWeek: sql<number>`coalesce(sum(total::numeric), 0)` }).from(ordersTable).where(and(gte(ordersTable.createdAt, weekStart), eq(ordersTable.status, "delivered"))),
    db.select({ salesMonth: sql<number>`coalesce(sum(total::numeric), 0)` }).from(ordersTable).where(and(gte(ordersTable.createdAt, monthStart), eq(ordersTable.status, "delivered"))),
    db.select({ totalOrders: sql<number>`count(*)::int` }).from(ordersTable),
    db.select({ newOrders: sql<number>`count(*)::int` }).from(ordersTable).where(eq(ordersTable.status, "new")),
    db.select({ pendingOrders: sql<number>`count(*)::int` }).from(ordersTable).where(eq(ordersTable.status, "awaiting_confirmation")),
    db.select({ preparingOrders: sql<number>`count(*)::int` }).from(ordersTable).where(eq(ordersTable.status, "preparing")),
    db.select({ shippedOrders: sql<number>`count(*)::int` }).from(ordersTable).where(eq(ordersTable.status, "shipped")),
    db.select({ deliveredOrders: sql<number>`count(*)::int` }).from(ordersTable).where(eq(ordersTable.status, "delivered")),
    db.select({ cancelledOrders: sql<number>`count(*)::int` }).from(ordersTable).where(eq(ordersTable.status, "cancelled")),
    db.select({ returnedOrders: sql<number>`count(*)::int` }).from(ordersTable).where(eq(ordersTable.status, "returned")),
    db.select({ lowStockCount: sql<number>`count(*)::int` }).from(productsTable).where(and(sql`${productsTable.stockQuantity} > 0 AND ${productsTable.stockQuantity} <= ${productsTable.minStockLevel}` as ReturnType<typeof eq>, eq(productsTable.status, "active"))),
    db.select({ outOfStockCount: sql<number>`count(*)::int` }).from(productsTable).where(and(eq(productsTable.stockQuantity, 0), eq(productsTable.status, "active"))),
    db.select({ totalCustomers: sql<number>`count(*)::int` }).from(customersTable),
  ]);

  const [avgResult] = await db.select({ avg: sql<number>`coalesce(avg(total::numeric), 0)` }).from(ordersTable);

  res.json({
    salesToday: Number(salesToday), salesThisWeek: Number(salesWeek), salesThisMonth: Number(salesMonth),
    totalOrders, newOrders, pendingOrders, preparingOrders, shippedOrders, deliveredOrders,
    cancelledOrders, returnedOrders, lowStockCount, outOfStockCount,
    avgOrderValue: Number(avgResult.avg), totalCustomers,
  });
});

router.get("/admin/dashboard/sales-chart", async (req, res): Promise<void> => {
  const { period = "30d" } = req.query as { period: string };
  const days = period === "7d" ? 7 : period === "90d" ? 90 : period === "365d" ? 365 : 30;
  const start = new Date();
  start.setDate(start.getDate() - days);

  const rows = await db.select({
    date: sql<string>`date(created_at)`,
    amount: sql<number>`coalesce(sum(total::numeric), 0)`,
    orderCount: sql<number>`count(*)::int`,
  }).from(ordersTable)
    .where(gte(ordersTable.createdAt, start))
    .groupBy(sql`date(created_at)`)
    .orderBy(sql`date(created_at)`);

  res.json(rows.map(r => ({ date: r.date, amount: Number(r.amount), orderCount: r.orderCount })));
});

router.get("/admin/dashboard/recent-orders", async (_req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable).orderBy(sql`created_at desc`).limit(10);
  res.json(orders.map(o => ({
    id: o.id, orderNumber: o.orderNumber, customerName: o.customerName, mobile: o.mobile,
    governorate: o.governorateName, status: o.status, paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod, total: Number(o.total), itemCount: 0, createdAt: o.createdAt,
  })));
});

router.get("/admin/dashboard/top-products", async (_req, res): Promise<void> => {
  const products = await db.select({
    productId: productsTable.id, nameAr: productsTable.nameAr, coverImage: productsTable.coverImage,
    soldCount: productsTable.salesCount,
    revenue: sql<number>`(${productsTable.price}::numeric * ${productsTable.salesCount})`,
  }).from(productsTable)
    .where(eq(productsTable.status, "active"))
    .orderBy(sql`${productsTable.salesCount} desc`)
    .limit(10);

  res.json(products.map(p => ({ ...p, revenue: Number(p.revenue) })));
});

router.get("/admin/dashboard/low-stock", async (_req, res): Promise<void> => {
  const products = await db.select({
    productId: productsTable.id, nameAr: productsTable.nameAr, sku: productsTable.sku,
    stockQuantity: productsTable.stockQuantity, minStockLevel: productsTable.minStockLevel,
  }).from(productsTable)
    .where(and(sql`${productsTable.stockQuantity} <= ${productsTable.minStockLevel}` as ReturnType<typeof eq>, eq(productsTable.status, "active")))
    .orderBy(productsTable.stockQuantity)
    .limit(20);

  res.json(products);
});

export default router;
