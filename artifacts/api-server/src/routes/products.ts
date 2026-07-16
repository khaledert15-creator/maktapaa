import { Router, type IRouter } from "express";
import {
  db, productsTable, stagesTable, gradesTable, subjectsTable, publishersTable,
  reviewsTable, categoriesTable, orderItemsTable, ordersTable,
} from "@workspace/db";
import { eq, and, gte, lte, ilike, or, desc, asc, isNull, sql, inArray } from "drizzle-orm";
import { enrichProductSummaries, getProductGallery } from "../services/catalog";
import { parseBody } from "../lib/validation";
import { rateLimit } from "../lib/rate-limit";
import { z } from "@workspace/api-zod";

const router: IRouter = Router();
const reviewSchema = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().min(3).max(2000).nullable().optional() });
const reviewRateLimit = rateLimit({ namespace: "product-review", windowMs: 60 * 60_000, max: 5 });

// List products (public)
router.get("/products", async (req, res): Promise<void> => {
  const {
    page = "1", limit = "24", q, stageId, gradeId, subjectId, publisherId, categoryId,
    educationType, bookType, author, schoolYear, minPrice, maxPrice, inStock, hasDiscount,
    isBestSeller, isNew, isRevision, isBundle, isOffer, isFeatured, freeShipping, sortBy,
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 24));
  const offset = (pageNum - 1) * limitNum;

  const conditions: ReturnType<typeof eq>[] = [eq(productsTable.status, "active"), isNull(productsTable.deletedAt) as ReturnType<typeof eq>];

  if (q) {
    const pattern = `%${q.trim()}%`;
    conditions.push(or(
      ilike(productsTable.nameAr, pattern), ilike(productsTable.nameEn, pattern),
      ilike(productsTable.author, pattern), ilike(productsTable.sku, pattern),
      ilike(productsTable.barcode, pattern),
      sql`${productsTable.publisherId} in (select id from publishers where name_ar ilike ${pattern} or name_en ilike ${pattern})`,
      sql`${productsTable.subjectId} in (select id from subjects where name_ar ilike ${pattern} or name_en ilike ${pattern})`,
    ) as ReturnType<typeof eq>);
  }
  if (stageId) conditions.push(eq(productsTable.stageId, parseInt(stageId, 10)));
  if (gradeId) conditions.push(eq(productsTable.gradeId, parseInt(gradeId, 10)));
  if (subjectId) conditions.push(eq(productsTable.subjectId, parseInt(subjectId, 10)));
  if (publisherId) conditions.push(eq(productsTable.publisherId, parseInt(publisherId, 10)));
  if (categoryId) conditions.push(eq(productsTable.categoryId, parseInt(categoryId, 10)));
  if (educationType) conditions.push(eq(productsTable.educationType, educationType));
  if (bookType) conditions.push(eq(productsTable.bookType, bookType));
  if (author) conditions.push(ilike(productsTable.author, `%${author}%`) as ReturnType<typeof eq>);
  if (schoolYear) conditions.push(eq(productsTable.schoolYear, schoolYear));
  if (minPrice) conditions.push(gte(productsTable.price, minPrice));
  if (maxPrice) conditions.push(lte(productsTable.price, maxPrice));
  if (inStock === "true") conditions.push(gte(productsTable.stockQuantity, 1));
  if (hasDiscount === "true") conditions.push(sql`${productsTable.oldPrice} IS NOT NULL AND ${productsTable.oldPrice} > ${productsTable.price}` as unknown as ReturnType<typeof eq>);
  if (isBestSeller === "true") conditions.push(eq(productsTable.isBestSeller, true));
  if (isNew === "true") conditions.push(eq(productsTable.isNew, true));
  if (isRevision === "true") conditions.push(eq(productsTable.isRevision, true));
  if (isBundle === "true") conditions.push(eq(productsTable.isBundle, true));
  if (isOffer === "true") conditions.push(or(eq(productsTable.isOffer, true), sql`${productsTable.oldPrice} > ${productsTable.price}`) as ReturnType<typeof eq>);
  if (isFeatured === "true") conditions.push(eq(productsTable.isFeatured, true));
  if (freeShipping === "true") conditions.push(eq(productsTable.freeShipping, true));

  let orderBy;
  switch (sortBy) {
    case "price_asc": orderBy = asc(productsTable.price); break;
    case "price_desc": orderBy = desc(productsTable.price); break;
    case "best_selling": orderBy = desc(productsTable.salesCount); break;
    case "discount": orderBy = desc(sql`case when ${productsTable.oldPrice} > 0 then ((${productsTable.oldPrice} - ${productsTable.price}) / ${productsTable.oldPrice}) else 0 end`); break;
    case "recommended": orderBy = desc(sql`(${productsTable.isFeatured}::int * 100000) + ${productsTable.salesCount} + (${productsTable.isBestSeller}::int * 10000)`); break;
    case "newest": default: orderBy = desc(productsTable.createdAt); break;
  }

  const whereClause = and(...conditions);

  const [items, [{ count }]] = await Promise.all([
    db.select().from(productsTable).where(whereClause).orderBy(orderBy).limit(limitNum).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(whereClause),
  ]);

  const enriched = await enrichProductSummaries(items);
  res.json({ items: enriched, total: count, page: pageNum, limit: limitNum });
});

// Featured products
router.get("/products/featured", async (_req, res): Promise<void> => {
  const items = await db.select().from(productsTable)
    .where(and(eq(productsTable.isFeatured, true), eq(productsTable.status, "active"), isNull(productsTable.deletedAt)))
    .orderBy(desc(productsTable.sortOrder))
    .limit(12);
  const enriched = await enrichProductSummaries(items);
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

  const enriched = await enrichProductSummaries(items);
  const suggestions = [...new Set(enriched.flatMap(product => [product.publisher, product.subject, product.author]).filter((value): value is string => Boolean(value)))].slice(0, 5);
  res.json({ products: enriched, suggestions, totalCount: enriched.length });
});

// Product detail by slug
router.get("/products/:slug", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;

  const [product] = await db.select().from(productsTable)
    .where(and(eq(productsTable.slug, raw), eq(productsTable.status, "active"), isNull(productsTable.deletedAt)));

  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  const [stage, grade, subject, publisher, reviews, gallery] = await Promise.all([
    product.stageId ? db.select().from(stagesTable).where(eq(stagesTable.id, product.stageId)).then(r => r[0]) : null,
    product.gradeId ? db.select().from(gradesTable).where(eq(gradesTable.id, product.gradeId)).then(r => r[0]) : null,
    product.subjectId ? db.select().from(subjectsTable).where(eq(subjectsTable.id, product.subjectId)).then(r => r[0]) : null,
    product.publisherId ? db.select().from(publishersTable).where(eq(publishersTable.id, product.publisherId)).then(r => r[0]) : null,
    db.select().from(reviewsTable).where(and(eq(reviewsTable.productId, product.id), eq(reviewsTable.moderationStatus, "approved"))),
    getProductGallery(product),
  ]);

  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  const discountPercent = product.oldPrice && Number(product.oldPrice) > Number(product.price)
    ? Math.round((1 - Number(product.price) / Number(product.oldPrice)) * 100)
    : null;

  res.json({
    id: product.id, nameAr: product.nameAr, nameEn: product.nameEn, slug: product.slug,
    descriptionShort: product.descriptionShort, descriptionFull: product.descriptionFull,
    coverImage: gallery[0] ?? product.coverImage, images: gallery,
    price: Number(product.price), oldPrice: product.oldPrice ? Number(product.oldPrice) : null,
    discountPercent, sku: product.sku, barcode: product.barcode,
    inStock: product.stockQuantity > 0, stockQuantity: product.stockQuantity,
    isBestSeller: product.isBestSeller, isNew: product.isNew, isFeatured: product.isFeatured,
    isOffer: product.isOffer,
    freeShipping: product.freeShipping, freeShippingBadgeText: product.freeShippingBadgeText,
    isRevision: product.isRevision, isBundle: product.isBundle,
    educationType: product.educationType, bookType: product.bookType,
    edition: product.edition, schoolYear: product.schoolYear,
    stage: stage?.nameAr || null, grade: grade?.nameAr || null,
    subject: subject?.nameAr || null, publisher: publisher?.nameAr || null,
    author: product.author,
    avgRating, reviewCount: reviews.length,
    seoTitle: product.seoTitle, seoDescription: product.seoDescription,
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
  const enriched = await enrichProductSummaries(items);
  res.json(enriched);
});

// Products commonly purchased in the same order. Falls back to related products.
router.get("/products/:id/frequently-bought", async (req, res): Promise<void> => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid product" }); return; }
  const rows = await db.execute<{ product_id: number; frequency: number }>(sql`
    select other.product_id, count(*)::int as frequency
    from order_items source
    join order_items other on other.order_id = source.order_id and other.product_id <> source.product_id
    join products p on p.id = other.product_id
    where source.product_id = ${id} and p.status = 'active' and p.deleted_at is null
    group by other.product_id order by frequency desc limit 4
  `);
  let ids = rows.rows.map(row => row.product_id);
  if (!ids.length) {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
    if (product) {
      const fallback = await db.select({ id: productsTable.id }).from(productsTable)
        .where(and(eq(productsTable.status, "active"), isNull(productsTable.deletedAt), product.subjectId ? eq(productsTable.subjectId, product.subjectId) : sql`${productsTable.id} <> ${id}`))
        .limit(4);
      ids = fallback.map(row => row.id).filter(productId => productId !== id);
    }
  }
  if (!ids.length) { res.json([]); return; }
  const products = await db.select().from(productsTable).where(inArray(productsTable.id, ids));
  const mapped = await enrichProductSummaries(products);
  res.json(ids.flatMap(productId => mapped.filter(product => product.id === productId)));
});

// Product reviews
router.get("/products/:id/reviews", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const reviews = await db.select().from(reviewsTable)
    .where(and(eq(reviewsTable.productId, id), eq(reviewsTable.moderationStatus, "approved")))
    .orderBy(desc(reviewsTable.createdAt));

  res.json(reviews.map(r => ({ id: r.id, productId: r.productId, customerName: r.customerName, rating: r.rating, comment: r.comment, createdAt: r.createdAt })));
});

// Create review
router.post("/products/:id/reviews", reviewRateLimit, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const input = parseBody(reviewSchema, req.body, res); if (!input) return;
  const { rating, comment } = input;

  const [product] = await db.select({ id: productsTable.id }).from(productsTable).where(and(eq(productsTable.id, id), eq(productsTable.status, "active")));
  if (!product) { res.status(404).json({ error: "المنتج غير موجود" }); return; }

  const customerName = req.session.customerName || "عميل";
  let verifiedPurchase = false;
  if (req.session.customerId) {
    const [purchase] = await db.select({ orderId: orderItemsTable.orderId }).from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .where(and(eq(orderItemsTable.productId, id), eq(ordersTable.customerId, req.session.customerId), sql`${ordersTable.status} <> 'cancelled'`)).limit(1);
    verifiedPurchase = Boolean(purchase);
  }

  const [review] = await db.insert(reviewsTable).values({
    productId: id, rating, comment: comment || null,
    customerName, customerId: req.session.customerId || null, isApproved: 0,
    moderationStatus: "pending", verifiedPurchase,
  }).returning();

  res.status(201).json({ id: review.id, productId: review.productId, customerName: review.customerName, rating: review.rating, comment: review.comment, moderationStatus: review.moderationStatus, verifiedPurchase: review.verifiedPurchase, createdAt: review.createdAt });
});

// Categories
router.get("/categories", async (_req, res): Promise<void> => {
  const cats = await db.select({
    id: categoriesTable.id, nameAr: categoriesTable.nameAr, nameEn: categoriesTable.nameEn,
    slug: categoriesTable.slug, image: categoriesTable.image,
    productCount: sql<number>`(select count(*)::int from products where category_id = ${categoriesTable.id} and status = 'active' and deleted_at is null)`,
  }).from(categoriesTable).where(eq(categoriesTable.isActive, true)).orderBy(asc(categoriesTable.sortOrder));
  res.json(cats);
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

export default router;
