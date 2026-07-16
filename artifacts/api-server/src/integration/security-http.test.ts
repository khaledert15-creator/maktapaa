import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import app from "../app";
import {
  auditLogsTable, cancellationRequestsTable, couponUsageTable, couponsTable, db,
  governoratesTable, orderItemsTable, ordersTable, pool, productsTable, reviewsTable,
  stockMovementsTable, usersTable, customersTable,
  stagesTable,
} from "@workspace/db";
import { CouponValidationError, validateCoupon } from "../services/coupons";
import { OrderStateError, transitionOrderStatus } from "../services/order-state";

let server: Server;
let baseUrl = "";
const createdUserIds: number[] = [];
const createdProductIds: number[] = [];
const createdOrderIds: number[] = [];
const createdCouponIds: number[] = [];
const createdCustomerIds: number[] = [];
const createdStageIds: number[] = [];

before(async () => {
  server = app.listen(0);
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("HTTP test server did not start");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  for (const id of createdCouponIds) await db.delete(couponsTable).where(eq(couponsTable.id, id));
  for (const id of createdOrderIds) await db.delete(ordersTable).where(eq(ordersTable.id, id));
  for (const id of createdProductIds) await db.delete(productsTable).where(eq(productsTable.id, id));
  for (const id of createdStageIds) await db.delete(stagesTable).where(eq(stagesTable.id, id));
  for (const id of createdCustomerIds) await db.delete(customersTable).where(eq(customersTable.id, id));
  for (const id of createdUserIds) await db.delete(usersTable).where(eq(usersTable.id, id));
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await pool.end();
});

async function createAdmin(role: "administrator" | "warehouse" | "content_manager", permissions: string[]) {
  const suffix = randomUUID();
  const password = `Secure-${suffix}`;
  const [user] = await db.insert(usersTable).values({ name: `Security ${role}`, email: `${role}-${suffix}@example.test`, passwordHash: await bcrypt.hash(password, 12), role, permissions }).returning();
  createdUserIds.push(user.id);
  return { user, password };
}

async function login(email: string, password: string) {
  const response = await fetch(`${baseUrl}/api/auth/admin/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
}

async function request(path: string, cookie: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, { ...init, headers: { cookie, ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers } });
}

test("warehouse employee is denied employees, permissions, coupons, content, reports and audit but can adjust inventory", async () => {
  const { user, password } = await createAdmin("warehouse", ["products.view", "inventory.view", "inventory.adjust"]);
  const cookie = await login(user.email, password);
  const protectedRequests = await Promise.all([
    request("/api/admin/employees", cookie),
    request(`/api/admin/employees/${user.id}`, cookie, { method: "PATCH", body: JSON.stringify({ permissions: ["employees.manage"] }) }),
    request("/api/admin/coupons", cookie),
    request("/api/admin/coupons", cookie, { method: "POST", body: JSON.stringify({ code: "BYPASS", type: "fixed", value: 1 }) }),
    request("/api/admin/content/settings", cookie),
    request("/api/admin/content/settings/title", cookie, { method: "PUT", body: JSON.stringify({ value: "blocked" }) }),
    request("/api/admin/reports/inventory", cookie),
    request("/api/admin/audit-logs", cookie),
  ]);
  assert.deepEqual(protectedRequests.map(response => response.status), Array(8).fill(403));

  const suffix = randomUUID();
  const [product] = await db.insert(productsTable).values({ nameAr: `مخزون أمني ${suffix}`, slug: `security-stock-${suffix}`, price: "10", stockQuantity: 2, status: "active" }).returning();
  createdProductIds.push(product.id);
  assert.equal((await request("/api/admin/products", cookie)).status, 200);
  const adjustment = await request(`/api/admin/products/${product.id}/stock`, cookie, { method: "PATCH", body: JSON.stringify({ quantity: 1, movementType: "manual_increase", reason: "اختبار صلاحية المخزن" }) });
  assert.equal(adjustment.status, 200);
  assert.equal((await db.select().from(productsTable).where(eq(productsTable.id, product.id)))[0].stockQuantity, 3);
});

test("writable HTTP endpoints reject invalid discounts, negative product values and invalid reviews", async () => {
  const { user, password } = await createAdmin("administrator", []);
  const cookie = await login(user.email, password);
  const badCoupon = await request("/api/admin/coupons", cookie, { method: "POST", body: JSON.stringify({ code: `BAD-${randomUUID()}`, type: "percentage", value: 101 }) });
  assert.equal(badCoupon.status, 400);
  const negativePrice = await request("/api/admin/products", cookie, { method: "POST", body: JSON.stringify({ nameAr: "سعر سالب", price: -1, stockQuantity: 2 }) });
  const negativeStock = await request("/api/admin/products", cookie, { method: "POST", body: JSON.stringify({ nameAr: "مخزون سالب", price: 1, stockQuantity: -2 }) });
  assert.equal(negativePrice.status, 400);
  assert.equal(negativeStock.status, 400);

  const suffix = randomUUID();
  const [product] = await db.insert(productsTable).values({ nameAr: `مراجعة ${suffix}`, slug: `review-${suffix}`, price: "20", stockQuantity: 3, status: "active" }).returning();
  createdProductIds.push(product.id);
  const invalidReview = await fetch(`${baseUrl}/api/products/${product.id}/reviews`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rating: 6, comment: "غير صحيح" }) });
  assert.equal(invalidReview.status, 400);
  const anonymousReview = await fetch(`${baseUrl}/api/products/${product.id}/reviews`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rating: 5, comment: "مراجعة تنتظر الاعتماد" }) });
  assert.equal(anonymousReview.status, 201);
  const body = await anonymousReview.json() as { id: number; moderationStatus: string };
  assert.equal(body.moderationStatus, "pending");
  const [stored] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, body.id));
  assert.equal(stored.isApproved, 0);
});

test("price changes require the dedicated prices.edit permission", async () => {
  const { user, password } = await createAdmin("content_manager", ["products.view", "products.edit"]);
  const cookie = await login(user.email, password);
  const suffix = randomUUID();
  const [product] = await db.insert(productsTable).values({ nameAr: `سعر محمي ${suffix}`, slug: `price-protected-${suffix}`, price: "25", stockQuantity: 1, status: "active" }).returning();
  createdProductIds.push(product.id);
  const nameUpdate = await request(`/api/admin/products/${product.id}`, cookie, { method: "PATCH", body: JSON.stringify({ nameAr: `اسم معدل ${suffix}` }) });
  const priceUpdate = await request(`/api/admin/products/${product.id}`, cookie, { method: "PATCH", body: JSON.stringify({ price: 1 }) });
  assert.equal(nameUpdate.status, 200);
  assert.equal(priceUpdate.status, 403);
  assert.equal(Number((await db.select().from(productsTable).where(eq(productsTable.id, product.id)))[0].price), 25);
});

test("coupon validation enforces dates, minimum, restrictions and max usage under concurrency", async () => {
  const suffix = randomUUID();
  const [product] = await db.insert(productsTable).values({ nameAr: `كوبون ${suffix}`, slug: `coupon-product-${suffix}`, price: "100", stockQuantity: 5, status: "active" }).returning();
  createdProductIds.push(product.id);
  const baseInput = { subtotal: 100, items: [{ productId: product.id, categoryId: null, quantity: 1, unitPrice: 100 }], customerId: null };
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const [expired, future, minimum, restricted, limited] = await db.insert(couponsTable).values([
    { code: `EXP-${suffix}`, type: "fixed", value: "10", endDate: yesterday },
    { code: `FUT-${suffix}`, type: "fixed", value: "10", startDate: tomorrow },
    { code: `MIN-${suffix}`, type: "fixed", value: "10", minOrderAmount: "200" },
    { code: `RES-${suffix}`, type: "fixed", value: "10", productIds: [product.id + 999_999] },
    { code: `MAX-${suffix}`, type: "fixed", value: "10", maxUses: 1 },
  ]).returning();
  createdCouponIds.push(expired.id, future.id, minimum.id, restricted.id, limited.id);
  await assert.rejects(() => validateCoupon(expired.code, baseInput), (error: unknown) => error instanceof CouponValidationError && error.code === "EXPIRED");
  await assert.rejects(() => validateCoupon(future.code, baseInput), (error: unknown) => error instanceof CouponValidationError && error.code === "NOT_STARTED");
  await assert.rejects(() => validateCoupon(minimum.code, baseInput), (error: unknown) => error instanceof CouponValidationError && error.code === "MIN_ORDER");
  await assert.rejects(() => validateCoupon(restricted.code, baseInput), (error: unknown) => error instanceof CouponValidationError && error.code === "NO_ELIGIBLE_ITEMS");

  const [governorate] = await db.select().from(governoratesTable).limit(1);
  const orderPayload = (couponCode: string, checkoutToken: string) => ({ customerName: "عميل كوبون", mobile: "01000000000", governorateId: governorate.id, city: "اختبار", detailedAddress: "عنوان اختبار آمن", paymentMethod: "cash_on_delivery", couponCode, checkoutToken, cartItems: [{ productId: product.id, quantity: 1 }] });
  for (const coupon of [expired, future, minimum, restricted]) {
    const response = await fetch(`${baseUrl}/api/orders`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(orderPayload(coupon.code, `invalid-${coupon.id}-${suffix}`)) });
    assert.equal(response.status, 400);
  }
  const attempts = await Promise.all([1, 2].map(index => fetch(`${baseUrl}/api/orders`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(orderPayload(limited.code, `limited-${index}-${suffix}`)) })));
  assert.deepEqual(attempts.map(response => response.status).sort(), [201, 400]);
  const successful = attempts.find(response => response.status === 201)!;
  const createdOrder = await successful.json() as { id: number };
  createdOrderIds.push(createdOrder.id);
  const [savedCoupon] = await db.select().from(couponsTable).where(eq(couponsTable.id, limited.id));
  assert.equal(savedCoupon.usedCount, 1);
  assert.equal((await db.select().from(couponUsageTable).where(eq(couponUsageTable.couponId, limited.id))).length, 1);
});

test("concurrent cancellation approvals restore stock once and invalid state jumps are rejected", async () => {
  const adminCredentials = await createAdmin("administrator", []);
  const cookie = await login(adminCredentials.user.email, adminCredentials.password);
  const suffix = randomUUID();
  const [product] = await db.insert(productsTable).values({ nameAr: `إلغاء ${suffix}`, slug: `cancel-${suffix}`, price: "50", stockQuantity: 8, status: "active" }).returning();
  createdProductIds.push(product.id);
  const [governorate] = await db.select().from(governoratesTable).limit(1);
  const [order] = await db.insert(ordersTable).values({ orderNumber: `MK-CANCEL-${suffix}`, customerName: "اختبار", mobile: "01000000000", governorateName: governorate.nameAr, city: "اختبار", detailedAddress: "عنوان اختبار", subtotal: "100", shippingCost: "0", total: "100", status: "confirmed" }).returning();
  createdOrderIds.push(order.id);
  await db.insert(orderItemsTable).values({ orderId: order.id, productId: product.id, nameAr: product.nameAr, quantity: 2, unitPrice: "50", subtotal: "100" });
  await db.insert(cancellationRequestsTable).values({ orderId: order.id, reason: "طلب إلغاء متزامن", status: "pending" });
  const decisions = await Promise.all([1, 2].map(() => request(`/api/admin/orders/${order.id}/cancellation`, cookie, { method: "PATCH", body: JSON.stringify({ decision: "approved", notes: "موافقة متزامنة" }) })));
  assert.deepEqual(decisions.map(response => response.status), [200, 200], "duplicate HTTP approval is idempotent");
  const [after] = await db.select().from(productsTable).where(eq(productsTable.id, product.id));
  assert.equal(after.stockQuantity, 10);
  const restorations = await db.select().from(stockMovementsTable).where(and(eq(stockMovementsTable.orderId, order.id), eq(stockMovementsTable.movementType, "reservation_release")));
  assert.equal(restorations.length, 1);
  assert.equal((await db.select().from(auditLogsTable).where(and(eq(auditLogsTable.entityId, String(order.id)), eq(auditLogsTable.action, "order.cancelled")))).length, 1);

  const invalidTransition = await request(`/api/admin/orders/${order.id}/status`, cookie, { method: "PATCH", body: JSON.stringify({ status: "delivered" }) });
  assert.equal(invalidTransition.status, 409);
  await assert.rejects(() => transitionOrderStatus({ orderId: order.id, targetStatus: "delivered", actor: { employeeId: adminCredentials.user.id } }), (error: unknown) => error instanceof OrderStateError && error.code === "INVALID_TRANSITION");
});

test("CORS, request limits, session regeneration, disabled accounts and password reset rate limits are enforced", async () => {
  const allowed = await fetch(`${baseUrl}/api/healthz`, { headers: { origin: "http://localhost:5173" } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:5173");
  const denied = await fetch(`${baseUrl}/api/healthz`, { headers: { origin: "https://localhost.attacker.example" } });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("access-control-allow-origin"), null);

  const oversized = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "x@example.com", password: "x".repeat(1_100_000) }) });
  assert.equal(oversized.status, 413);

  const suffix = randomUUID();
  const customerPassword = `Customer-${suffix}`;
  const [customer] = await db.insert(customersTable).values({ name: "عميل جلسة", email: `session-${suffix}@example.test`, mobile: `01${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 15), passwordHash: await bcrypt.hash(customerPassword, 12) }).returning();
  createdCustomerIds.push(customer.id);
  const cartResponse = await fetch(`${baseUrl}/api/cart`);
  const anonymousCookie = cartResponse.headers.get("set-cookie")?.split(";", 1)[0] || "";
  const customerLogin = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", cookie: anonymousCookie }, body: JSON.stringify({ email: customer.email, password: customerPassword }) });
  assert.equal(customerLogin.status, 200);
  const authenticatedCookie = customerLogin.headers.get("set-cookie")?.split(";", 1)[0] || "";
  assert.ok(authenticatedCookie && authenticatedCookie !== anonymousCookie, "login regenerates the session identifier");

  const employee = await createAdmin("warehouse", ["products.view"]);
  const employeeCookie = await login(employee.user.email, employee.password);
  await db.update(usersTable).set({ isActive: false }).where(eq(usersTable.id, employee.user.id));
  assert.equal((await request("/api/admin/products", employeeCookie)).status, 401, "disabled employee session is rejected on its next request");

  const resetBodies: string[] = [];
  const resetStatuses: number[] = [];
  for (const email of [customer.email!, `unknown-${suffix}@example.test`, `u2-${suffix}@example.test`, `u3-${suffix}@example.test`, `u4-${suffix}@example.test`, `u5-${suffix}@example.test`]) {
    const response = await fetch(`${baseUrl}/api/auth/forgot-password`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    resetStatuses.push(response.status); resetBodies.push(await response.text());
  }
  assert.equal(resetBodies[0], resetBodies[1], "forgot-password response does not disclose account existence");
  assert.deepEqual(resetStatuses.slice(0, 5), [202, 202, 202, 202, 202]);
  assert.equal(resetStatuses[5], 429);
});

test("SEO product rendering returns metadata, structured data, dynamic sitemap and a real 404", async () => {
  const suffix = randomUUID();
  const [product] = await db.insert(productsTable).values({ nameAr: `كتاب SEO ${suffix}`, slug: `seo-${suffix}`, descriptionShort: "وصف عربي حقيقي للكتاب", price: "75", stockQuantity: 4, status: "active" }).returning();
  createdProductIds.push(product.id);
  const response = await fetch(`${baseUrl}/product/${product.slug}`);
  const document = await response.text();
  assert.equal(response.status, 200);
  assert.match(document, new RegExp(product.nameAr));
  assert.match(document, /rel="canonical"/);
  assert.match(document, /property="og:url"/);
  assert.match(document, /application\/ld\+json/);
  assert.match(document, /"@type":"Product"/);
  assert.match(document, /"@type":"BreadcrumbList"/);

  const missing = await fetch(`${baseUrl}/product/not-found-${suffix}`);
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /المنتج غير موجود/);
  const sitemap = await fetch(`${baseUrl}/sitemap.xml`);
  const sitemapXml = await sitemap.text();
  assert.equal(sitemap.status, 200);
  assert.match(sitemapXml, new RegExp(`/product/${product.slug}`));
  assert.match(sitemapXml, new RegExp(`http://localhost:5173/product/${product.slug}`));
});

test("admin UX APIs persist delivery ranges and protect classification dependencies", async () => {
  const adminCredentials = await createAdmin("administrator", []);
  const cookie = await login(adminCredentials.user.email, adminCredentials.password);
  const [governorate] = await db.select().from(governoratesTable).limit(1);
  const invalidRange = await request(`/api/admin/shipping/governorates/${governorate.id}`, cookie, { method: "PATCH", body: JSON.stringify({ minDeliveryDays: 5, maxDeliveryDays: 2 }) });
  assert.equal(invalidRange.status, 400);
  const updatedRange = await request(`/api/admin/shipping/governorates/${governorate.id}`, cookie, { method: "PATCH", body: JSON.stringify({ minDeliveryDays: 1, maxDeliveryDays: 4, shippingCost: Number(governorate.shippingCost), freeShippingThreshold: governorate.freeShippingThreshold == null ? null : Number(governorate.freeShippingThreshold) }) });
  assert.equal(updatedRange.status, 200);
  const publicGovernorates = await fetch(`${baseUrl}/api/governorates`).then(response => response.json()) as { id: number; minDeliveryDays: number; maxDeliveryDays: number; estimatedDeliveryText: string }[];
  const publicGovernorate = publicGovernorates.find(row => row.id === governorate.id);
  assert.equal(publicGovernorate?.minDeliveryDays, 1);
  assert.equal(publicGovernorate?.maxDeliveryDays, 4);
  assert.match(publicGovernorate?.estimatedDeliveryText || "", /1.*4/);
  await db.update(governoratesTable).set({ minDeliveryDays: governorate.minDeliveryDays, maxDeliveryDays: governorate.maxDeliveryDays }).where(eq(governoratesTable.id, governorate.id));

  const stageName = `مرحلة اختبار ${randomUUID()}`;
  const createdResponse = await request("/api/admin/classifications/stages", cookie, { method: "POST", body: JSON.stringify({ nameAr: stageName, nameEn: "UX test", sortOrder: 99, isActive: true }) });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json() as { id: number };
  createdStageIds.push(created.id);
  const edited = await request(`/api/admin/classifications/stages/${created.id}`, cookie, { method: "PATCH", body: JSON.stringify({ nameEn: "Edited", sortOrder: 100 }) });
  assert.equal(edited.status, 200);
  const suffix = randomUUID();
  const [product] = await db.insert(productsTable).values({ nameAr: `تصنيف مرتبط ${suffix}`, slug: `classification-${suffix}`, price: "20", stockQuantity: 2, status: "active", stageId: created.id }).returning();
  createdProductIds.push(product.id);
  const blockedDelete = await request(`/api/admin/classifications/stages/${created.id}`, cookie, { method: "DELETE" });
  assert.equal(blockedDelete.status, 409);
  assert.equal((await blockedDelete.json() as { relatedProducts: number }).relatedProducts, 1);
  const deactivated = await request(`/api/admin/classifications/stages/${created.id}?mode=deactivate`, cookie, { method: "DELETE" });
  assert.equal(deactivated.status, 200);
  assert.equal((await db.select().from(stagesTable).where(eq(stagesTable.id, created.id)))[0].isActive, false);

  const replacementResponse = await request("/api/admin/classifications/stages", cookie, { method: "POST", body: JSON.stringify({ nameAr: `مرحلة بديلة ${suffix}`, sortOrder: 100 }) });
  const replacement = await replacementResponse.json() as { id: number };
  createdStageIds.push(replacement.id);
  const reassigned = await request(`/api/admin/classifications/stages/${created.id}/reassign`, cookie, { method: "POST", body: JSON.stringify({ targetId: replacement.id }) });
  assert.equal(reassigned.status, 200);
  assert.equal((await db.select().from(productsTable).where(eq(productsTable.id, product.id)))[0].stageId, replacement.id);
  const deleteAfterReassign = await request(`/api/admin/classifications/stages/${created.id}`, cookie, { method: "DELETE" });
  assert.equal(deleteAfterReassign.status, 200);

  const unusedResponse = await request("/api/admin/classifications/stages", cookie, { method: "POST", body: JSON.stringify({ nameAr: `غير مستخدم ${suffix}`, sortOrder: 101 }) });
  const unused = await unusedResponse.json() as { id: number };
  const hardDelete = await request(`/api/admin/classifications/stages/${unused.id}`, cookie, { method: "DELETE" });
  assert.equal(hardDelete.status, 200);
  assert.equal((await hardDelete.json() as { mode: string }).mode, "deleted");

  const teacherResponse = await request("/api/admin/classifications/teachers", cookie, { method: "POST", body: JSON.stringify({ nameAr: `مدرس قديم ${suffix}` }) });
  assert.equal(teacherResponse.status, 201);
  const teacher = await teacherResponse.json() as { id: number };
  await db.update(productsTable).set({ author: `مدرس قديم ${suffix}` }).where(eq(productsTable.id, product.id));
  const renamedTeacher = await request(`/api/admin/classifications/teachers/${teacher.id}`, cookie, { method: "PATCH", body: JSON.stringify({ nameAr: `مدرس جديد ${suffix}` }) });
  assert.equal(renamedTeacher.status, 200);
  assert.equal((await db.select().from(productsTable).where(eq(productsTable.id, product.id)))[0].author, `مدرس جديد ${suffix}`);
  await db.update(productsTable).set({ author: null }).where(eq(productsTable.id, product.id));
  assert.equal((await request(`/api/admin/classifications/teachers/${teacher.id}`, cookie, { method: "DELETE" })).status, 200);
});

test("coupon archive, product notices and detailed orders are database-backed and permission protected", async () => {
  const adminCredentials = await createAdmin("administrator", []); const cookie = await login(adminCredentials.user.email, adminCredentials.password); const suffix = randomUUID();
  const unusedCreate = await request("/api/admin/coupons", cookie, { method: "POST", body: JSON.stringify({ code: `UNUSED-${suffix}`, type: "fixed", value: 5, minOrderAmount: 20 }) });
  const unused = await unusedCreate.json() as { id: number }; createdCouponIds.push(unused.id);
  const editedCoupon = await request(`/api/admin/coupons/${unused.id}`, cookie, { method: "PATCH", body: JSON.stringify({ value: 7, isActive: false }) });
  assert.equal(editedCoupon.status, 200);
  const editedCouponBody = await editedCoupon.json() as { value: number; isActive: boolean };
  assert.equal(editedCouponBody.value, 7);
  assert.equal(editedCouponBody.isActive, false);
  const duplicateCoupon = await request(`/api/admin/coupons/${unused.id}/duplicate`, cookie, { method: "POST", body: JSON.stringify({ code: `COPY-${suffix}` }) });
  assert.equal(duplicateCoupon.status, 201);
  const duplicate = await duplicateCoupon.json() as { id: number; isActive: boolean }; createdCouponIds.push(duplicate.id);
  assert.equal(duplicate.isActive, false);
  assert.equal((await request(`/api/admin/coupons/${duplicate.id}`, cookie, { method: "DELETE" })).status, 200);
  const unusedDelete = await request(`/api/admin/coupons/${unused.id}`, cookie, { method: "DELETE" });
  assert.equal((await unusedDelete.json() as { mode: string }).mode, "deleted");
  const [governorate] = await db.select().from(governoratesTable).limit(1);
  const [order] = await db.insert(ordersTable).values({ orderNumber: `MK-UX-${suffix}`, customerName: "عميل تجربة الإدارة", mobile: "01000000000", governorateName: governorate.nameAr, city: "اختبار", detailedAddress: "عنوان تفصيلي للاختبار", subtotal: "50", shippingBaseCost: "10", shippingSurcharge: "2", shippingDiscount: "0", shippingCost: "12", shippingRuleSnapshot: { minDeliveryDays: 1, maxDeliveryDays: 3 }, total: "62" }).returning();
  createdOrderIds.push(order.id);
  const [used] = await db.insert(couponsTable).values({ code: `USED-${suffix}`, type: "fixed", value: "5", usedCount: 1 }).returning(); createdCouponIds.push(used.id);
  await db.insert(couponUsageTable).values({ couponId: used.id, orderId: order.id, discountAmount: "5" });
  const archive = await request(`/api/admin/coupons/${used.id}`, cookie, { method: "DELETE" });
  assert.equal((await archive.json() as { mode: string }).mode, "archived");
  assert.ok((await db.select().from(couponsTable).where(eq(couponsTable.id, used.id)))[0].archivedAt);

  const [product] = await db.insert(productsTable).values({ nameAr: `حجز مسبق ${suffix}`, slug: `notice-${suffix}`, price: "75", stockQuantity: 3, status: "active" }).returning(); createdProductIds.push(product.id);
  const allowed = await createAdmin("content_manager", ["products.view", "products.edit", "products.notices.manage"]); const allowedCookie = await login(allowed.user.email, allowed.password);
  const noticeUpdate = await request(`/api/admin/products/${product.id}`, allowedCookie, { method: "PATCH", body: JSON.stringify({ customerNoticeEnabled: true, customerNoticeTitle: "هذا الكتاب متاح بالحجز المسبق", customerNoticeMessage: "سيتم التواصل معك عند توفر الكتاب.", customerNoticeButtonText: "موافق، متابعة الطلب", customerNoticeType: "preorder", customerNoticeTrigger: "add_to_cart", customerNoticeDismissible: false }) });
  assert.equal(noticeUpdate.status, 200);
  const publicProduct = await fetch(`${baseUrl}/api/products/${product.slug}`).then(response => response.json()) as { customerNoticeEnabled: boolean; customerNoticeTitle: string; customerNoticeTrigger: string };
  assert.deepEqual({ enabled: publicProduct.customerNoticeEnabled, title: publicProduct.customerNoticeTitle, trigger: publicProduct.customerNoticeTrigger }, { enabled: true, title: "هذا الكتاب متاح بالحجز المسبق", trigger: "add_to_cart" });
  const cart = await fetch(`${baseUrl}/api/cart/items`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId: product.id, quantity: 1 }) }).then(response => response.json()) as { items: { customerNoticeTitle?: string }[] };
  assert.equal(cart.items[0].customerNoticeTitle, "هذا الكتاب متاح بالحجز المسبق");
  const denied = await createAdmin("content_manager", ["products.view", "products.edit", "orders.view"]); const deniedCookie = await login(denied.user.email, denied.password);
  assert.equal((await request(`/api/admin/products/${product.id}`, deniedCookie, { method: "PATCH", body: JSON.stringify({ customerNoticeEnabled: false }) })).status, 403);

  const detail = await request(`/api/admin/orders/${order.id}`, deniedCookie); assert.equal(detail.status, 200);
  const detailBody = await detail.json() as { shippingRuleSnapshot: { minDeliveryDays: number }; inventoryMovements: unknown[]; auditHistory: unknown[] };
  assert.equal(detailBody.shippingRuleSnapshot.minDeliveryDays, 1); assert.ok(Array.isArray(detailBody.inventoryMovements)); assert.ok(Array.isArray(detailBody.auditHistory));
  assert.equal((await request(`/api/admin/orders/${order.id}/status`, deniedCookie, { method: "PATCH", body: JSON.stringify({ status: "confirmed" }) })).status, 403);
});
