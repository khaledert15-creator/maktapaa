import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CalendarClock, Info, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type ProductNotice = {
  id: number; nameAr?: string; coverImage?: string | null;
  customerNoticeEnabled?: boolean; customerNoticeTitle?: string | null; customerNoticeMessage?: string | null;
  customerNoticeButtonText?: string | null; customerNoticeType?: "information" | "warning" | "preorder" | "delayed_delivery" | "custom" | null;
  customerNoticeTrigger?: "product_open" | "add_to_cart" | "buy_now" | "checkout" | "first_interaction" | null;
  customerNoticeStartAt?: string | Date | null; customerNoticeEndAt?: string | Date | null; customerNoticeDismissible?: boolean;
};
export type NoticeAction = "product_open" | "add_to_cart" | "buy_now" | "checkout" | "first_interaction";

function isActive(product: ProductNotice): boolean {
  if (!product.customerNoticeEnabled || !product.customerNoticeTitle || !product.customerNoticeMessage || !product.customerNoticeTrigger) return false;
  const now = Date.now(); const start = product.customerNoticeStartAt ? new Date(product.customerNoticeStartAt).getTime() : null; const end = product.customerNoticeEndAt ? new Date(product.customerNoticeEndAt).getTime() : null;
  return !(start && start > now) && !(end && end < now);
}

function icon(type: ProductNotice["customerNoticeType"]) {
  if (type === "warning") return AlertTriangle;
  if (type === "preorder") return PackageCheck;
  if (type === "delayed_delivery") return CalendarClock;
  return Info;
}

export function useProductNotice(product?: ProductNotice | null, openOnLoad = false) {
  const [open, setOpen] = useState(false); const pending = useRef<null | (() => void)>(null);
  const sessionKey = product ? `maktaba-product-notice-${product.id}` : "";
  const accepted = useCallback(() => Boolean(sessionKey && sessionStorage.getItem(sessionKey) === "accepted"), [sessionKey]);
  const shouldGate = useCallback((action: NoticeAction) => Boolean(product && isActive(product) && !accepted() && (product.customerNoticeTrigger === action || product.customerNoticeTrigger === "first_interaction")), [accepted, product]);
  const request = useCallback((action: NoticeAction, continueAction?: () => void) => {
    if (!shouldGate(action)) { continueAction?.(); return false; }
    pending.current = continueAction ?? null; setOpen(true); return true;
  }, [shouldGate]);
  useEffect(() => { if (openOnLoad) request("product_open"); }, [openOnLoad, request]);
  const confirm = () => {
    if (sessionKey) sessionStorage.setItem(sessionKey, "accepted");
    const action = pending.current; pending.current = null; setOpen(false); action?.();
  };
  const changeOpen = (next: boolean) => {
    if (next) setOpen(true);
    else if (product?.customerNoticeDismissible) { pending.current = null; setOpen(false); }
  };
  const Icon = icon(product?.customerNoticeType);
  const modal = product ? <Dialog open={open} onOpenChange={changeOpen}>
    <DialogContent dir="rtl" showClose={Boolean(product.customerNoticeDismissible)} className="max-w-xl overflow-hidden rounded-3xl border-0 p-0" onEscapeKeyDown={event => { if (!product.customerNoticeDismissible) event.preventDefault(); }} onPointerDownOutside={event => event.preventDefault()} onInteractOutside={event => event.preventDefault()}>
      <div className="bg-gradient-to-l from-sky-50 to-amber-50 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          {product.coverImage ? <img src={product.coverImage} alt={product.nameAr || "المنتج"} className="h-24 w-20 shrink-0 rounded-2xl object-cover shadow" /> : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white text-primary shadow"><Icon className="h-8 w-8" /></div>}
          <DialogHeader className="space-y-3 text-right sm:text-right"><DialogTitle className="text-xl leading-8 sm:text-2xl">{product.customerNoticeTitle}</DialogTitle><DialogDescription className="whitespace-pre-wrap text-base leading-7 text-slate-700">{product.customerNoticeMessage}</DialogDescription></DialogHeader>
        </div>
      </div>
      <div className="p-5 sm:p-6"><Button autoFocus onClick={confirm} className="h-12 w-full rounded-xl text-base">{product.customerNoticeButtonText || "موافق، متابعة"}</Button>{product.customerNoticeDismissible && <button type="button" className="mt-3 w-full text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => changeOpen(false)}>العودة دون متابعة</button>}</div>
    </DialogContent>
  </Dialog> : null;
  return { request, modal, isOpen: open };
}
