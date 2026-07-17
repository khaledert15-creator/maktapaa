import { CheckCircle2, Circle } from "lucide-react";
import type { OrderStatusHistory } from "@workspace/api-client-react";

export const orderStatusLabels: Record<string, string> = {
  new: "تم استلام الطلب", awaiting_confirmation: "بانتظار التأكيد", confirmed: "تم تأكيد الطلب", preparing: "جاري التجهيز", ready_for_shipping: "جاهز للشحن", shipped: "تم الشحن", out_for_delivery: "في الطريق إليك", delivered: "تم التسليم", delivery_failed: "تعذر التسليم", returned: "مرتجع", partially_returned: "مرتجع جزئيًا", cancelled: "ملغي",
};

export function OrderTimeline({ history }: { history?: OrderStatusHistory[] }) {
  const sorted = [...(history || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  if (!sorted.length) return <p className="text-sm text-muted-foreground">لا توجد تحديثات بعد.</p>;
  return <ol className="relative space-y-0 before:absolute before:right-[15px] before:top-5 before:h-[calc(100%-40px)] before:w-px before:bg-border">{sorted.map((item, index) => <li key={`${item.status}-${item.createdAt}`} className="relative flex gap-4 pb-7 last:pb-0"><div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-emerald-600">{index === sorted.length - 1 ? <CheckCircle2 className="h-6 w-6 fill-emerald-50" /> : <Circle className="h-4 w-4 fill-slate-200 text-slate-300" />}</div><div><strong>{orderStatusLabels[item.status] || item.status}</strong>{item.notes && <p className="mt-1 text-sm text-muted-foreground">{item.notes}</p>}<time className="mt-1 block text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("ar-EG")}</time></div></li>)}</ol>;
}
