import test from "node:test";
import assert from "node:assert/strict";
import { isProductNoticeActive, normalizeEgyptianPhone, resolvePreferredWhatsAppPhone, shouldShowProductNotice, toWhatsAppInternational } from "@workspace/api-zod";
import { buildOrderWhatsAppLink } from "./order-whatsapp";

test("Egyptian phone normalization stores one canonical local format and resolves the preferred WhatsApp phone", () => {
  assert.equal(normalizeEgyptianPhone("+20 101 234 5678"), "01012345678");
  assert.equal(normalizeEgyptianPhone("٠١١٢٣٤٥٦٧٨٩"), "01123456789");
  assert.equal(toWhatsAppInternational("01012345678"), "201012345678");
  assert.equal(normalizeEgyptianPhone("01912345678"), null);
  assert.equal(resolvePreferredWhatsAppPhone({ primaryPhone: "01012345678", primaryPhoneHasWhatsApp: true, alternatePhone: "01123456789", alternatePhoneHasWhatsApp: true, preferredWhatsAppPhone: "01123456789" }), "01123456789");
  assert.equal(resolvePreferredWhatsAppPhone({ primaryPhone: "01012345678", primaryPhoneHasWhatsApp: true, alternatePhone: null, alternatePhoneHasWhatsApp: false }), "01012345678");
});

test("product notices enforce active dates, trigger type, first interaction and once-per-session state", () => {
  const now = Date.parse("2026-07-17T12:00:00Z");
  const base = { customerNoticeEnabled: true, customerNoticeTitle: "تنبيه", customerNoticeMessage: "رسالة", customerNoticeTrigger: "add_to_cart" as const, customerNoticeStartAt: "2026-07-17T11:00:00Z", customerNoticeEndAt: "2026-07-17T13:00:00Z" };
  assert.equal(isProductNoticeActive(base, now), true);
  assert.equal(shouldShowProductNotice(base, "add_to_cart", false, now), true);
  assert.equal(shouldShowProductNotice(base, "buy_now", false, now), false);
  assert.equal(shouldShowProductNotice(base, "add_to_cart", true, now), false);
  assert.equal(isProductNoticeActive({ ...base, customerNoticeEnabled: false }, now), false);
  assert.equal(isProductNoticeActive({ ...base, customerNoticeStartAt: "2026-07-18T00:00:00Z" }, now), false);
  assert.equal(isProductNoticeActive({ ...base, customerNoticeEndAt: "2026-07-16T00:00:00Z" }, now), false);
  const first = { ...base, customerNoticeTrigger: "first_interaction" as const };
  assert.equal(shouldShowProductNotice(first, "product_open", false, now), false);
  assert.equal(shouldShowProductNotice(first, "add_to_cart", false, now), true);
  assert.equal(shouldShowProductNotice(first, "checkout", false, now), true);
});

test("WhatsApp order action selects only a capable preferred number and builds a safe detailed Arabic message", () => {
  const order = {
    orderNumber: "MK-100", customerName: "خالد", mobile: "01012345678", primaryPhoneHasWhatsApp: true,
    altMobile: "01123456789", alternatePhoneHasWhatsApp: true, preferredWhatsAppPhone: "01123456789",
    governorateName: "القاهرة", city: "مدينة نصر", detailedAddress: "١ شارع الاختبار", landmark: "بجوار المدرسة",
    subtotal: "200", discount: "10", couponDiscount: "5", shippingCost: "25", total: "210",
    freeShippingReason: null, paymentMethod: "cash_on_delivery", status: "confirmed", deliveryNotes: "الاتصال قبل الوصول", orderNotes: null,
  };
  const result = buildOrderWhatsAppLink(order, [{ nameAr: "كتاب العلوم", quantity: 2, unitPrice: "100", subtotal: "200" }]);
  assert.ok(result);
  assert.equal(result.phone, "201123456789");
  assert.match(result.url, /^https:\/\/wa\.me\/201123456789\?text=/);
  assert.match(result.message, /كتاب العلوم × 2/);
  assert.match(result.message, /الخصم: 15\.00 ج\.م/);
  assert.match(result.message, /حالة الطلب: مؤكد/);
  assert.doesNotMatch(result.message, /internal|ملاحظات داخلية/i);
  assert.equal(buildOrderWhatsAppLink({ ...order, primaryPhoneHasWhatsApp: false, alternatePhoneHasWhatsApp: false, preferredWhatsAppPhone: null }, []), null);
});
