import { Router, type IRouter } from "express";
import { db, customersTable, ordersTable } from "@workspace/db";
import { eq, ilike, sql } from "drizzle-orm";
import { requireAdminAuth } from "../../lib/auth";

const router: IRouter = Router();
router.use(requireAdminAuth);

router.get("/admin/customers", async (req, res): Promise<void> => {
  const { page = "1", limit = "20", q } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const where = q ? ilike(customersTable.name, `%${q}%`) : undefined;

  const [customers, [{ count }]] = await Promise.all([
    db.select().from(customersTable).where(where).limit(limitNum).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(customersTable).where(where),
  ]);

  const enriched = await Promise.all(customers.map(async (c) => {
    const [stats] = await db.select({
      totalOrders: sql<number>`count(*)::int`,
      totalSpend: sql<number>`coalesce(sum(total::numeric), 0)`,
      avgOrderValue: sql<number>`coalesce(avg(total::numeric), 0)`,
    }).from(ordersTable).where(eq(ordersTable.customerId, c.id));
    const [lastOrder] = await db.select({ createdAt: ordersTable.createdAt }).from(ordersTable)
      .where(eq(ordersTable.customerId, c.id)).orderBy(sql`created_at desc`).limit(1);
    return {
      id: c.id, name: c.name, email: c.email, mobile: c.mobile, isBlocked: c.isBlocked,
      totalOrders: stats.totalOrders, totalSpend: Number(stats.totalSpend),
      avgOrderValue: Number(stats.avgOrderValue),
      lastOrderDate: lastOrder?.createdAt || null, internalNotes: c.internalNotes, createdAt: c.createdAt,
    };
  }));

  res.json({ items: enriched, total: count, page: pageNum, limit: limitNum });
});

router.get("/admin/customers/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [c] = await db.select().from(customersTable).where(eq(customersTable.id, id));
  if (!c) { res.status(404).json({ error: "Customer not found" }); return; }

  const [stats] = await db.select({
    totalOrders: sql<number>`count(*)::int`,
    totalSpend: sql<number>`coalesce(sum(total::numeric), 0)`,
    avgOrderValue: sql<number>`coalesce(avg(total::numeric), 0)`,
  }).from(ordersTable).where(eq(ordersTable.customerId, id));
  const [lastOrder] = await db.select({ createdAt: ordersTable.createdAt }).from(ordersTable)
    .where(eq(ordersTable.customerId, id)).orderBy(sql`created_at desc`).limit(1);

  res.json({
    id: c.id, name: c.name, email: c.email, mobile: c.mobile, isBlocked: c.isBlocked,
    totalOrders: stats.totalOrders, totalSpend: Number(stats.totalSpend),
    avgOrderValue: Number(stats.avgOrderValue),
    lastOrderDate: lastOrder?.createdAt || null, internalNotes: c.internalNotes, createdAt: c.createdAt,
  });
});

router.patch("/admin/customers/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { isBlocked, internalNotes } = req.body;

  const [c] = await db.update(customersTable).set({
    ...(isBlocked !== undefined && { isBlocked }), ...(internalNotes !== undefined && { internalNotes }),
  }).where(eq(customersTable.id, id)).returning();

  if (!c) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json({ id: c.id, name: c.name, email: c.email, mobile: c.mobile, isBlocked: c.isBlocked, totalOrders: 0, totalSpend: 0, avgOrderValue: 0, lastOrderDate: null, internalNotes: c.internalNotes, createdAt: c.createdAt });
});

export default router;
