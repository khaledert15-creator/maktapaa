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
  stockMovementsTable, usersTable,
} from "@workspace/db";
import { CouponValidationError, validateCoupon } from "../services/coupons";
import { OrderStateError, transitionOrderStatus } from "../services/order-state";

let server: Server;
let baseUrl = "";
const createdUserIds: number[] = [];
const createdProductIds: number[] = [];
const createdOrderIds: number[] = [];
const createdCouponIds: number[] = [];

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
