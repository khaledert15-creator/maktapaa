import { Router, type IRouter } from "express";
import { db, ordersTable, productsTable } from "@workspace/db";
import { gte, lte, and, eq, sql } from "drizzle-orm";
import { requireAdminAuth } from "../../lib/auth";

const router: IRouter = Router();
router.use(requireAdminAuth);

router.get("/admin/reports/sales", async (req, res): Promise<void> => {
  const { dateFrom, dateTo, groupBy = "day" } = req.query as Record<string, string>;
  if (!dateFrom || !dateTo) { res.status(400).json({ error: "dateFrom and dateTo required" }); return; }

  const from = new Date(dateFrom);
  const to = new Date(dateTo);

  const [summary] = await db.select({
    totalRevenue: sql<number>`coalesce(sum(total::numeric), 0)`,
    totalOrders: sql<number>`count(*)::int`,
    avgOrderValue: sql<number>`coalesce(avg(total::numeric), 0)`,
  }).from(ordersTable).where(and(gte(ordersTable.createdAt, from), lte(ordersTable.createdAt, to)));

  const data = await db.select({
    date: sql<string>`date(created_at)`,
    amount: sql<number>`coalesce(sum(total::numeric), 0)`,
    orderCount: sql<number>`count(*)::int`,
  }).from(ordersTable)
    .where(and(gte(ordersTable.createdAt, from), lte(ordersTable.createdAt, to)))
    .groupBy(sql`date(created_at)`)
    .orderBy(sql`date(created_at)`);

  res.json({
    dateFrom, dateTo,
    totalRevenue: Number(summary.totalRevenue),
    totalOrders: summary.totalOrders,
    avgOrderValue: Number(summary.avgOrderValue),
    data: data.map(d => ({ date: d.date, amount: Number(d.amount), orderCount: d.orderCount })),
  });
});

router.get("/admin/reports/inventory", async (_req, res): Promise<void> => {
  const [{ totalProducts }] = await db.select({ totalProducts: sql<number>`count(*)::int` }).from(productsTable).where(eq(productsTable.status, "active"));
  const [{ inStockCount }] = await db.select({ inStockCount: sql<number>`count(*)::int` }).from(productsTable).where(and(eq(productsTable.status, "active"), sql`${productsTable.stockQuantity} > ${productsTable.minStockLevel}` as ReturnType<typeof eq>));
  const [{ lowStockCount }] = await db.select({ lowStockCount: sql<number>`count(*)::int` }).from(productsTable).where(and(eq(productsTable.status, "active"), sql`${productsTable.stockQuantity} > 0 AND ${productsTable.stockQuantity} <= ${productsTable.minStockLevel}` as ReturnType<typeof eq>));
  const [{ outOfStockCount }] = await db.select({ outOfStockCount: sql<number>`count(*)::int` }).from(productsTable).where(and(eq(productsTable.status, "active"), eq(productsTable.stockQuantity, 0)));
  const [{ totalValue }] = await db.select({ totalValue: sql<number>`coalesce(sum(price::numeric * stock_quantity), 0)` }).from(productsTable).where(eq(productsTable.status, "active"));

  res.json({ totalProducts, inStockCount, lowStockCount, outOfStockCount, totalInventoryValue: Number(totalValue) });
});

export default router;
