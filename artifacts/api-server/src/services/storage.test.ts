import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { MemoryImageStorage } from "./storage";

test("object storage adapter creates responsive WebP variants and deletes them safely", async () => {
  const storage = new MemoryImageStorage();
  const source = await sharp({ create: { width: 1200, height: 1600, channels: 3, background: "#0f172a" } }).png().toBuffer();
  const stored = await storage.saveImage(source);

  assert.equal(stored.mimeType, "image/webp");
  assert.equal(storage.objects.size, 3);
  assert.match(stored.variants.thumbnail.url, /thumbnail\.webp$/);
  assert.ok(stored.variants.thumbnail.width <= 360);
  assert.ok(stored.variants.medium.width <= 900);
  assert.ok(stored.variants.large.width <= 1800);

  const replacement = await storage.replaceImage(stored.storageKey, source);
  assert.equal(storage.objects.size, 3);
  assert.notEqual(replacement.storageKey, stored.storageKey);
  await storage.deleteImage(replacement.storageKey);
  assert.equal(storage.objects.size, 0);
});
