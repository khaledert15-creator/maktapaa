import { Router, type IRouter } from "express";
import { db, bannersTable, faqsTable, siteSettingsTable, stagesTable, gradesTable, subjectsTable, publishersTable, categoriesTable, productsTable } from "@workspace/db";
import { eq, asc, inArray, sql } from "drizzle-orm";
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
  const [banners, stages, grades, subjects, publishers, categories, productSections, settings] = await Promise.all([
    db.select().from(bannersTable).where(eq(bannersTable.isActive, true)).orderBy(asc(bannersTable.sortOrder)),
    db.select().from(stagesTable).where(eq(stagesTable.isActive, true)).orderBy(asc(stagesTable.sortOrder)),
    db.select().from(gradesTable).where(eq(gradesTable.isActive, true)).orderBy(asc(gradesTable.sortOrder)),
    db.select().from(subjectsTable).where(eq(subjectsTable.isActive, true)).orderBy(asc(subjectsTable.nameAr)),
    db.select().from(publishersTable).where(eq(publishersTable.isActive, true)).orderBy(asc(publishersTable.nameAr)),
    db.select().from(categoriesTable).where(eq(categoriesTable.isActive, true)).orderBy(asc(categoriesTable.sortOrder)),
    db.execute<{ section: string; id: number }>(sql`
      (select 'featured'::text as section, id from products where is_featured = true and status = 'active' and deleted_at is null order by sort_order desc limit 8)
      union all (select 'best'::text, id from products where is_best_seller = true and status = 'active' and deleted_at is null order by sales_count desc limit 12)
      union all (select 'new'::text, id from products where is_new = true and status = 'active' and deleted_at is null order by created_at desc limit 8)
      union all (select 'revision'::text, id from products where is_revision = true and status = 'active' and deleted_at is null order by sort_order desc limit 8)
      union all (select 'offers'::text, id from products where (is_offer = true or old_price > price) and status = 'active' and deleted_at is null order by updated_at desc limit 8)
      union all (select 'bundles'::text, id from products where is_bundle = true and status = 'active' and deleted_at is null order by updated_at desc limit 8)
      union all (select 'free_shipping'::text, id from products where free_shipping = true and status = 'active' and deleted_at is null order by updated_at desc limit 8)
      union all (select 'recommended'::text, id from products where status = 'active' and deleted_at is null order by sort_order desc, sales_count desc, updated_at desc limit 8)
    `),
    getSettings(),
  ]);

  const sectionIds = productSections.rows.map(row => Number(row.id));
  const allProducts = sectionIds.length ? await db.select().from(productsTable).where(inArray(productsTable.id, [...new Set(sectionIds)])) : [];
  const enrichedProducts = await enrichProductSummaries(allProducts);
  const enrichedMap = new Map(enrichedProducts.map(product => [product.id, product]));
  const select = (section: string) => productSections.rows.filter(row => row.section === section).flatMap(row => {
    const product = enrichedMap.get(Number(row.id)); return product ? [product] : [];
  });
  const featured = select("featured");
  const best = select("best");
  const latest = select("new");
  const revision = select("revision");
  const offerProducts = select("offers");
  const productBundles = select("bundles");
  const freeShipping = select("free_shipping");
  const recommended = select("recommended");

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
