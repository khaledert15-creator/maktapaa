import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { and, eq } from "drizzle-orm";
import {
  auditLogsTable, citiesTable, db, governoratesTable, orderItemsTable, pool,
  ordersTable, productImagesTable, productsTable, stockMovementsTable, usersTable,
  addressesTable, categoriesTable, customersTable, favoritesTable, gradesTable,
  publishersTable, stagesTable, subjectsTable,
} from "@workspace/db";
import { calculateShipping } from "../services/shipping";
import { imageStorage } from "../services/storage";
import { enrichProductSummaries, getProductGallery } from "../services/catalog";

const rollbackMarker = "ROLLBACK_POSTGRES_WORKFLOW_TEST";

after(async () => pool.end());

test("PostgreSQL-backed catalog, shipping, order, inventory, permission and audit workflows", async () => {
  assert.match(process.env.DATABASE_URL ?? "", /^postgres(?:ql)?:\/\//, "DATABASE_URL must point to PostgreSQL");
  const suffix = randomUUID();
  const storedKeys: string[] = [];

  try {
    await db.transaction(async (tx) => {
      const [governorate] = await tx.insert(governoratesTable).values({
        nameAr: `محافظة اختبار ${suffix}`, nameEn: `Test ${suffix}`,
        shippingCost: "50", remoteAreaSurcharge: "5", freeShippingThreshold: "500",
      }).returning();
      const [city] = await tx.insert(citiesTable).values({
        governorateId: governorate.id, nameAr: `مدينة اختبار ${suffix}`,
        shippingPriceOverride: "70", surcharge: "10",
      }).returning();
      assert.equal(Number(city.shippingPriceOverride), 70, "city override is persisted");

      const [freeProduct, regularProduct] = await tx.insert(productsTable).values([
        { nameAr: `منتج شحن مجاني ${suffix}`, slug: `free-${suffix}`, price: "120", stockQuantity: 10, freeShipping: true, status: "active" },
        { nameAr: `منتج عادي ${suffix}`, slug: `regular-${suffix}`, price: "80", stockQuantity: 10, freeShipping: false, status: "active" },
      ]).returning();
      assert.ok(freeProduct.id && regularProduct.id, "products are created in PostgreSQL");

      const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#1e3a5f" } }).png().toBuffer();
      const uploaded = await Promise.all([imageStorage.saveImage(png), imageStorage.saveImage(png)]);
      storedKeys.push(...uploaded.map(image => image.storageKey));
      const images = await tx.insert(productImagesTable).values(uploaded.map((image, index) => ({
        productId: freeProduct.id, url: image.url, storageKey: image.storageKey,
        sortOrder: index, isPrimary: index === 0,
      }))).returning();
      assert.equal(images.length, 2, "multiple product images are uploaded and persisted");

      await tx.update(productImagesTable).set({ isPrimary: false }).where(eq(productImagesTable.productId, freeProduct.id));
      const [newPrimary] = await tx.update(productImagesTable).set({ isPrimary: true }).where(eq(productImagesTable.id, images[1].id)).returning();
      await tx.update(productsTable).set({ coverImage: newPrimary.url }).where(eq(productsTable.id, freeProduct.id));
      const primaryRows = await tx.select().from(productImagesTable).where(and(eq(productImagesTable.productId, freeProduct.id), eq(productImagesTable.isPrimary, true)));
      assert.equal(primaryRows.length, 1, "exactly one primary image is selected");
      assert.equal(primaryRows[0].id, images[1].id);

      const freeOnly = calculateShipping({ products: [{ price: 120, quantity: 1, freeShipping: true }], subtotal: 120, baseShippingCost: Number(governorate.shippingCost) });
      assert.equal(freeOnly.finalCost, 0, "per-product free shipping works");
      const mixed = calculateShipping({ products: [{ price: 120, quantity: 1, freeShipping: true }, { price: 80, quantity: 1, freeShipping: false }], subtotal: 200, baseShippingCost: Number(governorate.shippingCost), cityPriceOverride: Number(city.shippingPriceOverride), surcharge: Number(city.surcharge) });
      assert.deepEqual({ base: mixed.baseCost, surcharge: mixed.surcharge, total: mixed.finalCost }, { base: 70, surcharge: 10, total: 80 }, "mixed cart uses city shipping over governorate price");
      const couponShipping = calculateShipping({ products: [{ price: 80, quantity: 1, freeShipping: false }], subtotal: 80, baseShippingCost: 50, freeShippingCoupon: true });
      assert.equal(couponShipping.finalCost, 0, "free shipping coupon works");

      const [order] = await tx.insert(ordersTable).values({
        orderNumber: `MK-TEST-${suffix}`, customerName: "عميل اختبار", mobile: "01000000000",
        governorateId: governorate.id, governorateName: governorate.nameAr, city: city.nameAr,
        detailedAddress: "عنوان اختبار", subtotal: "200", shippingCost: "80",
        shippingBaseCost: "70", shippingSurcharge: "10", shippingDiscount: "0", total: "280",
        paymentMethod: "cash_on_delivery", paymentStatus: "cash_on_delivery",
        shippingRuleSnapshot: { governorateId: governorate.id, cityId: city.id, baseCost: 70, surcharge: 10, finalCost: 80, rule: "standard" },
      }).returning();
      await tx.insert(orderItemsTable).values({ orderId: order.id, productId: regularProduct.id, nameAr: regularProduct.nameAr, quantity: 1, unitPrice: regularProduct.price, subtotal: regularProduct.price });
      const [updated] = await tx.update(productsTable).set({ stockQuantity: 9 }).where(eq(productsTable.id, regularProduct.id)).returning();
      await tx.insert(stockMovementsTable).values({ productId: regularProduct.id, movementType: "sale", quantityBefore: 10, quantityAfter: updated.stockQuantity, quantityChanged: -1, orderId: order.id, reason: `integration-${suffix}` });
      await tx.insert(auditLogsTable).values({ action: `order.test.${suffix}`, entityType: "order", entityId: String(order.id), description: "إنشاء طلب باختبار PostgreSQL", afterData: { shippingSnapshot: order.shippingRuleSnapshot } });
      const [savedOrder] = await tx.select().from(ordersTable).where(eq(ordersTable.id, order.id));
      assert.deepEqual(savedOrder.shippingRuleSnapshot, { governorateId: governorate.id, cityId: city.id, baseCost: 70, surcharge: 10, finalCost: 80, rule: "standard" }, "shipping snapshot persists as JSONB");
      assert.equal((await tx.select().from(stockMovementsTable).where(eq(stockMovementsTable.orderId, order.id))).length, 1, "inventory movement is persisted");
      assert.equal((await tx.select().from(auditLogsTable).where(and(eq(auditLogsTable.entityId, String(order.id)), eq(auditLogsTable.action, `order.test.${suffix}`)))).length, 1, "audit log is persisted");

      const [warehouse] = await tx.select().from(usersTable).where(eq(usersTable.email, "warehouse@maktaba.com"));
      assert.equal(warehouse.role, "warehouse");
      assert.ok(warehouse.permissions.includes("inventory.adjust"), "employee permission is stored");
      assert.ok(!warehouse.permissions.includes("orders.edit"), "employee lacks unauthorized permission");

      const stockBeforeRollback = updated.stockQuantity;
      try {
        await tx.transaction(async (savepoint) => {
          await savepoint.update(productsTable).set({ stockQuantity: 1 }).where(eq(productsTable.id, regularProduct.id));
          await savepoint.insert(stockMovementsTable).values({ productId: regularProduct.id, movementType: "adjustment", quantityBefore: stockBeforeRollback, quantityAfter: 1, quantityChanged: 1 - stockBeforeRollback, reason: `must-rollback-${suffix}` });
          throw new Error("EXPECTED_SAVEPOINT_ROLLBACK");
        });
      } catch (error) {
        assert.equal((error as Error).message, "EXPECTED_SAVEPOINT_ROLLBACK");
      }
      const [afterRollback] = await tx.select().from(productsTable).where(eq(productsTable.id, regularProduct.id));
      assert.equal(afterRollback.stockQuantity, stockBeforeRollback, "stock update rolls back atomically");
      assert.equal((await tx.select().from(stockMovementsTable).where(eq(stockMovementsTable.reason, `must-rollback-${suffix}`))).length, 0, "movement rolls back with stock");

      throw new Error(rollbackMarker);
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== rollbackMarker) throw error;
  } finally {
    await Promise.all(storedKeys.map(key => imageStorage.deleteImage(key)));
  }
});

test("public storefront records, primary images, favorites, addresses and checkout idempotency are PostgreSQL-backed", async () => {
  const suffix = randomUUID();
  const [publisher] = await db.select().from(publishersTable).limit(1);
  const [stage] = await db.select().from(stagesTable).limit(1);
  const [grade] = await db.select().from(gradesTable).limit(1);
  const [subject] = await db.select().from(subjectsTable).limit(1);
  const [category] = await db.select().from(categoriesTable).limit(1);
  const [customer] = await db.select().from(customersTable).limit(1);
  const [governorate] = await db.select().from(governoratesTable).limit(1);
  assert.ok(publisher && stage && grade && subject && category && customer && governorate, "seeded storefront relations must exist");

  let productId: number | undefined;
  let addressId: number | undefined;
  let orderId: number | undefined;
  try {
    const [product] = await db.insert(productsTable).values({
      nameAr: `منتج واجهة ${suffix}`, slug: `storefront-${suffix}`, price: "140", oldPrice: "200",
      stockQuantity: 7, status: "active", publisherId: publisher.id, stageId: stage.id,
      gradeId: grade.id, subjectId: subject.id, categoryId: category.id,
      isFeatured: true, isOffer: true, isRevision: true, freeShipping: true,
      educationType: "لغات", schoolYear: "2026/2027", author: "مدرس الاختبار",
    }).returning();
    productId = product.id;
    await db.insert(productImagesTable).values([
      { productId, url: `/uploads/${suffix}-secondary.webp`, storageKey: `test/${suffix}/secondary.webp`, sortOrder: 0, isPrimary: false },
      { productId, url: `/uploads/${suffix}-primary.webp`, storageKey: `test/${suffix}/primary.webp`, sortOrder: 1, isPrimary: true },
    ]);
    const [summary] = await enrichProductSummaries([product]);
    assert.equal(summary.coverImage, `/uploads/${suffix}-primary.webp`, "admin-selected primary image is used publicly");
    assert.equal(summary.publisher, publisher.nameAr);
    assert.equal(summary.category, category.nameAr);
    assert.equal(summary.freeShipping, true);
    assert.equal(summary.isOffer, true);
    assert.deepEqual(await getProductGallery(product), [`/uploads/${suffix}-primary.webp`, `/uploads/${suffix}-secondary.webp`], "gallery puts primary image first");

    await db.update(productsTable).set({ price: "125", stockQuantity: 0 }).where(eq(productsTable.id, productId));
    const [updatedProduct] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
    const [updatedSummary] = await enrichProductSummaries([updatedProduct]);
    assert.equal(updatedSummary.price, 125, "admin price change is immediately reflected");
    assert.equal(updatedSummary.inStock, false, "admin stock change is immediately reflected");

    await db.insert(favoritesTable).values({ customerId: customer.id, productId }).onConflictDoNothing();
    await db.insert(favoritesTable).values({ customerId: customer.id, productId }).onConflictDoNothing();
    assert.equal((await db.select().from(favoritesTable).where(and(eq(favoritesTable.customerId, customer.id), eq(favoritesTable.productId, productId)))).length, 1, "favorites are unique and persistent");

    const [savedAddress] = await db.insert(addressesTable).values({ customerId: customer.id, governorateId: governorate.id, governorateName: governorate.nameAr, city: "مدينة اختبار", detailedAddress: "عنوان واجهة اختبار", isDefault: false }).returning();
    addressId = savedAddress.id;
    assert.equal(savedAddress.governorateName, governorate.nameAr, "saved address snapshots governorate name");

    const checkoutToken = `checkout-${suffix}`;
    const [savedOrder] = await db.insert(ordersTable).values({ checkoutToken, orderNumber: `MK-IDEM-${suffix}`, customerId: customer.id, customerName: customer.name, mobile: customer.primaryPhone, governorateId: governorate.id, governorateName: governorate.nameAr, city: "مدينة اختبار", detailedAddress: "عنوان اختبار", subtotal: "125", shippingCost: "0", total: "125" }).returning();
    orderId = savedOrder.id;
    await assert.rejects(() => db.insert(ordersTable).values({ checkoutToken, orderNumber: `MK-IDEM-DUP-${suffix}`, customerName: customer.name, mobile: customer.primaryPhone, governorateId: governorate.id, governorateName: governorate.nameAr, city: "مدينة اختبار", detailedAddress: "عنوان اختبار", subtotal: "125", shippingCost: "0", total: "125" }), "checkout token prevents duplicate orders at database level");
  } finally {
    if (orderId) await db.delete(ordersTable).where(eq(ordersTable.id, orderId));
    if (addressId) await db.delete(addressesTable).where(eq(addressesTable.id, addressId));
    if (productId) await db.delete(productsTable).where(eq(productsTable.id, productId));
  }
});
