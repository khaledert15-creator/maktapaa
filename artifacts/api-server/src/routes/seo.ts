import { Router, type IRouter } from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { brandAssetsTable, categoriesTable, db, productImagesTable, productsTable, publishersTable, siteSettingsTable } from "@workspace/db";
import { config } from "../lib/config";

const router: IRouter = Router();
const staticPages = ["", "catalog", "offers", "stages", "categories", "publishers", "about", "contact", "faq", "shipping-policy", "return-policy", "privacy", "terms"];
let templatePromise: Promise<string> | null = null;

function html(value: unknown): string {
  return String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

function xml(value: unknown): string { return html(value); }
function absolute(pathname: string): string { return new URL(pathname, config.PUBLIC_SITE_URL).toString(); }
function slugify(value: string): string { return value.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, ""); }
function safeJson(value: unknown): string { return JSON.stringify(value).replace(/</g, "\\u003c"); }

async function template(): Promise<string> {
  templatePromise ??= readFile(path.resolve(process.env.STOREFRONT_DIST_DIR ?? path.resolve(process.cwd(), "artifacts/maktaba/dist/public"), "index.html"), "utf8").catch(() => "<!doctype html><html lang=\"ar\" dir=\"rtl\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head><body><div id=\"root\"></div></body></html>");
  return templatePromise;
}

function replaceMeta(document: string, attribute: "name" | "property", key: string, content: string): string {
  const expression = new RegExp(`<meta\\s+${attribute}=["']${key}["'][^>]*>`, "i");
  const tag = `<meta ${attribute}="${html(key)}" content="${html(content)}" />`;
  return expression.test(document) ? document.replace(expression, tag) : document.replace("</head>", `  ${tag}\n</head>`);
}

async function renderPage(input: { status?: number; title: string; description: string; canonicalPath: string; image?: string | null; type?: "website" | "product"; jsonLd?: unknown[]; body: string }) {
  let document = await template();
  const canonical = absolute(input.canonicalPath);
  const [assets, settingsRows] = await Promise.all([db.select().from(brandAssetsTable), db.select().from(siteSettingsTable).where(inArray(siteSettingsTable.key, ["storeNameAr", "logoUrl"]))]);
  const settings = Object.fromEntries(settingsRows.map(row => [row.key, row.value || ""]));
  const mainLogo = assets.find(asset => asset.kind === "main")?.url || settings.logoUrl || "/favicon.svg";
  const socialImage = assets.find(asset => asset.kind === "social")?.url || "/social-default.svg";
  const image = input.image ? absolute(input.image) : absolute(socialImage);
  document = document.replace(/<title>[^<]*<\/title>/i, `<title>${html(input.title)}</title>`);
  document = replaceMeta(document, "name", "description", input.description);
  document = replaceMeta(document, "property", "og:title", input.title);
  document = replaceMeta(document, "property", "og:description", input.description);
  document = replaceMeta(document, "property", "og:type", input.type ?? "website");
  document = replaceMeta(document, "property", "og:url", canonical);
  document = replaceMeta(document, "property", "og:image", image);
  document = replaceMeta(document, "name", "twitter:card", "summary_large_image");
  document = replaceMeta(document, "name", "twitter:title", input.title);
  document = replaceMeta(document, "name", "twitter:description", input.description);
  const structured = (input.jsonLd ?? []).map(entry => typeof entry === "object" && entry && "@type" in entry && entry["@type" as keyof typeof entry] === "Organization" ? { ...entry, name: settings.storeNameAr || "مكتبة دوت كوم", logo: absolute(mainLogo) } : entry);
  document = document.replace("</head>", `  <link rel="canonical" href="${html(canonical)}" />\n${structured.map((entry, index) => `  <script id="server-json-ld-${index}" type="application/ld+json">${safeJson(entry)}</script>`).join("\n")}\n</head>`);
  document = document.replace('<div id="root"></div>', `<div id="root">${input.body}</div>`);
  return { status: input.status ?? 200, document };
}

const organization = () => ({ "@context": "https://schema.org", "@type": "Organization", name: "مكتبة دوت كوم", url: absolute("/"), logo: absolute("/favicon.svg") });
const breadcrumbs = (items: { name: string; path: string }[]) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absolute(item.path) })) });

router.get("/", async (_req, res) => {
  const description = "مكتبة دوت كوم للكتب المدرسية والمراجعات لجميع المراحل، بأسعار ومخزون محدثين وشحن لكل محافظات مصر.";
  const page = await renderPage({ title: "مكتبة دوت كوم | كتبك الدراسية في مكان واحد", description, canonicalPath: "/", jsonLd: [organization()], body: `<main dir="rtl"><h1>مكتبة دوت كوم</h1><p>${html(description)}</p><p><a href="/catalog">تصفح الكتب</a></p></main>` });
  res.type("html").send(page.document);
});

router.get("/product/:slug", async (req, res): Promise<void> => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const [product] = await db.select().from(productsTable).where(and(eq(productsTable.slug, slug), eq(productsTable.status, "active"), isNull(productsTable.deletedAt)));
  if (!product) {
    const page = await renderPage({ status: 404, title: "المنتج غير موجود | مكتبة دوت كوم", description: "المنتج المطلوب غير متاح.", canonicalPath: `/product/${encodeURIComponent(slug)}`, jsonLd: [organization()], body: '<main dir="rtl"><h1>المنتج غير موجود</h1><p><a href="/catalog">تصفح الكتب المتاحة</a></p></main>' });
    res.status(page.status).type("html").send(page.document); return;
  }
  const [[image], [publisher], [category]] = await Promise.all([
    db.select().from(productImagesTable).where(eq(productImagesTable.productId, product.id)).orderBy(desc(productImagesTable.isPrimary), asc(productImagesTable.sortOrder)).limit(1),
    product.publisherId ? db.select().from(publishersTable).where(eq(publishersTable.id, product.publisherId)) : Promise.resolve([]),
    product.categoryId ? db.select().from(categoriesTable).where(eq(categoriesTable.id, product.categoryId)) : Promise.resolve([]),
  ]);
  const canonicalPath = `/product/${product.slug}`;
  const title = product.seoTitle || `${product.nameAr} | مكتبة دوت كوم`;
  const description = product.seoDescription || product.descriptionShort || `اشترِ ${product.nameAr} من مكتبة دوت كوم بالدفع عند الاستلام.`;
  const productImage = image?.largeUrl || image?.url || product.coverImage || "/social-default.svg";
  const productSchema = { "@context": "https://schema.org", "@type": "Product", name: product.nameAr, description, image: [absolute(productImage)], sku: product.sku || undefined, brand: { "@type": "Brand", name: publisher?.nameAr || "مكتبة دوت كوم" }, offers: { "@type": "Offer", url: absolute(canonicalPath), priceCurrency: "EGP", price: Number(product.price), availability: product.stockQuantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", itemCondition: "https://schema.org/NewCondition" } };
  const page = await renderPage({ title, description, canonicalPath, image: productImage, type: "product", jsonLd: [organization(), productSchema, breadcrumbs([{ name: "الرئيسية", path: "/" }, { name: category?.nameAr || "الكتب", path: category ? `/category/${category.slug}` : "/catalog" }, { name: product.nameAr, path: canonicalPath }])], body: `<main dir="rtl" data-server-rendered="product"><nav><a href="/">الرئيسية</a> / <a href="/catalog">الكتب</a></nav><article><h1>${html(product.nameAr)}</h1><img src="${html(absolute(productImage))}" alt="${html(product.nameAr)}" width="${image?.width ?? 640}" height="${image?.height ?? 850}" /><p>${html(description)}</p><strong>${html(Number(product.price).toFixed(2))} ج.م</strong><p>${product.stockQuantity > 0 ? "متوفر" : "غير متوفر حاليًا"}</p></article></main>` });
  res.status(page.status).type("html").send(page.document);
});

router.get("/category/:slug", async (req, res): Promise<void> => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const [category] = await db.select().from(categoriesTable).where(and(eq(categoriesTable.slug, slug), eq(categoriesTable.isActive, true)));
  if (!category) { const page = await renderPage({ status: 404, title: "التصنيف غير موجود | مكتبة دوت كوم", description: "تعذر العثور على التصنيف.", canonicalPath: `/category/${encodeURIComponent(slug)}`, body: "<main><h1>التصنيف غير موجود</h1></main>" }); res.status(404).type("html").send(page.document); return; }
  const path = `/category/${category.slug}`;
  const description = `تصفح كتب ${category.nameAr} المتاحة والأسعار والمخزون المحدث من مكتبة دوت كوم.`;
  const page = await renderPage({ title: `${category.nameAr} | مكتبة دوت كوم`, description, canonicalPath: path, image: category.image, jsonLd: [organization(), breadcrumbs([{ name: "الرئيسية", path: "/" }, { name: "التصنيفات", path: "/categories" }, { name: category.nameAr, path }])], body: `<main dir="rtl"><h1>${html(category.nameAr)}</h1><p>${html(description)}</p></main>` });
  res.type("html").send(page.document);
});

router.get("/publisher/:reference", async (req, res): Promise<void> => {
  const reference = Array.isArray(req.params.reference) ? req.params.reference[0] : req.params.reference;
  const id = Number(reference.split("-")[0]);
  const [publisher] = Number.isInteger(id) ? await db.select().from(publishersTable).where(and(eq(publishersTable.id, id), eq(publishersTable.isActive, true))) : [];
  if (!publisher) { const page = await renderPage({ status: 404, title: "دار النشر غير موجودة | مكتبة دوت كوم", description: "تعذر العثور على دار النشر.", canonicalPath: `/publisher/${encodeURIComponent(reference)}`, body: "<main><h1>دار النشر غير موجودة</h1></main>" }); res.status(404).type("html").send(page.document); return; }
  const path = `/publisher/${publisher.id}-${slugify(publisher.nameAr)}`;
  const description = `تصفح إصدارات ${publisher.nameAr} المتاحة في مكتبة دوت كوم.`;
  const page = await renderPage({ title: `${publisher.nameAr} | مكتبة دوت كوم`, description, canonicalPath: path, image: publisher.logo, jsonLd: [organization(), breadcrumbs([{ name: "الرئيسية", path: "/" }, { name: "دور النشر", path: "/publishers" }, { name: publisher.nameAr, path }])], body: `<main dir="rtl"><h1>${html(publisher.nameAr)}</h1><p>${html(description)}</p></main>` });
  res.type("html").send(page.document);
});

router.get("/sitemap.xml", async (_req, res): Promise<void> => {
  const [products, categories, publishers] = await Promise.all([
    db.select({ slug: productsTable.slug, updatedAt: productsTable.updatedAt }).from(productsTable).where(and(eq(productsTable.status, "active"), isNull(productsTable.deletedAt))),
    db.select({ slug: categoriesTable.slug }).from(categoriesTable).where(eq(categoriesTable.isActive, true)),
    db.select({ id: publishersTable.id, nameAr: publishersTable.nameAr }).from(publishersTable).where(eq(publishersTable.isActive, true)),
  ]);
  const entries = [
    ...staticPages.map(page => ({ path: `/${page}`, lastmod: null })),
    ...products.map(product => ({ path: `/product/${product.slug}`, lastmod: product.updatedAt.toISOString() })),
    ...categories.map(category => ({ path: `/category/${category.slug}`, lastmod: null })),
    ...publishers.map(publisher => ({ path: `/publisher/${publisher.id}-${slugify(publisher.nameAr)}`, lastmod: null })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(entry => `  <url><loc>${xml(absolute(entry.path))}</loc>${entry.lastmod ? `<lastmod>${xml(entry.lastmod)}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>`;
  res.setHeader("Cache-Control", "public, max-age=900");
  res.type("application/xml").send(body);
});

router.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /account\nDisallow: /checkout\nSitemap: ${absolute("/sitemap.xml")}\n`);
});

export default router;
