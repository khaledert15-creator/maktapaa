export type ProductNoticeTiming = {
  customerNoticeEnabled?: boolean;
  customerNoticeTitle?: string | null;
  customerNoticeMessage?: string | null;
  customerNoticeTrigger?: "product_open" | "add_to_cart" | "buy_now" | "checkout" | "first_interaction" | null;
  customerNoticeStartAt?: string | Date | null;
  customerNoticeEndAt?: string | Date | null;
};

export type ProductNoticeAction = "product_open" | "add_to_cart" | "buy_now" | "checkout" | "first_interaction";

export function isProductNoticeActive(product: ProductNoticeTiming, at = Date.now()): boolean {
  if (!product.customerNoticeEnabled || !product.customerNoticeTitle || !product.customerNoticeMessage || !product.customerNoticeTrigger) return false;
  const start = product.customerNoticeStartAt ? new Date(product.customerNoticeStartAt).getTime() : null;
  const end = product.customerNoticeEndAt ? new Date(product.customerNoticeEndAt).getTime() : null;
  return !(start && start > at) && !(end && end < at);
}

export function shouldShowProductNotice(product: ProductNoticeTiming, action: ProductNoticeAction, accepted: boolean, at = Date.now()): boolean {
  if (accepted || !isProductNoticeActive(product, at)) return false;
  if (product.customerNoticeTrigger === "first_interaction") return action !== "product_open";
  return product.customerNoticeTrigger === action;
}
