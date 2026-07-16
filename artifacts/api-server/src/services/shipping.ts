export type ShippingProduct = {
  price: number;
  quantity: number;
  freeShipping: boolean;
  freeShippingStartAt?: Date | null;
  freeShippingEndAt?: Date | null;
};

export type ShippingRuleInput = {
  products: ShippingProduct[];
  subtotal: number;
  baseShippingCost: number;
  governorateThreshold?: number | null;
  cityPriceOverride?: number | null;
  surcharge?: number;
  freeShippingCoupon?: boolean;
  now?: Date;
};

export type ShippingCalculation = {
  baseCost: number;
  surcharge: number;
  discount: number;
  finalCost: number;
  freeShippingReason: string | null;
  rule: "all_products_free" | "coupon" | "governorate_threshold" | "standard";
};

function productHasFreeShipping(product: ShippingProduct, now: Date): boolean {
  if (!product.freeShipping) return false;
  if (product.freeShippingStartAt && product.freeShippingStartAt > now) return false;
  if (product.freeShippingEndAt && product.freeShippingEndAt < now) return false;
  return true;
}

export function calculateShipping(input: ShippingRuleInput): ShippingCalculation {
  const now = input.now ?? new Date();
  const allProductsFree = input.products.length > 0 && input.products.every(product => productHasFreeShipping(product, now));
  const baseCost = input.cityPriceOverride ?? input.baseShippingCost;
  const surcharge = Math.max(0, input.surcharge ?? 0);
  const standardTotal = Math.max(0, baseCost + surcharge);

  if (allProductsFree) return { baseCost, surcharge, discount: standardTotal, finalCost: 0, freeShippingReason: "جميع منتجات الطلب تشمل شحنًا مجانيًا", rule: "all_products_free" };
  if (input.freeShippingCoupon) return { baseCost, surcharge, discount: standardTotal, finalCost: 0, freeShippingReason: "كوبون شحن مجاني", rule: "coupon" };
  if (input.governorateThreshold != null && input.subtotal >= input.governorateThreshold) {
    return { baseCost, surcharge, discount: standardTotal, finalCost: 0, freeShippingReason: "تجاوز الطلب حد الشحن المجاني للمحافظة", rule: "governorate_threshold" };
  }
  return { baseCost, surcharge, discount: 0, finalCost: standardTotal, freeShippingReason: null, rule: "standard" };
}
