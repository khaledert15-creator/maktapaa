import { Router, type IRouter } from "express";
import { db, bannersTable, faqsTable, siteSettingsTable, stagesTable, gradesTable, subjectsTable, publishersTable, categoriesTable, productsTable } from "@workspace/db";
import { eq, asc, and, desc, isNull, or, sql } from "drizzle-orm";
import { enrichProductSummaries } from "../services/catalog";

const router: IRouter = Router();

async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(siteSettingsTable);
  return Object.fromEntries(rows.map(r => [r.key, r.value || ""]));
}

function mapSettings(settings: Record<string, string>) {
  return {
    storeName: settings.storeName || "Maktaba Dot Com",
    storeNameAr: settings.storeNameAr || "مكتبة دوت كوم",
    logoUrl: settings.logoUrl || null,
    whatsappNumber: settings.whatsappNumber || null,
    phoneNumber: settings.phoneNumber || null,
    email: settings.email || null,
    address: settings.address || null,
    facebookUrl: settings.facebookUrl || null,
    instagramUrl: settings.instagramUrl || null,
    tiktokUrl: settings.tiktokUrl || null,
    telegramUrl: settings.telegramUrl || null,
    announcementBar: settings.announcementBar || null,
    announcementEnabled: settings.announcementEnabled === "true",
    seoTitle: settings.seoTitle || null,
    seoDescription: settings.seoDescription || null,
  };
}

router.get("/content/settings", async (_req, res): Promise<void> => {
  const settings = await getSettings();
  res.json(mapSettings(settings));
});

router.get("/content/banners", async (_req, res): Promise<void> => {
  const banners = await db.select().from(bannersTable)
    .where(eq(bannersTable.isActive, true))
    .orderBy(asc(bannersTable.sortOrder));
  res.json(banners);
});

router.get("/content/faqs", async (_req, res): Promise<void> => {
  const faqs = await db.select().from(faqsTable)
    .where(eq(faqsTable.isActive, true))
    .orderBy(asc(faqsTable.sortOrder));
  res.json(faqs);
});

router.get("/content/homepage", async (_req, res): Promise<void> => {
  const activeProduct = and(eq(productsTable.status, "active"), isNull(productsTable.deletedAt));
  const [banners, stages, grades, subjects, publishers, categories, featuredProducts, bestSellers, newArrivals, revisionBooks, offers, bundles, freeShippingProducts, recommendedProducts, settings] = await Promise.all([
    db.select().from(bannersTable).where(eq(bannersTable.isActive, true)).orderBy(asc(bannersTable.sortOrder)),
    db.select().from(stagesTable).where(eq(stagesTable.isActive, true)).orderBy(asc(stagesTable.sortOrder)),
    db.select().from(gradesTable).where(eq(gradesTable.isActive, true)).orderBy(asc(gradesTable.sortOrder)),
    db.select().from(subjectsTable).where(eq(subjectsTable.isActive, true)).orderBy(asc(subjectsTable.nameAr)),
    db.select().from(publishersTable).where(eq(publishersTable.isActive, true)).orderBy(asc(publishersTable.nameAr)),
    db.select().from(categoriesTable).where(eq(categoriesTable.isActive, true)).orderBy(asc(categoriesTable.sortOrder)),
    db.select().from(productsTable).where(and(eq(productsTable.isFeatured, true), eq(productsTable.status, "active"), isNull(productsTable.deletedAt))).limit(8),
    db.select().from(productsTable).where(and(eq(productsTable.isBestSeller, true), eq(productsTable.status, "active"), isNull(productsTable.deletedAt))).orderBy(desc(productsTable.salesCount)).limit(12),
    db.select().from(productsTable).where(and(eq(productsTable.isNew, true), eq(productsTable.status, "active"), isNull(productsTable.deletedAt))).orderBy(desc(productsTable.createdAt)).limit(8),
    db.select().from(productsTable).where(and(eq(productsTable.isRevision, true), eq(productsTable.status, "active"), isNull(productsTable.deletedAt))).limit(8),
    db.select().from(productsTable).where(and(or(eq(productsTable.isOffer, true), sql`${productsTable.oldPrice} > ${productsTable.price}`), eq(productsTable.status, "active"), isNull(productsTable.deletedAt))).orderBy(desc(productsTable.updatedAt)).limit(8),
    db.select().from(productsTable).where(and(eq(productsTable.isBundle, true), eq(productsTable.status, "active"), isNull(productsTable.deletedAt))).orderBy(desc(productsTable.updatedAt)).limit(8),
    db.select().from(productsTable).where(and(eq(productsTable.freeShipping, true), eq(productsTable.status, "active"), isNull(productsTable.deletedAt))).orderBy(desc(productsTable.updatedAt)).limit(8),
    db.select().from(productsTable).where(activeProduct).orderBy(desc(productsTable.sortOrder), desc(productsTable.salesCount), desc(productsTable.updatedAt)).limit(8),
    getSettings(),
  ]);

  const [featured, best, latest, revision, offerProducts, productBundles, freeShipping, recommended] = await Promise.all([
    enrichProductSummaries(featuredProducts),
    enrichProductSummaries(bestSellers),
    enrichProductSummaries(newArrivals),
    enrichProductSummaries(revisionBooks),
    enrichProductSummaries(offers),
    enrichProductSummaries(bundles),
    enrichProductSummaries(freeShippingProducts),
    enrichProductSummaries(recommendedProducts),
  ]);

  res.json({
    banners, stages, grades, subjects, publishers, categories,
    featuredProducts: featured,
    bestSellers: best,
    newArrivals: latest,
    revisionBooks: revision,
    offers: offerProducts,
    bundles: productBundles,
    freeShippingProducts: freeShipping,
    recommendedProducts: recommended,
    settings: mapSettings(settings),
  });
});

export default router;
