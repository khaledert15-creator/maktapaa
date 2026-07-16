import { DeleteObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { config } from "../lib/config";

export type ImageVariant = { url: string; width: number; height: number; size: number };
export type StoredImage = {
  url: string;
  storageKey: string;
  size: number;
  mimeType: "image/webp";
  width: number;
  height: number;
  variants: { thumbnail: ImageVariant; medium: ImageVariant; large: ImageVariant };
};

export interface ImageStorage {
  saveImage(buffer: Buffer, prefix?: "products" | "banners"): Promise<StoredImage>;
  deleteImage(storageKey: string): Promise<void>;
  replaceImage(storageKey: string, buffer: Buffer, prefix?: "products" | "banners"): Promise<StoredImage>;
}

type GeneratedVariant = Omit<ImageVariant, "url"> & { buffer: Buffer; suffix: "thumbnail" | "medium" | "large" };

async function generateVariants(input: Buffer): Promise<GeneratedVariant[]> {
  const source = sharp(input, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height) throw new Error("The uploaded file is not a valid image");
  const targets = [
    { suffix: "thumbnail" as const, width: 360, quality: 76 },
    { suffix: "medium" as const, width: 900, quality: 80 },
    { suffix: "large" as const, width: 1800, quality: 84 },
  ];
  return Promise.all(targets.map(async target => {
    const buffer = await source.clone().resize({ width: target.width, height: target.width * 2, fit: "inside", withoutEnlargement: true }).webp({ quality: target.quality }).toBuffer();
    const output = await sharp(buffer).metadata();
    return { suffix: target.suffix, buffer, width: output.width ?? metadata.width!, height: output.height ?? metadata.height!, size: buffer.length };
  }));
}

function keysFor(storageKey: string): string[] {
  if (/\.[a-z0-9]+$/i.test(storageKey)) return [storageKey];
  return ["thumbnail", "medium", "large"].map(suffix => `${storageKey}/${suffix}.webp`);
}

function storedImage(storageKey: string, variants: GeneratedVariant[], publicUrl: (key: string) => string): StoredImage {
  const mapped = Object.fromEntries(variants.map(variant => [variant.suffix, {
    url: publicUrl(`${storageKey}/${variant.suffix}.webp`), width: variant.width, height: variant.height, size: variant.size,
  }])) as StoredImage["variants"];
  return {
    url: mapped.large.url,
    storageKey,
    size: mapped.large.size,
    mimeType: "image/webp",
    width: mapped.large.width,
    height: mapped.large.height,
    variants: mapped,
  };
}

export class LocalImageStorage implements ImageStorage {
  constructor(private readonly root = config.STORAGE_LOCAL_DIR ? path.resolve(config.STORAGE_LOCAL_DIR) : path.resolve(process.cwd(), "uploads")) {}

  async saveImage(buffer: Buffer, prefix: "products" | "banners" = "products"): Promise<StoredImage> {
    const storageKey = `${prefix}/${crypto.randomUUID()}`;
    const variants = await generateVariants(buffer);
    try {
      await Promise.all(variants.map(async variant => {
        const target = path.resolve(this.root, storageKey, `${variant.suffix}.webp`);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, variant.buffer, { flag: "wx" });
      }));
    } catch (error) {
      await this.deleteImage(storageKey);
      throw error;
    }
    return storedImage(storageKey, variants, key => `/uploads/${key}`);
  }

  async deleteImage(storageKey: string): Promise<void> {
    const targets = keysFor(storageKey).map(key => path.resolve(this.root, key));
    for (const target of targets) {
      if (!target.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
      await unlink(target).catch(error => { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; });
    }
  }

  async replaceImage(storageKey: string, buffer: Buffer, prefix: "products" | "banners" = "products"): Promise<StoredImage> {
    const replacement = await this.saveImage(buffer, prefix);
    await this.deleteImage(storageKey).catch(async error => {
      await this.deleteImage(replacement.storageKey);
      throw error;
    });
    return replacement;
  }

  async readForTest(storageKey: string, variant: keyof StoredImage["variants"] = "large"): Promise<Buffer> {
    return readFile(path.resolve(this.root, storageKey, `${variant}.webp`));
  }
}

export class S3ImageStorage implements ImageStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(options: { endpoint?: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string; publicBaseUrl: string; forcePathStyle?: boolean }) {
    this.bucket = options.bucket;
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/$/, "");
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint || undefined,
      forcePathStyle: options.forcePathStyle,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    });
  }

  async saveImage(buffer: Buffer, prefix: "products" | "banners" = "products"): Promise<StoredImage> {
    const storageKey = `${prefix}/${crypto.randomUUID()}`;
    const variants = await generateVariants(buffer);
    try {
      await Promise.all(variants.map(variant => this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: `${storageKey}/${variant.suffix}.webp`,
        Body: variant.buffer,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
        Metadata: { width: String(variant.width), height: String(variant.height) },
      }))));
    } catch (error) {
      await this.deleteImage(storageKey).catch(() => undefined);
      throw error;
    }
    return storedImage(storageKey, variants, key => `${this.publicBaseUrl}/${key}`);
  }

  async deleteImage(storageKey: string): Promise<void> {
    const objects = keysFor(storageKey).map(Key => ({ Key }));
    await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: objects, Quiet: true } }));
  }

  async replaceImage(storageKey: string, buffer: Buffer, prefix: "products" | "banners" = "products"): Promise<StoredImage> {
    const replacement = await this.saveImage(buffer, prefix);
    try {
      await this.deleteImage(storageKey);
      return replacement;
    } catch (error) {
      await this.deleteImage(replacement.storageKey);
      throw error;
    }
  }
}

export class MemoryImageStorage implements ImageStorage {
  readonly objects = new Map<string, Buffer>();

  async saveImage(buffer: Buffer, prefix: "products" | "banners" = "products"): Promise<StoredImage> {
    const storageKey = `${prefix}/${crypto.randomUUID()}`;
    const variants = await generateVariants(buffer);
    for (const variant of variants) this.objects.set(`${storageKey}/${variant.suffix}.webp`, variant.buffer);
    return storedImage(storageKey, variants, key => `https://storage.test/${key}`);
  }

  async deleteImage(storageKey: string): Promise<void> {
    for (const key of keysFor(storageKey)) this.objects.delete(key);
  }

  async replaceImage(storageKey: string, buffer: Buffer, prefix: "products" | "banners" = "products"): Promise<StoredImage> {
    const replacement = await this.saveImage(buffer, prefix);
    await this.deleteImage(storageKey);
    return replacement;
  }
}

function createImageStorage(): ImageStorage {
  if (config.STORAGE_PROVIDER === "s3") {
    return new S3ImageStorage({
      endpoint: config.S3_ENDPOINT || undefined,
      region: config.S3_REGION!,
      bucket: config.S3_BUCKET!,
      accessKeyId: config.S3_ACCESS_KEY_ID!,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY!,
      publicBaseUrl: config.S3_PUBLIC_BASE_URL!,
      forcePathStyle: config.s3ForcePathStyle,
    });
  }
  if (config.isProduction && !config.allowLocalStorageInProduction) throw new Error("Local image storage is disabled in production");
  return new LocalImageStorage();
}

export const imageStorage: ImageStorage = createImageStorage();
