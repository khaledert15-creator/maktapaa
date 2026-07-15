import { Router, type IRouter } from "express";
import { db, productsTable, governoratesTable, couponsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

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

  const productIds = cart.items.map(i => i.productId);
  const products = await db.select().from(productsTable).where(
    productIds.length === 1
      ? eq(productsTable.id, productIds[0])
      : eq(productsTable.id, productIds[0]) // fallback - fetch individually below
  );

  const productMap: Record<number, typeof productsTable.$inferSelect> = {};
  for (const pid of productIds) {
    const [p] = await db.select().from(productsTable).where(eq(productsTable.id, pid));
    if (p) productMap[pid] = p;
  }

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
    };
  }).filter(Boolean);

  let shippingCost = 0;
  if (cart.governorateId) {
    const [gov] = await db.select().from(governoratesTable).where(eq(governoratesTable.id, cart.governorateId));
    if (gov) {
      shippingCost = gov.freeShippingThreshold && subtotal >= Number(gov.freeShippingThreshold)
        ? 0 : Number(gov.shippingCost);
    }
  }

  let couponDiscount = 0;
  if (cart.couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, cart.couponCode));
    if (coupon && coupon.isActive) {
      if (coupon.type === "percentage") couponDiscount = subtotal * (Number(coupon.value) / 100);
      else if (coupon.type === "fixed") couponDiscount = Math.min(Number(coupon.value), subtotal);
      else if (coupon.type === "free_shipping") shippingCost = 0;
    }
  }

  const total = Math.max(0, subtotal - couponDiscount + shippingCost);
  return {
    items, subtotal, discount: 0, shippingCost, total,
    couponCode: cart.couponCode || null, couponDiscount,
    governorateId: cart.governorateId || null, notes: cart.notes || null,
  };
}

router.get("/cart", async (req, res): Promise<void> => {
  const cart = getCartFromSession(req);
  res.json(await buildCartResponse(cart));
});

router.post("/cart/items", async (req, res): Promise<void> => {
  const { productId, quantity } = req.body;
  if (!productId || !quantity || quantity < 1) {
    res.status(400).json({ error: "productId and quantity required" });
    return;
  }
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
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);
  const { quantity } = req.body;

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
  const { code } = req.body;
  const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, code));
  if (!coupon || !coupon.isActive) {
    res.status(400).json({ error: "كود الخصم غير صالح" });
    return;
  }
  const cart = getCartFromSession(req);
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
