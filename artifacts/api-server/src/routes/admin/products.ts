import { Router, type IRouter } from "express";
import { db, productsTable, productImagesTable, stagesTable, gradesTable, subjectsTable, publishersTable, stockMovementsTable } from "@workspace/db";
import { eq, and, ilike, desc, isNull, sql } from "drizzle-orm";
import { hasAdminPermission, requireAdminAuth, requireAdminPermission } from "../../lib/auth";
import multer from "multer";
import { imageStorage } from "../../services/storage";
import { writeAuditLog } from "../../services/audit";
import { parseBody } from "../../lib/validation";
import { z } from "@workspace/api-zod";

const router: IRouter = Router();
router.use(requireAdminAuth);
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, callback) => callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
});

const optionalId = z.coerce.number().int().positive().nullable().optional();
const productSchema = z.object({
  nameAr: z.string().trim().min(2).max(300), nameEn: z.string().trim().max(300).nullable().optional(),
  descriptionShort: z.string().max(2000).nullable().optional(), descriptionFull: z.string().max(30_000).nullable().optional(),
  price: z.coerce.number().min(0), oldPrice: z.coerce.number().min(0).nullable().optional(), purchasePrice: z.coerce.number().min(0).nullable().optional(),
  sku: z.string().trim().max(100).nullable().optional(), barcode: z.string().trim().max(100).nullable().optional(),
  status: z.enum(["active", "draft", "archived"]).optional(), stockQuantity: z.coerce.number().int().min(0).optional(), minStockLevel: z.coerce.number().int().min(0).optional(),
  stageId: optionalId, gradeId: optionalId, subjectId: optionalId, publisherId: optionalId, categoryId: optionalId,
  educationType: z.string().max(100).nullable().optional(), bookType: z.string().max(100).nullable().optional(), edition: z.string().max(100).nullable().optional(), schoolYear: z.string().max(30).nullable().optional(), author: z.string().max(300).nullable().optional(),
  isBestSeller: z.boolean().optional(), isFeatured: z.boolean().optional(), isNew: z.boolean().optional(), isRevision: z.boolean().optional(), isBundle: z.boolean().optional(), isOffer: z.boolean().optional(), freeShipping: z.boolean().optional(),
  freeShippingStartAt: z.coerce.date().nullable().optional(), freeShippingEndAt: z.coerce.date().nullable().optional(), freeShippingBadgeText: z.string().max(100).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(), seoTitle: z.string().max(300).nullable().optional(), seoDescription: z.string().max(1000).nullable().optional(), internalNotes: z.string().max(5000).nullable().optional(),
});
const productUpdateSchema = productSchema.partial().omit({ stockQuantity: true });
const stockSchema = z.object({ quantity: z.coerce.number().int().positive().max(1_000_000), movementType: z.enum(["purchase", "return", "damaged", "manual_increase", "manual_decrease", "adjustment"]), reason: z.string().trim().min(3).max(1000) });
const imageUpdateSchema = z.object({ altText: z.string().max(500).nullable().optional(), sortOrder: z.coerce.number().int().min(0).max(10_000).optional(), isPrimary: z.boolean().optional() });
const classificationSchema = z.object({ nameAr: z.string().trim().min(2).max(200), nameEn: z.string().trim().max(200).nullable().optional(), sortOrder: z.coerce.number().int().min(0).max(10_000).optional(), isActive: z.boolean().optional(), stageId: optionalId, logo: z.string().max(2000).nullable().optional() });

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
    schoolYear: p.schoolYear, author: p.author,
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

router.get("/admin/products", requireAdminPermission("products.view"), async (req, res): Promise<void> => {
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
  const input = parseBody(productSchema, req.body, res); if (!input) return;
  const { nameAr, nameEn, price, oldPrice, purchasePrice, sku, barcode, status, stockQuantity, ...rest } = input;

  const slug = slugify(nameAr) + "-" + Date.now();

  const [product] = await db.insert(productsTable).values({
    nameAr, nameEn: nameEn || null, slug,
    price: String(price), oldPrice: oldPrice == null ? null : String(oldPrice), purchasePrice: purchasePrice == null ? null : String(purchasePrice),
    sku: sku || null, barcode: barcode || null,
    status: status || "draft",
    stockQuantity: stockQuantity ?? 0,
    ...rest,
  }).returning();

  await writeAuditLog(req, { action: "product.create", entityType: "product", entityId: product.id, description: `إنشاء المنتج ${product.nameAr}`, afterData: mapAdminProduct(product) });

  res.status(201).json(mapAdminProduct(product));
});

router.get("/admin/products/:id", requireAdminPermission("products.view"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [product] = await db.select().from(productsTable).where(and(eq(productsTable.id, id), isNull(productsTable.deletedAt)));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(mapAdminProduct(product));
});

router.patch("/admin/products/:id", requireAdminPermission("products.edit"), async (req, res): Promise<void> => {
  const input = parseBody(productUpdateSchema, req.body, res); if (!input) return;
  if ((input.price !== undefined || input.oldPrice !== undefined || input.purchasePrice !== undefined) && !hasAdminPermission(req, "prices.edit")) { res.status(403).json({ error: "ليس لديك صلاحية تعديل الأسعار" }); return; }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { price, oldPrice, purchasePrice, ...rest } = input;
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
  const input = parseBody(stockSchema, req.body, res); if (!input) return;
  const { quantity, movementType, reason } = input;
  

  const result = await db.transaction(async (tx) => {
    const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, id)).for("update");
    if (!product) return null;
    const quantityBefore = product.stockQuantity;
    const quantityAfter = ["purchase", "return", "manual_increase", "adjustment"].includes(movementType)
      ? quantityBefore + Math.abs(Number(quantity)) : Math.max(0, quantityBefore - Math.abs(Number(quantity)));
    const [updated] = await tx.update(productsTable).set({ stockQuantity: quantityAfter }).where(eq(productsTable.id, id)).returning();
    await tx.insert(stockMovementsTable).values({ productId: id, movementType, quantityBefore, quantityAfter, quantityChanged: quantityAfter - quantityBefore, reason: reason || null, employeeId: req.session.adminId as number || null });
    return { product, updated, quantityBefore, quantityAfter };
  });
  if (!result) { res.status(404).json({ error: "Product not found" }); return; }
  const { product, updated, quantityBefore, quantityAfter } = result;
  await writeAuditLog(req, { action: "inventory.adjust", entityType: "product", entityId: id, description: `تعديل مخزون ${product.nameAr} من ${quantityBefore} إلى ${quantityAfter}`, beforeData: { stockQuantity: quantityBefore }, afterData: { stockQuantity: quantityAfter, reason } });

  res.json(mapAdminProduct(updated));
});

router.get("/admin/products/:id/images", requireAdminPermission("products.view"), async (req, res): Promise<void> => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  res.json(await db.select().from(productImagesTable).where(eq(productImagesTable.productId, id)).orderBy(productImagesTable.sortOrder));
});

router.post("/admin/products/:id/images", requireAdminPermission("products.images.manage"), imageUpload.array("images", 10), async (req, res): Promise<void> => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const metadata = parseBody(z.object({ altText: z.string().max(500).optional() }), req.body, res); if (!metadata) return;
  const files = req.files as Express.Multer.File[];
  if (!files?.length) { res.status(400).json({ error: "اختر صورة واحدة على الأقل" }); return; }
  const [product] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.id, id));
  if (!product) { res.status(404).json({ error: "المنتج غير موجود" }); return; }
  const existing = await db.select().from(productImagesTable).where(eq(productImagesTable.productId, id));
  const created = [];
  for (let index = 0; index < files.length; index += 1) {
    const stored = await imageStorage.saveImage(files[index].buffer);
    const [image] = await db.insert(productImagesTable).values({
      productId: id, url: stored.url, storageKey: stored.storageKey,
      thumbnailUrl: stored.variants.thumbnail.url, mediumUrl: stored.variants.medium.url, largeUrl: stored.variants.large.url,
      width: stored.width, height: stored.height, sizeBytes: stored.size, mimeType: stored.mimeType, variants: stored.variants,
      altText: metadata.altText || null, sortOrder: existing.length + index, isPrimary: existing.length === 0 && index === 0,
    }).returning();
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
  const input = parseBody(imageUpdateSchema, req.body, res); if (!input) return;
  const { altText, sortOrder, isPrimary } = input;
  const image = await db.transaction(async (tx) => {
    if (isPrimary) await tx.update(productImagesTable).set({ isPrimary: false }).where(eq(productImagesTable.productId, productId));
    const [updatedImage] = await tx.update(productImagesTable).set({ ...(altText !== undefined && { altText }), ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }), ...(isPrimary !== undefined && { isPrimary: Boolean(isPrimary) }) }).where(and(eq(productImagesTable.id, imageId), eq(productImagesTable.productId, productId))).returning();
    if (updatedImage?.isPrimary) await tx.update(productsTable).set({ coverImage: updatedImage.url }).where(eq(productsTable.id, productId));
    return updatedImage;
  });
  if (!image) { res.status(404).json({ error: "الصورة غير موجودة" }); return; }
  await writeAuditLog(req, { action: "product.images.update", entityType: "product", entityId: productId, description: "تحديث ترتيب أو صورة المنتج الرئيسية" });
  res.json(image);
});

router.delete("/admin/products/:productId/images/:imageId", requireAdminPermission("products.images.manage"), async (req, res): Promise<void> => {
  const productId = Number(Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId);
  const imageId = Number(Array.isArray(req.params.imageId) ? req.params.imageId[0] : req.params.imageId);
  const [image] = await db.delete(productImagesTable).where(and(eq(productImagesTable.id, imageId), eq(productImagesTable.productId, productId))).returning();
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
router.get("/admin/stages", requireAdminPermission("classifications.view"), async (_req, res): Promise<void> => {
  res.json(await db.select().from(stagesTable));
});
router.post("/admin/stages", requireAdminPermission("classifications.manage"), async (req, res): Promise<void> => {
  const input = parseBody(classificationSchema.omit({ stageId: true, logo: true }), req.body, res); if (!input) return;
  const [s] = await db.insert(stagesTable).values(input).returning();
  res.status(201).json(s);
});
router.patch("/admin/stages/:id", requireAdminPermission("classifications.manage"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const input = parseBody(classificationSchema.omit({ stageId: true, logo: true }).partial(), req.body, res); if (!input) return;
  const [s] = await db.update(stagesTable).set(input).where(eq(stagesTable.id, id)).returning();
  res.json(s);
});
router.delete("/admin/stages/:id", requireAdminPermission("classifications.manage"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.update(stagesTable).set({ isActive: false }).where(eq(stagesTable.id, id));
  res.sendStatus(204);
});

router.get("/admin/grades", requireAdminPermission("classifications.view"), async (_req, res): Promise<void> => {
  res.json(await db.select().from(gradesTable));
});
router.post("/admin/grades", requireAdminPermission("classifications.manage"), async (req, res): Promise<void> => {
  const input = parseBody(classificationSchema.omit({ logo: true }), req.body, res); if (!input) return;
  const [g] = await db.insert(gradesTable).values(input).returning();
  res.status(201).json(g);
});
router.patch("/admin/grades/:id", requireAdminPermission("classifications.manage"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const input = parseBody(classificationSchema.omit({ logo: true }).partial(), req.body, res); if (!input) return;
  const [g] = await db.update(gradesTable).set(input).where(eq(gradesTable.id, id)).returning();
  res.json(g);
});
router.delete("/admin/grades/:id", requireAdminPermission("classifications.manage"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.update(gradesTable).set({ isActive: false }).where(eq(gradesTable.id, id));
  res.sendStatus(204);
});

router.get("/admin/subjects", requireAdminPermission("classifications.view"), async (_req, res): Promise<void> => {
  res.json(await db.select().from(subjectsTable));
});
router.post("/admin/subjects", requireAdminPermission("classifications.manage"), async (req, res): Promise<void> => {
  const input = parseBody(classificationSchema.omit({ stageId: true, logo: true, sortOrder: true }), req.body, res); if (!input) return;
  const [s] = await db.insert(subjectsTable).values(input).returning();
  res.status(201).json(s);
});
router.patch("/admin/subjects/:id", requireAdminPermission("classifications.manage"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const input = parseBody(classificationSchema.omit({ stageId: true, logo: true, sortOrder: true }).partial(), req.body, res); if (!input) return;
  const [s] = await db.update(subjectsTable).set(input).where(eq(subjectsTable.id, id)).returning();
  res.json(s);
});
router.delete("/admin/subjects/:id", requireAdminPermission("classifications.manage"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.update(subjectsTable).set({ isActive: false }).where(eq(subjectsTable.id, id));
  res.sendStatus(204);
});

router.get("/admin/publishers", requireAdminPermission("classifications.view"), async (_req, res): Promise<void> => {
  res.json(await db.select().from(publishersTable));
});
router.post("/admin/publishers", requireAdminPermission("classifications.manage"), async (req, res): Promise<void> => {
  const input = parseBody(classificationSchema.omit({ stageId: true, sortOrder: true }), req.body, res); if (!input) return;
  const [p] = await db.insert(publishersTable).values(input).returning();
  res.status(201).json(p);
});
router.patch("/admin/publishers/:id", requireAdminPermission("classifications.manage"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const input = parseBody(classificationSchema.omit({ stageId: true, sortOrder: true }).partial(), req.body, res); if (!input) return;
  const [p] = await db.update(publishersTable).set(input).where(eq(publishersTable.id, id)).returning();
  res.json(p);
});
router.delete("/admin/publishers/:id", requireAdminPermission("classifications.manage"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.update(publishersTable).set({ isActive: false }).where(eq(publishersTable.id, id));
  res.sendStatus(204);
});

// Stock movements
router.get("/admin/stock-movements", requireAdminPermission("inventory.view"), async (req, res): Promise<void> => {
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
