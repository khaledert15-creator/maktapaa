import { Router, type IRouter } from "express";
import { db, bannersTable, faqsTable, siteSettingsTable, stagesTable, publishersTable, productsTable } from "@workspace/db";
import { eq, asc, and, desc, isNull } from "drizzle-orm";

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
  const [banners, stages, publishers, featuredProducts, bestSellers, newArrivals, revisionBooks, settings] = await Promise.all([
    db.select().from(bannersTable).where(eq(bannersTable.isActive, true)).orderBy(asc(bannersTable.sortOrder)),
    db.select().from(stagesTable).where(eq(stagesTable.isActive, true)).orderBy(asc(stagesTable.sortOrder)),
    db.select().from(publishersTable).where(eq(publishersTable.isActive, true)),
    db.select().from(productsTable).where(and(eq(productsTable.isFeatured, true), eq(productsTable.status, "active"), isNull(productsTable.deletedAt))).limit(8),
    db.select().from(productsTable).where(and(eq(productsTable.isBestSeller, true), eq(productsTable.status, "active"), isNull(productsTable.deletedAt))).orderBy(desc(productsTable.salesCount)).limit(12),
    db.select().from(productsTable).where(and(eq(productsTable.isNew, true), eq(productsTable.status, "active"), isNull(productsTable.deletedAt))).orderBy(desc(productsTable.createdAt)).limit(8),
    db.select().from(productsTable).where(and(eq(productsTable.isRevision, true), eq(productsTable.status, "active"), isNull(productsTable.deletedAt))).limit(8),
    getSettings(),
  ]);

  const toSummary = (p: typeof productsTable.$inferSelect) => ({
    id: p.id, nameAr: p.nameAr, nameEn: p.nameEn, slug: p.slug, coverImage: p.coverImage,
    price: Number(p.price), oldPrice: p.oldPrice ? Number(p.oldPrice) : null,
    discountPercent: p.oldPrice && Number(p.oldPrice) > 0 ? Math.round((1 - Number(p.price) / Number(p.oldPrice)) * 100) : null,
    inStock: p.stockQuantity > 0, isBestSeller: p.isBestSeller, isNew: p.isNew, isFeatured: p.isFeatured,
    publisher: null, grade: null, subject: null,
  });

  res.json({
    banners, stages, publishers,
    featuredProducts: featuredProducts.map(toSummary),
    bestSellers: bestSellers.map(toSummary),
    newArrivals: newArrivals.map(toSummary),
    revisionBooks: revisionBooks.map(toSummary),
    settings: mapSettings(settings),
  });
});

export default router;
