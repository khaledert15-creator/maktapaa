import test from "node:test";
import assert from "node:assert/strict";
import { calculateShipping } from "./shipping";

const normalProduct = { price: 100, quantity: 1, freeShipping: false };
const freeProduct = { price: 100, quantity: 1, freeShipping: true };

test("all free-shipping products produce zero shipping", () => {
  const result = calculateShipping({ products: [freeProduct, freeProduct], subtotal: 200, baseShippingCost: 60, surcharge: 10 });
  assert.equal(result.finalCost, 0);
  assert.equal(result.rule, "all_products_free");
});

test("a mixed cart pays the standard shipping once", () => {
  const result = calculateShipping({ products: [freeProduct, normalProduct], subtotal: 200, baseShippingCost: 60, surcharge: 10 });
  assert.equal(result.finalCost, 70);
  assert.equal(result.rule, "standard");
});

test("free-shipping coupon takes priority over threshold and base cost", () => {
  const result = calculateShipping({ products: [normalProduct], subtotal: 100, baseShippingCost: 60, governorateThreshold: 500, freeShippingCoupon: true });
  assert.equal(result.finalCost, 0);
  assert.equal(result.rule, "coupon");
});

test("governorate threshold applies when reached", () => {
  const result = calculateShipping({ products: [normalProduct], subtotal: 500, baseShippingCost: 60, governorateThreshold: 500 });
  assert.equal(result.finalCost, 0);
  assert.equal(result.rule, "governorate_threshold");
});

test("city override replaces base cost and adds surcharge", () => {
  const result = calculateShipping({ products: [normalProduct], subtotal: 100, baseShippingCost: 60, cityPriceOverride: 75, surcharge: 15 });
  assert.equal(result.baseCost, 75);
  assert.equal(result.finalCost, 90);
});
