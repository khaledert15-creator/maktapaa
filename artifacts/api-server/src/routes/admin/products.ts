import { Router, type IRouter } from "express";
import { db, productsTable, stagesTable, gradesTable, subjectsTable, publishersTable, stockMovementsTable } from "@workspace/db";
import { eq, and, ilike, desc, isNull, sql } from "drizzle-orm";
import { requireAdminAuth } from "../../lib/auth";

const router: IRouter = Router();
router.use(requireAdminAuth);

function mapAdminProduct(p: typeof productsTable.$inferSelect) {
  return {
    id: p.id, nameAr: p.nameAr, nameEn: p.nameEn, slug: p.slug,
    descriptionShort: p.descriptionShort, descriptionFull: p.descriptionFull,
    coverImage: p.coverImage, images: p.images,
    price: Number(p.price), oldPrice: p.oldPrice ? Number(p.oldPrice) : null,
    sku: p.sku, barcode: p.barcode, status: p.status,
    stockQuantity: p.stockQuantity, reservedQuantity: p.reservedQuantity,
    minStockLevel: p.minStockLevel,
    stageId: p.stageId, gradeId: p.gradeId, subjectId: p.subjectId, publisherId: p.publisherId,
    educationType: p.educationType, bookType: p.bookType, edition: p.edition,
    schoolYear: p.schoolYear,
    isBestSeller: p.isBestSeller, isFeatured: p.isFeatured, isNew: p.isNew,
    isRevision: p.isRevision, isBundle: p.isBundle, sortOrder: p.sortOrder,
    internalNotes: p.internalNotes,
    createdAt: p.createdAt, updatedAt: p.updatedAt,
  };
}

function slugify(text: string): string {
  return text.toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06FF-]/g, "")
    .replace(/--+/g, "-")
    .trim();
}

router.get("/admin/products", async (req, res): Promise<void> => {
  const { page = "1", limit = "20", q, status } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const conditions = [isNull(productsTable.deletedAt) as ReturnType<typeof eq>];
  if (q) conditions.push(ilike(productsTable.nameAr, `%${q}%`));
  if (status) conditions.push(eq(productsTable.status, status as "active" | "draft" | "archived"));

  const whereClause = and(...conditions);
  const [items, [{ count }]] = await Promise.all([
    db.select().from(productsTable).where(whereClause).orderBy(desc(productsTable.createdAt)).limit(limitNum).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(whereClause),
  ]);

  res.json({ items: items.map(mapAdminProduct), total: count, page: pageNum, limit: limitNum });
});

router.post("/admin/products", async (req, res): Promise<void> => {
  const { nameAr, nameEn, price, oldPrice, sku, barcode, status, stockQuantity, ...rest } = req.body;
  if (!nameAr || !price) { res.status(400).json({ error: "الاسم العربي والسعر مطلوبان" }); return; }

  const slug = slugify(nameAr) + "-" + Date.now();

  const [product] = await db.insert(productsTable).values({
    nameAr, nameEn: nameEn || null, slug,
    price: String(price), oldPrice: oldPrice ? String(oldPrice) : null,
    sku: sku || null, barcode: barcode || null,
    status: status || "draft",
    stockQuantity: parseInt(stockQuantity, 10) || 0,
    ...rest,
  }).returning();

  res.status(201).json(mapAdminProduct(product));
});

router.get("/admin/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [product] = await db.select().from(productsTable).where(and(eq(productsTable.id, id), isNull(productsTable.deletedAt)));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(mapAdminProduct(product));
});

router.patch("/admin/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { price, oldPrice, stockQuantity, ...rest } = req.body;

  const updateData: Record<string, unknown> = { ...rest };
  if (price !== undefined) updateData.price = String(price);
  if (oldPrice !== undefined) updateData.oldPrice = oldPrice ? String(oldPrice) : null;

  const [product] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, id)).returning();
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(mapAdminProduct(product));
});

router.delete("/admin/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.update(productsTable).set({ deletedAt: new Date(), status: "archived" }).where(eq(productsTable.id, id));
  res.sendStatus(204);
});

router.patch("/admin/products/:id/stock", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { quantity, movementType, reason } = req.body;
  

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  const quantityBefore = product.stockQuantity;
  let quantityAfter = quantityBefore;

  if (["purchase", "return", "manual_increase", "adjustment"].includes(movementType)) {
    quantityAfter = quantityBefore + Math.abs(quantity);
  } else {
    quantityAfter = Math.max(0, quantityBefore - Math.abs(quantity));
  }

  const [updated] = await db.update(productsTable).set({ stockQuantity: quantityAfter }).where(eq(productsTable.id, id)).returning();

  await db.insert(stockMovementsTable).values({
    productId: id, movementType, quantityBefore, quantityAfter,
    quantityChanged: quantityAfter - quantityBefore, reason: reason || null,
    employeeId: req.session.adminId as number || null,
  });

  res.json(mapAdminProduct(updated));
});

// Admin classifications
router.get("/admin/stages", async (_req, res): Promise<void> => {
  res.json(await db.select().from(stagesTable));
});
router.post("/admin/stages", async (req, res): Promise<void> => {
  const [s] = await db.insert(stagesTable).values(req.body).returning();
  res.status(201).json(s);
});
router.patch("/admin/stages/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [s] = await db.update(stagesTable).set(req.body).where(eq(stagesTable.id, id)).returning();
  res.json(s);
});
router.delete("/admin/stages/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.update(stagesTable).set({ isActive: false }).where(eq(stagesTable.id, id));
  res.sendStatus(204);
});

router.get("/admin/grades", async (_req, res): Promise<void> => {
  res.json(await db.select().from(gradesTable));
});
router.post("/admin/grades", async (req, res): Promise<void> => {
  const [g] = await db.insert(gradesTable).values(req.body).returning();
  res.status(201).json(g);
});
router.patch("/admin/grades/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [g] = await db.update(gradesTable).set(req.body).where(eq(gradesTable.id, id)).returning();
  res.json(g);
});
router.delete("/admin/grades/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.update(gradesTable).set({ isActive: false }).where(eq(gradesTable.id, id));
  res.sendStatus(204);
});

router.get("/admin/subjects", async (_req, res): Promise<void> => {
  res.json(await db.select().from(subjectsTable));
});
router.post("/admin/subjects", async (req, res): Promise<void> => {
  const [s] = await db.insert(subjectsTable).values(req.body).returning();
  res.status(201).json(s);
});
router.patch("/admin/subjects/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [s] = await db.update(subjectsTable).set(req.body).where(eq(subjectsTable.id, id)).returning();
  res.json(s);
});
router.delete("/admin/subjects/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.update(subjectsTable).set({ isActive: false }).where(eq(subjectsTable.id, id));
  res.sendStatus(204);
});

router.get("/admin/publishers", async (_req, res): Promise<void> => {
  res.json(await db.select().from(publishersTable));
});
router.post("/admin/publishers", async (req, res): Promise<void> => {
  const [p] = await db.insert(publishersTable).values(req.body).returning();
  res.status(201).json(p);
});
router.patch("/admin/publishers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [p] = await db.update(publishersTable).set(req.body).where(eq(publishersTable.id, id)).returning();
  res.json(p);
});
router.delete("/admin/publishers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.update(publishersTable).set({ isActive: false }).where(eq(publishersTable.id, id));
  res.sendStatus(204);
});

// Stock movements
router.get("/admin/stock-movements", async (req, res): Promise<void> => {
  const { page = "1", limit = "20", productId } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const where = productId ? eq(stockMovementsTable.productId, parseInt(productId, 10)) : undefined;
  const [items, [{ count }]] = await Promise.all([
    db.select().from(stockMovementsTable).where(where).orderBy(desc(stockMovementsTable.createdAt)).limit(limitNum).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(stockMovementsTable).where(where),
  ]);

  res.json({ items: items.map(m => ({ ...m, quantityBefore: m.quantityBefore, quantityAfter: m.quantityAfter, productNameAr: null })), total: count, page: pageNum, limit: limitNum });
});

export default router;
