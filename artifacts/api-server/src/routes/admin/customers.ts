import { Router, type IRouter } from "express";
import { db, customersTable, ordersTable } from "@workspace/db";
import { eq, ilike, inArray, sql } from "drizzle-orm";
import { requireAdminAuth, requireAdminPermission } from "../../lib/auth";
import { parseBody } from "../../lib/validation";
import { z } from "@workspace/api-zod";

const router: IRouter = Router();
router.use(requireAdminAuth);

router.get("/admin/customers", requireAdminPermission("customers.view"), async (req, res): Promise<void> => {
  const { page = "1", limit = "20", q } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const where = q ? ilike(customersTable.name, `%${q}%`) : undefined;

  const [customers, [{ count }]] = await Promise.all([
    db.select().from(customersTable).where(where).limit(limitNum).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(customersTable).where(where),
  ]);

  const customerIds = customers.map(customer => customer.id);
  const aggregateRows = customerIds.length ? await db.select({
    customerId: ordersTable.customerId,
    totalOrders: sql<number>`count(*)::int`,
    totalSpend: sql<string>`coalesce(sum(${ordersTable.total}::numeric), 0)::text`,
    avgOrderValue: sql<string>`coalesce(avg(${ordersTable.total}::numeric), 0)::text`,
    lastOrderDate: sql<Date | null>`max(${ordersTable.createdAt})`,
  }).from(ordersTable)
    .where(inArray(ordersTable.customerId, customerIds))
    .groupBy(ordersTable.customerId) : [];
  const aggregateMap = new Map(aggregateRows.map(row => [row.customerId, row]));

  const enriched = customers.map((c) => {
    const stats = aggregateMap.get(c.id);
    return {
      id: c.id, name: c.name, email: c.email, mobile: c.mobile, isBlocked: c.isBlocked,
      totalOrders: stats?.totalOrders ?? 0, totalSpend: Number(stats?.totalSpend ?? 0),
      avgOrderValue: Number(stats?.avgOrderValue ?? 0),
      lastOrderDate: stats?.lastOrderDate ?? null, internalNotes: c.internalNotes, createdAt: c.createdAt,
    };
  });

  res.json({ items: enriched, total: count, page: pageNum, limit: limitNum });
});

router.get("/admin/customers/:id", requireAdminPermission("customers.view"), async (req, res): Promise<void> => {
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

router.patch("/admin/customers/:id", requireAdminPermission("customers.edit"), async (req, res): Promise<void> => {
  const input = parseBody(z.object({ isBlocked: z.boolean().optional(), internalNotes: z.string().max(5000).nullable().optional() }), req.body, res); if (!input) return;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { isBlocked, internalNotes } = input;

  const [c] = await db.update(customersTable).set({
    ...(isBlocked !== undefined && { isBlocked }), ...(internalNotes !== undefined && { internalNotes }),
  }).where(eq(customersTable.id, id)).returning();

  if (!c) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json({ id: c.id, name: c.name, email: c.email, mobile: c.mobile, isBlocked: c.isBlocked, totalOrders: 0, totalSpend: 0, avgOrderValue: 0, lastOrderDate: null, internalNotes: c.internalNotes, createdAt: c.createdAt });
});

export default router;
