import { readFile } from "node:fs/promises";
import path from "node:path";
import { bannersTable, db, pool, productImagesTable, productsTable } from "@workspace/db";
import { eq, like, or } from "drizzle-orm";
import { imageStorage } from "../services/storage";

if (process.env.STORAGE_PROVIDER !== "s3") throw new Error("Set STORAGE_PROVIDER=s3 and the S3/R2 credentials before migrating images");
const uploadRoot = path.resolve(process.env.LOCAL_UPLOADS_DIR ?? path.resolve(process.cwd(), "uploads"));

function localPath(url: string): string {
  if (!url.startsWith("/uploads/")) throw new Error(`Not a local upload URL: ${url}`);
  const target = path.resolve(uploadRoot, url.slice("/uploads/".length));
  if (!target.startsWith(uploadRoot + path.sep)) throw new Error("Invalid local upload path");
  return target;
}

async function main() {
  const images = await db.select().from(productImagesTable).where(like(productImagesTable.url, "/uploads/%"));
  for (const image of images) {
    const stored = await imageStorage.saveImage(await readFile(localPath(image.url)), "products");
    await db.transaction(async tx => {
      await tx.update(productImagesTable).set({
        url: stored.url, storageKey: stored.storageKey,
        thumbnailUrl: stored.variants.thumbnail.url, mediumUrl: stored.variants.medium.url, largeUrl: stored.variants.large.url,
        width: stored.width, height: stored.height, sizeBytes: stored.size, mimeType: stored.mimeType, variants: stored.variants,
      }).where(eq(productImagesTable.id, image.id));
      if (image.isPrimary) await tx.update(productsTable).set({ coverImage: stored.url }).where(eq(productsTable.id, image.productId));
    });
  }

  const banners = await db.select().from(bannersTable).where(or(like(bannersTable.imageUrl, "/uploads/%"), like(bannersTable.imageUrl, "uploads/%")));
  for (const banner of banners) {
    const normalizedUrl = banner.imageUrl.startsWith("/") ? banner.imageUrl : `/${banner.imageUrl}`;
    const stored = await imageStorage.saveImage(await readFile(localPath(normalizedUrl)), "banners");
    await db.update(bannersTable).set({ imageUrl: stored.url, imageStorageKey: stored.storageKey, imageWidth: stored.width, imageHeight: stored.height, imageVariants: stored.variants }).where(eq(bannersTable.id, banner.id));
  }

  process.stdout.write(`Migrated ${images.length} product images and ${banners.length} banners. Original local files were retained for rollback.\n`);
}

main().finally(() => pool.end());
