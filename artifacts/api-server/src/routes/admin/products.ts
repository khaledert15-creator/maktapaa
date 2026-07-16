import { Router, type IRouter } from "express";
import { db, productsTable, productImagesTable, stagesTable, gradesTable, subjectsTable, publishersTable, stockMovementsTable } from "@workspace/db";
import { eq, and, ilike, desc, isNull, sql } from "drizzle-orm";
import { requireAdminAuth, requireAdminPermission } from "../../lib/auth";
import multer from "multer";
import { imageStorage } from "../../services/storage";
import { writeAuditLog } from "../../services/audit";

const router: IRouter = Router();
router.use(requireAdminAuth);
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, callback) => callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
});

function mapAdminProduct(p: typeof productsTable.$inferSelect) {
  return {
    id: p.id, nameAr: p.nameAr, nameEn: p.nameEn, slug: p.slug,
    descriptionShort: p.descriptionShort, descriptionFull: p.descriptionFull,
    coverImage: p.coverImage, images: p.images,
    price: Number(p.price), oldPrice: p.oldPrice ? Number(p.oldPrice) : null,
    purchasePrice: p.purchasePrice ? Number(p.purchasePrice) : null,
    sku: p.sku, barcode: p.barcode, status: p.status,
    stockQuantity: p.stockQuantity, reservedQuantity: p.reservedQuantity,
    minStockLevel: p.minStockLevel,
    stageId: p.stageId, gradeId: p.gradeId, subjectId: p.subjectId, publisherId: p.publisherId, categoryId: p.categoryId,
    educationType: p.educationType, bookType: p.bookType, edition: p.edition,
    schoolYear: p.schoolYear,
    isBestSeller: p.isBestSeller, isFeatured: p.isFeatured, isNew: p.isNew,
    isRevision: p.isRevision, isBundle: p.isBundle, sortOrder: p.sortOrder,
    isOffer: p.isOffer, freeShipping: p.freeShipping,
    freeShippingStartAt: p.freeShippingStartAt, freeShippingEndAt: p.freeShippingEndAt,
    freeShippingBadgeText: p.freeShippingBadgeText,
    seoTitle: p.seoTitle, seoDescription: p.seoDescription,
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

router.post("/admin/products", requireAdminPermission("products.create"), async (req, res): Promise<void> => {
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

  await writeAuditLog(req, { action: "product.create", entityType: "product", entityId: product.id, description: `إنشاء المنتج ${product.nameAr}`, afterData: mapAdminProduct(product) });

  res.status(201).json(mapAdminProduct(product));
});

router.get("/admin/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [product] = await db.select().from(productsTable).where(and(eq(productsTable.id, id), isNull(productsTable.deletedAt)));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(mapAdminProduct(product));
});

router.patch("/admin/products/:id", requireAdminPermission("products.edit"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { price, oldPrice, purchasePrice, stockQuantity, ...rest } = req.body;
  const [before] = await db.select().from(productsTable).where(eq(productsTable.id, id));

  const updateData: Record<string, unknown> = { ...rest };
  if (price !== undefined) updateData.price = String(price);
  if (oldPrice !== undefined) updateData.oldPrice = oldPrice ? String(oldPrice) : null;
  if (purchasePrice !== undefined) updateData.purchasePrice = purchasePrice ? String(purchasePrice) : null;

  const [product] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, id)).returning();
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  await writeAuditLog(req, { action: "product.update", entityType: "product", entityId: id, description: `تعديل المنتج ${product.nameAr}`, beforeData: before ? mapAdminProduct(before) : null, afterData: mapAdminProduct(product) });
  res.json(mapAdminProduct(product));
});

router.delete("/admin/products/:id", requireAdminPermission("products.delete"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.update(productsTable).set({ deletedAt: new Date(), status: "archived" }).where(eq(productsTable.id, id));
  await writeAuditLog(req, { action: "product.archive", entityType: "product", entityId: id, description: `أرشفة المنتج رقم ${id}` });
  res.sendStatus(204);
});

router.patch("/admin/products/:id/stock", requireAdminPermission("inventory.adjust"), async (req, res): Promise<void> => {
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
  await writeAuditLog(req, { action: "inventory.adjust", entityType: "product", entityId: id, description: `تعديل مخزون ${product.nameAr} من ${quantityBefore} إلى ${quantityAfter}`, beforeData: { stockQuantity: quantityBefore }, afterData: { stockQuantity: quantityAfter, reason } });

  res.json(mapAdminProduct(updated));
});

router.get("/admin/products/:id/images", async (req, res): Promise<void> => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  res.json(await db.select().from(productImagesTable).where(eq(productImagesTable.productId, id)).orderBy(productImagesTable.sortOrder));
});

router.post("/admin/products/:id/images", requireAdminPermission("products.images.manage"), imageUpload.array("images", 10), async (req, res): Promise<void> => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const files = req.files as Express.Multer.File[];
  if (!files?.length) { res.status(400).json({ error: "اختر صورة واحدة على الأقل" }); return; }
  const existing = await db.select().from(productImagesTable).where(eq(productImagesTable.productId, id));
  const created = [];
  for (let index = 0; index < files.length; index += 1) {
    const stored = await imageStorage.saveImage(files[index].buffer);
    const [image] = await db.insert(productImagesTable).values({ productId: id, url: stored.url, storageKey: stored.storageKey, altText: req.body.altText || null, sortOrder: existing.length + index, isPrimary: existing.length === 0 && index === 0 }).returning();
    created.push(image);
  }
  const primary = created.find(image => image.isPrimary);
  if (primary) await db.update(productsTable).set({ coverImage: primary.url }).where(eq(productsTable.id, id));
  await writeAuditLog(req, { action: "product.images.upload", entityType: "product", entityId: id, description: `رفع ${created.length} صورة للمنتج` });
  res.status(201).json(created);
});

router.patch("/admin/products/:productId/images/:imageId", requireAdminPermission("products.images.manage"), async (req, res): Promise<void> => {
  const productId = Number(Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId);
  const imageId = Number(Array.isArray(req.params.imageId) ? req.params.imageId[0] : req.params.imageId);
  const { altText, sortOrder, isPrimary } = req.body;
  if (isPrimary) await db.update(productImagesTable).set({ isPrimary: false }).where(eq(productImagesTable.productId, productId));
  const [image] = await db.update(productImagesTable).set({ ...(altText !== undefined && { altText }), ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }), ...(isPrimary !== undefined && { isPrimary: Boolean(isPrimary) }) }).where(eq(productImagesTable.id, imageId)).returning();
  if (!image) { res.status(404).json({ error: "الصورة غير موجودة" }); return; }
  if (image.isPrimary) await db.update(productsTable).set({ coverImage: image.url }).where(eq(productsTable.id, productId));
  await writeAuditLog(req, { action: "product.images.update", entityType: "product", entityId: productId, description: "تحديث ترتيب أو صورة المنتج الرئيسية" });
  res.json(image);
});

router.delete("/admin/products/:productId/images/:imageId", requireAdminPermission("products.images.manage"), async (req, res): Promise<void> => {
  const productId = Number(Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId);
  const imageId = Number(Array.isArray(req.params.imageId) ? req.params.imageId[0] : req.params.imageId);
  const [image] = await db.delete(productImagesTable).where(eq(productImagesTable.id, imageId)).returning();
  if (!image) { res.status(404).json({ error: "الصورة غير موجودة" }); return; }
  await imageStorage.deleteImage(image.storageKey);
  if (image.isPrimary) {
    const [next] = await db.select().from(productImagesTable).where(eq(productImagesTable.productId, productId)).orderBy(productImagesTable.sortOrder).limit(1);
    if (next) await db.update(productImagesTable).set({ isPrimary: true }).where(eq(productImagesTable.id, next.id));
    await db.update(productsTable).set({ coverImage: next?.url ?? null }).where(eq(productsTable.id, productId));
  }
  await writeAuditLog(req, { action: "product.images.delete", entityType: "product", entityId: productId, description: "حذف صورة منتج" });
  res.sendStatus(204);
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
