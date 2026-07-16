import { Router, type IRouter } from "express";
import {
  db, productsTable, stagesTable, gradesTable, subjectsTable, publishersTable,
  reviewsTable, categoriesTable,
} from "@workspace/db";
import { eq, and, gte, lte, ilike, or, desc, asc, isNull, sql, inArray } from "drizzle-orm";

const router: IRouter = Router();

// List products (public)
router.get("/products", async (req, res): Promise<void> => {
  const {
    page = "1", limit = "24", q, stageId, gradeId, subjectId, publisherId,
    educationType, bookType, minPrice, maxPrice, inStock, hasDiscount,
    isBestSeller, isNew, isRevision, isBundle, sortBy,
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(50, parseInt(limit, 10));
  const offset = (pageNum - 1) * limitNum;

  const conditions: ReturnType<typeof eq>[] = [eq(productsTable.status, "active"), isNull(productsTable.deletedAt) as ReturnType<typeof eq>];

  if (q) {
    conditions.push(or(ilike(productsTable.nameAr, `%${q}%`), ilike(productsTable.nameEn, `%${q}%`)) as ReturnType<typeof eq>);
  }
  if (stageId) conditions.push(eq(productsTable.stageId, parseInt(stageId, 10)));
  if (gradeId) conditions.push(eq(productsTable.gradeId, parseInt(gradeId, 10)));
  if (subjectId) conditions.push(eq(productsTable.subjectId, parseInt(subjectId, 10)));
  if (publisherId) conditions.push(eq(productsTable.publisherId, parseInt(publisherId, 10)));
  if (educationType) conditions.push(eq(productsTable.educationType, educationType));
  if (bookType) conditions.push(eq(productsTable.bookType, bookType));
  if (minPrice) conditions.push(gte(productsTable.price, minPrice));
  if (maxPrice) conditions.push(lte(productsTable.price, maxPrice));
  if (inStock === "true") conditions.push(gte(productsTable.stockQuantity, 1));
  if (hasDiscount === "true") conditions.push(sql`${productsTable.oldPrice} IS NOT NULL` as unknown as ReturnType<typeof eq>);
  if (isBestSeller === "true") conditions.push(eq(productsTable.isBestSeller, true));
  if (isNew === "true") conditions.push(eq(productsTable.isNew, true));
  if (isRevision === "true") conditions.push(eq(productsTable.isRevision, true));
  if (isBundle === "true") conditions.push(eq(productsTable.isBundle, true));

  let orderBy;
  switch (sortBy) {
    case "price_asc": orderBy = asc(productsTable.price); break;
    case "price_desc": orderBy = desc(productsTable.price); break;
    case "best_selling": orderBy = desc(productsTable.salesCount); break;
    case "discount": orderBy = desc(productsTable.oldPrice); break;
    case "newest": default: orderBy = desc(productsTable.createdAt); break;
  }

  const whereClause = and(...conditions);

  const [items, [{ count }]] = await Promise.all([
    db.select().from(productsTable).where(whereClause).orderBy(orderBy).limit(limitNum).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(whereClause),
  ]);

  const enriched = await enrichProducts(items);
  res.json({ items: enriched, total: count, page: pageNum, limit: limitNum });
});

// Featured products
router.get("/products/featured", async (_req, res): Promise<void> => {
  const items = await db.select().from(productsTable)
    .where(and(eq(productsTable.isFeatured, true), eq(productsTable.status, "active"), isNull(productsTable.deletedAt)))
    .orderBy(desc(productsTable.sortOrder))
    .limit(12);
  const enriched = await enrichProducts(items);
  res.json(enriched);
});

// Search suggestions
router.get("/products/search/suggestions", async (req, res): Promise<void> => {
  const { q } = req.query as { q: string };
  if (!q || q.length < 2) { res.json({ products: [], suggestions: [], totalCount: 0 }); return; }

  const items = await db.select().from(productsTable)
    .where(and(
      or(ilike(productsTable.nameAr, `%${q}%`), ilike(productsTable.nameEn, `%${q}%`)),
      eq(productsTable.status, "active"),
      isNull(productsTable.deletedAt),
    ))
    .limit(8);

  const enriched = await enrichProducts(items);
  res.json({ products: enriched, suggestions: [], totalCount: enriched.length });
});

// Product detail by slug
router.get("/products/:slug", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;

  const [product] = await db.select().from(productsTable)
    .where(and(eq(productsTable.slug, raw), isNull(productsTable.deletedAt)));

  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  const [stage, grade, subject, publisher, reviews] = await Promise.all([
    product.stageId ? db.select().from(stagesTable).where(eq(stagesTable.id, product.stageId)).then(r => r[0]) : null,
    product.gradeId ? db.select().from(gradesTable).where(eq(gradesTable.id, product.gradeId)).then(r => r[0]) : null,
    product.subjectId ? db.select().from(subjectsTable).where(eq(subjectsTable.id, product.subjectId)).then(r => r[0]) : null,
    product.publisherId ? db.select().from(publishersTable).where(eq(publishersTable.id, product.publisherId)).then(r => r[0]) : null,
    db.select().from(reviewsTable).where(and(eq(reviewsTable.productId, product.id), eq(reviewsTable.isApproved, 1))),
  ]);

  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  const discountPercent = product.oldPrice && Number(product.oldPrice) > 0
    ? Math.round((1 - Number(product.price) / Number(product.oldPrice)) * 100)
    : null;

  res.json({
    id: product.id, nameAr: product.nameAr, nameEn: product.nameEn, slug: product.slug,
    descriptionShort: product.descriptionShort, descriptionFull: product.descriptionFull,
    coverImage: product.coverImage, images: product.images,
    price: Number(product.price), oldPrice: product.oldPrice ? Number(product.oldPrice) : null,
    discountPercent, sku: product.sku, barcode: product.barcode,
    inStock: product.stockQuantity > 0, stockQuantity: product.stockQuantity,
    isBestSeller: product.isBestSeller, isNew: product.isNew, isFeatured: product.isFeatured,
    freeShipping: product.freeShipping, freeShippingBadgeText: product.freeShippingBadgeText,
    isRevision: product.isRevision, isBundle: product.isBundle,
    educationType: product.educationType, bookType: product.bookType,
    edition: product.edition, schoolYear: product.schoolYear,
    stage: stage?.nameAr || null, grade: grade?.nameAr || null,
    subject: subject?.nameAr || null, publisher: publisher?.nameAr || null,
    author: product.author,
    avgRating, reviewCount: reviews.length,
  });
});

// Related products
router.get("/products/:id/related", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) { res.json([]); return; }

  const conditions = [
    eq(productsTable.status, "active"),
    isNull(productsTable.deletedAt),
    sql`${productsTable.id} != ${id}` as unknown as ReturnType<typeof eq>,
  ];
  if (product.gradeId) conditions.push(eq(productsTable.gradeId, product.gradeId));
  else if (product.stageId) conditions.push(eq(productsTable.stageId, product.stageId));

  const items = await db.select().from(productsTable)
    .where(and(...conditions)).limit(8);
  const enriched = await enrichProducts(items);
  res.json(enriched);
});

// Product reviews
router.get("/products/:id/reviews", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const reviews = await db.select().from(reviewsTable)
    .where(and(eq(reviewsTable.productId, id), eq(reviewsTable.isApproved, 1)))
    .orderBy(desc(reviewsTable.createdAt));

  res.json(reviews.map(r => ({ id: r.id, productId: r.productId, customerName: r.customerName, rating: r.rating, comment: r.comment, createdAt: r.createdAt })));
});

// Create review
router.post("/products/:id/reviews", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { rating, comment } = req.body;

  const customerName = req.session.customerName || "عميل";

  const [review] = await db.insert(reviewsTable).values({
    productId: id, rating: parseInt(rating, 10), comment: comment || null,
    customerName, customerId: req.session.customerId || null, isApproved: 1,
  }).returning();

  res.status(201).json({ id: review.id, productId: review.productId, customerName: review.customerName, rating: review.rating, comment: review.comment, createdAt: review.createdAt });
});

// Categories
router.get("/categories", async (_req, res): Promise<void> => {
  const cats = await db.select().from(categoriesTable).where(eq(categoriesTable.isActive, true)).orderBy(asc(categoriesTable.sortOrder));
  res.json(cats.map(c => ({ id: c.id, nameAr: c.nameAr, nameEn: c.nameEn, slug: c.slug, image: c.image, productCount: 0 })));
});

// Stages
router.get("/stages", async (_req, res): Promise<void> => {
  const stages = await db.select().from(stagesTable).where(eq(stagesTable.isActive, true)).orderBy(asc(stagesTable.sortOrder));
  res.json(stages);
});

// Grades
router.get("/grades", async (req, res): Promise<void> => {
  const { stageId } = req.query as { stageId?: string };
  const where = stageId
    ? and(eq(gradesTable.isActive, true), eq(gradesTable.stageId, parseInt(stageId, 10)))
    : eq(gradesTable.isActive, true);
  const grades = await db.select().from(gradesTable).where(where).orderBy(asc(gradesTable.sortOrder));
  res.json(grades);
});

// Subjects
router.get("/subjects", async (_req, res): Promise<void> => {
  const subjects = await db.select().from(subjectsTable).where(eq(subjectsTable.isActive, true));
  res.json(subjects);
});

// Publishers
router.get("/publishers", async (_req, res): Promise<void> => {
  const publishers = await db.select().from(publishersTable).where(eq(publishersTable.isActive, true));
  res.json(publishers);
});

// Helper: enrich products with stage/grade/subject/publisher names
async function enrichProducts(items: typeof productsTable.$inferSelect[]) {
  if (items.length === 0) return [];

  const stageIds = [...new Set(items.map(p => p.stageId).filter(Boolean))] as number[];
  const gradeIds = [...new Set(items.map(p => p.gradeId).filter(Boolean))] as number[];
  const subjectIds = [...new Set(items.map(p => p.subjectId).filter(Boolean))] as number[];
  const publisherIds = [...new Set(items.map(p => p.publisherId).filter(Boolean))] as number[];

  const [stages, grades, subjects, publishers] = await Promise.all([
    stageIds.length ? db.select().from(stagesTable).where(inArray(stagesTable.id, stageIds)) : [],
    gradeIds.length ? db.select().from(gradesTable).where(inArray(gradesTable.id, gradeIds)) : [],
    subjectIds.length ? db.select().from(subjectsTable).where(inArray(subjectsTable.id, subjectIds)) : [],
    publisherIds.length ? db.select().from(publishersTable).where(inArray(publishersTable.id, publisherIds)) : [],
  ]);

  const stageMap: Record<number, string> = Object.fromEntries(stages.map(stage => [stage.id, stage.nameAr]));
  const gradeMap = Object.fromEntries(grades.map(g => [g.id, g.nameAr]));
  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s.nameAr]));
  const publisherMap = Object.fromEntries(publishers.map(p => [p.id, p.nameAr]));

  return items.map(p => {
    const discountPercent = p.oldPrice && Number(p.oldPrice) > 0
      ? Math.round((1 - Number(p.price) / Number(p.oldPrice)) * 100)
      : null;
    return {
      id: p.id, nameAr: p.nameAr, nameEn: p.nameEn, slug: p.slug,
      coverImage: p.coverImage,
      price: Number(p.price), oldPrice: p.oldPrice ? Number(p.oldPrice) : null,
      discountPercent, inStock: p.stockQuantity > 0,
      isBestSeller: p.isBestSeller, isNew: p.isNew, isFeatured: p.isFeatured,
      freeShipping: p.freeShipping, freeShippingBadgeText: p.freeShippingBadgeText,
      stage: p.stageId ? stageMap[p.stageId] || null : null,
      publisher: p.publisherId ? publisherMap[p.publisherId] || null : null,
      grade: p.gradeId ? gradeMap[p.gradeId] || null : null,
      subject: p.subjectId ? subjectMap[p.subjectId] || null : null,
    };
  });
}

export default router;
