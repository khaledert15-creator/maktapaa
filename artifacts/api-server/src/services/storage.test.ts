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

test("branding storage accepts standard self-contained SVG and rejects executable or externally loaded SVG", async () => {
  const storage = new MemoryImageStorage();
  const safe = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#0f172a"/></svg>');
  const stored = await storage.saveBrandAsset(safe, "image/svg+xml");
  assert.equal(stored.mimeType, "image/svg+xml");
  assert.equal(stored.width, 120);
  assert.equal(stored.height, 40);
  await assert.rejects(() => storage.saveBrandAsset(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><script>alert(1)</script></svg>'), "image/svg+xml"));
  await assert.rejects(() => storage.saveBrandAsset(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><image href="https://attacker.example/x.png"/></svg>'), "image/svg+xml"));
  await storage.deleteImage(stored.storageKey);
});
