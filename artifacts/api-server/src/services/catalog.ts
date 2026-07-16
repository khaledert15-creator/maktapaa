import {
  db, categoriesTable, gradesTable, productImagesTable, productsTable, publishersTable,
  stagesTable, subjectsTable,
} from "@workspace/db";
import { asc, desc, inArray } from "drizzle-orm";

export type ProductSummary = ReturnType<typeof emptySummary>;

function emptySummary(product: typeof productsTable.$inferSelect) {
  const oldPrice = product.oldPrice ? Number(product.oldPrice) : null;
  return {
    id: product.id,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    slug: product.slug,
    coverImage: product.coverImage,
    price: Number(product.price),
    oldPrice,
    discountPercent: oldPrice && oldPrice > Number(product.price)
      ? Math.round((1 - Number(product.price) / oldPrice) * 100)
      : null,
    inStock: product.stockQuantity > 0,
    stockQuantity: product.stockQuantity,
    isBestSeller: product.isBestSeller,
    isNew: product.isNew,
    isFeatured: product.isFeatured,
    isOffer: product.isOffer,
    isRevision: product.isRevision,
    isBundle: product.isBundle,
    freeShipping: product.freeShipping,
    freeShippingBadgeText: product.freeShippingBadgeText,
    stage: null as string | null,
    grade: null as string | null,
    subject: null as string | null,
    publisher: null as string | null,
    category: null as string | null,
    educationType: product.educationType,
    schoolYear: product.schoolYear,
    author: product.author,
  };
}

export async function enrichProductSummaries(items: typeof productsTable.$inferSelect[]) {
  if (items.length === 0) return [];
  const ids = (key: "stageId" | "gradeId" | "subjectId" | "publisherId" | "categoryId") =>
    [...new Set(items.map(product => product[key]).filter((id): id is number => Boolean(id)))];
  const productIds = items.map(product => product.id);

  const [stages, grades, subjects, publishers, categories, images] = await Promise.all([
    ids("stageId").length ? db.select().from(stagesTable).where(inArray(stagesTable.id, ids("stageId"))) : [],
    ids("gradeId").length ? db.select().from(gradesTable).where(inArray(gradesTable.id, ids("gradeId"))) : [],
    ids("subjectId").length ? db.select().from(subjectsTable).where(inArray(subjectsTable.id, ids("subjectId"))) : [],
    ids("publisherId").length ? db.select().from(publishersTable).where(inArray(publishersTable.id, ids("publisherId"))) : [],
    ids("categoryId").length ? db.select().from(categoriesTable).where(inArray(categoriesTable.id, ids("categoryId"))) : [],
    db.select().from(productImagesTable).where(inArray(productImagesTable.productId, productIds))
      .orderBy(desc(productImagesTable.isPrimary), asc(productImagesTable.sortOrder)),
  ]);

  const stageMap = new Map(stages.map(row => [row.id, row.nameAr]));
  const gradeMap = new Map(grades.map(row => [row.id, row.nameAr]));
  const subjectMap = new Map(subjects.map(row => [row.id, row.nameAr]));
  const publisherMap = new Map(publishers.map(row => [row.id, row.nameAr]));
  const categoryMap = new Map(categories.map(row => [row.id, row.nameAr]));
  const primaryImageMap = new Map<number, string>();
  for (const image of images) if (!primaryImageMap.has(image.productId)) primaryImageMap.set(image.productId, image.url);

  return items.map(product => ({
    ...emptySummary(product),
    coverImage: primaryImageMap.get(product.id) ?? product.coverImage,
    stage: product.stageId ? stageMap.get(product.stageId) ?? null : null,
    grade: product.gradeId ? gradeMap.get(product.gradeId) ?? null : null,
    subject: product.subjectId ? subjectMap.get(product.subjectId) ?? null : null,
    publisher: product.publisherId ? publisherMap.get(product.publisherId) ?? null : null,
    category: product.categoryId ? categoryMap.get(product.categoryId) ?? null : null,
  }));
}

export async function getProductGallery(product: typeof productsTable.$inferSelect) {
  const rows = await db.select().from(productImagesTable)
    .where(inArray(productImagesTable.productId, [product.id]))
    .orderBy(desc(productImagesTable.isPrimary), asc(productImagesTable.sortOrder));
  const urls = rows.map(row => row.url);
  for (const url of [product.coverImage, ...product.images]) {
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}
