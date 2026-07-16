import { Router, type IRouter } from "express";
import { db, productsTable, governoratesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { calculateShipping } from "../services/shipping";
import { CouponValidationError, validateCoupon } from "../services/coupons";
import { parseBody } from "../lib/validation";
import { z } from "@workspace/api-zod";

const router: IRouter = Router();
const cartItemSchema = z.object({ productId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().positive().max(99) });
const cartQuantitySchema = z.object({ quantity: z.coerce.number().int().min(0).max(99) });
const couponCodeSchema = z.object({ code: z.string().trim().min(2).max(50).transform(value => value.toUpperCase()) });

interface CartItemSession {
  productId: number;
  quantity: number;
}

interface CartSession {
  items: CartItemSession[];
  couponCode?: string;
  governorateId?: number;
  notes?: string;
}

function getCartFromSession(req: Parameters<typeof router.get>[1] extends (...args: infer A) => unknown ? A[0] : never): CartSession {
  
  if (!req.session.cart) {
    req.session.cart = { items: [] };
  }
  return req.session.cart as CartSession;
}

async function buildCartResponse(cart: CartSession) {
  if (cart.items.length === 0) {
    return { items: [], subtotal: 0, discount: 0, shippingCost: 0, total: 0, couponCode: null, couponDiscount: 0, governorateId: null, notes: null };
  }

  const productIds = [...new Set(cart.items.map(item => item.productId))];
  const productRows = await db.select().from(productsTable).where(inArray(productsTable.id, productIds));
  const productMap: Record<number, typeof productsTable.$inferSelect> = Object.fromEntries(
    productRows.map(product => [product.id, product]),
  );

  let subtotal = 0;
  const items = cart.items.map(item => {
    const p = productMap[item.productId];
    if (!p) return null;
    const unitPrice = Number(p.price);
    const itemSubtotal = unitPrice * item.quantity;
    subtotal += itemSubtotal;
    return {
      productId: p.id, nameAr: p.nameAr, coverImage: p.coverImage,
      slug: p.slug, quantity: item.quantity, unitPrice,
      oldPrice: p.oldPrice ? Number(p.oldPrice) : null,
      subtotal: itemSubtotal, inStock: p.stockQuantity > 0,
      stockQuantity: p.stockQuantity,
      freeShipping: p.freeShipping,
      freeShippingBadgeText: p.freeShippingBadgeText,
      customerNoticeEnabled: p.customerNoticeEnabled,
      customerNoticeTitle: p.customerNoticeTitle,
      customerNoticeMessage: p.customerNoticeMessage,
      customerNoticeButtonText: p.customerNoticeButtonText,
      customerNoticeType: p.customerNoticeType,
      customerNoticeTrigger: p.customerNoticeTrigger,
      customerNoticeStartAt: p.customerNoticeStartAt,
      customerNoticeEndAt: p.customerNoticeEndAt,
      customerNoticeDismissible: p.customerNoticeDismissible,
    };
  }).filter(Boolean);

  let governorate: typeof governoratesTable.$inferSelect | undefined;
  if (cart.governorateId) {
    const [gov] = await db.select().from(governoratesTable).where(eq(governoratesTable.id, cart.governorateId));
    governorate = gov;
  }

  let couponDiscount = 0;
  let freeShippingCoupon = false;
  if (cart.couponCode) {
    try {
      const application = await validateCoupon(cart.couponCode, { subtotal, items: cart.items.flatMap(item => { const product = productMap[item.productId]; return product ? [{ productId: product.id, categoryId: product.categoryId, quantity: item.quantity, unitPrice: Number(product.price) }] : []; }) });
      couponDiscount = application.discount;
      freeShippingCoupon = application.freeShipping;
    } catch (error) { if (!(error instanceof CouponValidationError)) throw error; }
  }

  const shipping = governorate ? calculateShipping({
    products: cart.items.flatMap(item => {
      const product = productMap[item.productId];
      return product ? [{ price: Number(product.price), quantity: item.quantity, freeShipping: product.freeShipping, freeShippingStartAt: product.freeShippingStartAt, freeShippingEndAt: product.freeShippingEndAt }] : [];
    }),
    subtotal,
    baseShippingCost: Number(governorate.shippingCost),
    governorateThreshold: governorate.freeShippingThreshold ? Number(governorate.freeShippingThreshold) : null,
    surcharge: 0,
    freeShippingCoupon,
  }) : { finalCost: 0, freeShippingReason: null };
  const shippingCost = shipping.finalCost;

  const total = Math.max(0, subtotal - couponDiscount + shippingCost);
  return {
    items, subtotal, discount: 0, shippingCost, total,
    couponCode: cart.couponCode || null, couponDiscount,
    governorateId: cart.governorateId || null, notes: cart.notes || null,
    freeShippingReason: shipping.freeShippingReason,
  };
}

router.get("/cart", async (req, res): Promise<void> => {
  const cart = getCartFromSession(req);
  res.json(await buildCartResponse(cart));
});

router.post("/cart/items", async (req, res): Promise<void> => {
  const input = parseBody(cartItemSchema, req.body, res); if (!input) return;
  const { productId, quantity } = input;
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  const cart = getCartFromSession(req);
  const existing = cart.items.find(i => i.productId === productId);
  const newQty = existing ? existing.quantity + quantity : quantity;
  const safeQty = Math.min(newQty, product.stockQuantity);

  if (existing) existing.quantity = safeQty;
  else cart.items.push({ productId, quantity: safeQty });

  (req.session).cart = cart;
  res.json(await buildCartResponse(cart));
});

router.patch("/cart/items/:productId", async (req, res): Promise<void> => {
  const input = parseBody(cartQuantitySchema, req.body, res); if (!input) return;
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);
  const { quantity } = input;

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  const cart = getCartFromSession(req);
  const item = cart.items.find(i => i.productId === productId);
  if (!item) { res.status(404).json({ error: "Item not in cart" }); return; }

  if (quantity <= 0) cart.items = cart.items.filter(i => i.productId !== productId);
  else item.quantity = Math.min(quantity, product.stockQuantity);

  (req.session).cart = cart;
  res.json(await buildCartResponse(cart));
});

router.delete("/cart/items/:productId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);
  const cart = getCartFromSession(req);
  cart.items = cart.items.filter(i => i.productId !== productId);
  (req.session).cart = cart;
  res.json(await buildCartResponse(cart));
});

router.post("/cart/coupon", async (req, res): Promise<void> => {
  const input = parseBody(couponCodeSchema, req.body, res); if (!input) return;
  const { code } = input;
  const cart = getCartFromSession(req);
  const preview = await buildCartResponse({ ...cart, couponCode: undefined });
  try {
    const productRows = cart.items.length ? await db.select().from(productsTable).where(inArray(productsTable.id, cart.items.map(item => item.productId))) : [];
    const productMap = new Map(productRows.map(product => [product.id, product]));
    await validateCoupon(code, { subtotal: preview.subtotal, customerId: req.session.customerId ?? null, items: cart.items.flatMap(item => { const product = productMap.get(item.productId); return product ? [{ productId: product.id, categoryId: product.categoryId, quantity: item.quantity, unitPrice: Number(product.price) }] : []; }) });
  } catch (error) {
    if (error instanceof CouponValidationError) { res.status(400).json({ error: error.message, code: error.code }); return; }
    throw error;
  }
  cart.couponCode = code;
  (req.session).cart = cart;
  res.json(await buildCartResponse(cart));
});

router.delete("/cart/coupon", async (req, res): Promise<void> => {
  const cart = getCartFromSession(req);
  delete cart.couponCode;
  (req.session).cart = cart;
  res.json(await buildCartResponse(cart));
});

export default router;
