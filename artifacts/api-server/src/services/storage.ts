import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

export type StoredImage = { url: string; storageKey: string; size: number; mimeType: string };

export interface ImageStorage {
  saveImage(buffer: Buffer): Promise<StoredImage>;
  deleteImage(storageKey: string): Promise<void>;
}

export class LocalImageStorage implements ImageStorage {
  constructor(private readonly directory = path.resolve(process.cwd(), "uploads", "products")) {}

  async saveImage(buffer: Buffer): Promise<StoredImage> {
    await mkdir(this.directory, { recursive: true });
    const storageKey = `products/${Date.now()}-${crypto.randomUUID()}.webp`;
    const output = await sharp(buffer).rotate().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    await writeFile(path.resolve(process.cwd(), "uploads", storageKey), output);
    return { url: `/uploads/${storageKey}`, storageKey, size: output.length, mimeType: "image/webp" };
  }

  async deleteImage(storageKey: string): Promise<void> {
    const root = path.resolve(process.cwd(), "uploads");
    const target = path.resolve(root, storageKey);
    if (!target.startsWith(root + path.sep)) throw new Error("Invalid storage key");
    await unlink(target).catch(error => { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; });
  }
}

export const imageStorage: ImageStorage = new LocalImageStorage();
