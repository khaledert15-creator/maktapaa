import {
  db, categoriesTable, gradesTable, productImagesTable, productsTable, publishersTable,
  stagesTable, subjectsTable,
} from "@workspace/db";
import { asc, desc, eq, inArray } from "drizzle-orm";

export type ProductSummary = ReturnType<typeof emptySummary>;

function emptySummary(product: typeof productsTable.$inferSelect) {
  const oldPrice = product.oldPrice ? Number(product.oldPrice) : null;
  return {
    id: product.id,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    slug: product.slug,
    coverImage: product.coverImage,
    coverImageSrcSet: null as string | null,
    coverImageWidth: null as number | null,
    coverImageHeight: null as number | null,
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
  const productIds = items.map(product => product.id);

  const [relations, images] = await Promise.all([
    db.select({
      productId: productsTable.id,
      stageName: stagesTable.nameAr,
      gradeName: gradesTable.nameAr,
      subjectName: subjectsTable.nameAr,
      publisherName: publishersTable.nameAr,
      categoryName: categoriesTable.nameAr,
    }).from(productsTable)
      .leftJoin(stagesTable, eq(productsTable.stageId, stagesTable.id))
      .leftJoin(gradesTable, eq(productsTable.gradeId, gradesTable.id))
      .leftJoin(subjectsTable, eq(productsTable.subjectId, subjectsTable.id))
      .leftJoin(publishersTable, eq(productsTable.publisherId, publishersTable.id))
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .where(inArray(productsTable.id, productIds)),
    db.select().from(productImagesTable).where(inArray(productImagesTable.productId, productIds))
      .orderBy(desc(productImagesTable.isPrimary), asc(productImagesTable.sortOrder)),
  ]);

  const relationMap = new Map(relations.map(row => [row.productId, row]));
  const primaryImageMap = new Map<number, typeof productImagesTable.$inferSelect>();
  for (const image of images) if (!primaryImageMap.has(image.productId)) primaryImageMap.set(image.productId, image);

  return items.map(product => ({
    ...emptySummary(product),
    coverImage: primaryImageMap.get(product.id)?.url ?? product.coverImage,
    coverImageSrcSet: imageSrcSet(primaryImageMap.get(product.id)),
    coverImageWidth: primaryImageMap.get(product.id)?.width ?? null,
    coverImageHeight: primaryImageMap.get(product.id)?.height ?? null,
    stage: relationMap.get(product.id)?.stageName ?? null,
    grade: relationMap.get(product.id)?.gradeName ?? null,
    subject: relationMap.get(product.id)?.subjectName ?? null,
    publisher: relationMap.get(product.id)?.publisherName ?? null,
    category: relationMap.get(product.id)?.categoryName ?? null,
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

export function imageSrcSet(image?: typeof productImagesTable.$inferSelect): string | null {
  if (!image) return null;
  const variants = [
    image.thumbnailUrl && image.variants?.thumbnail ? `${image.thumbnailUrl} ${image.variants.thumbnail.width}w` : null,
    image.mediumUrl && image.variants?.medium ? `${image.mediumUrl} ${image.variants.medium.width}w` : null,
    image.largeUrl && image.variants?.large ? `${image.largeUrl} ${image.variants.large.width}w` : null,
  ].filter(Boolean);
  return variants.length ? variants.join(", ") : null;
}

export async function getProductGalleryRecords(product: typeof productsTable.$inferSelect) {
  return db.select().from(productImagesTable)
    .where(inArray(productImagesTable.productId, [product.id]))
    .orderBy(desc(productImagesTable.isPrimary), asc(productImagesTable.sortOrder));
}
