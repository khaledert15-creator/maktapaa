import { resolvePreferredWhatsAppPhone, toWhatsAppInternational } from "@workspace/api-zod";

export type WhatsAppOrder = {
  orderNumber: string; customerName: string; mobile: string; primaryPhoneHasWhatsApp: boolean;
  altMobile?: string | null; alternatePhoneHasWhatsApp: boolean; preferredWhatsAppPhone?: string | null;
  governorateName: string; city: string; detailedAddress: string; landmark?: string | null;
  subtotal: string; discount: string; couponDiscount: string; shippingCost: string; total: string;
  freeShippingReason?: string | null; paymentMethod: string; deliveryNotes?: string | null; orderNotes?: string | null;
  status: string;
};
export type WhatsAppOrderItem = { nameAr: string; quantity: number; unitPrice: string; subtotal: string };

function money(value: string) { return `${Number(value).toFixed(2)} ج.م`; }

const statusLabels: Record<string, string> = { new: "جديد", awaiting_confirmation: "بانتظار التأكيد", confirmed: "مؤكد", preparing: "جاري التجهيز", ready_for_shipping: "جاهز للشحن", shipped: "تم الشحن", out_for_delivery: "خرج للتوصيل", delivered: "تم التسليم", delivery_failed: "تعذر التسليم", returned: "مرتجع", partially_returned: "مرتجع جزئيًا", cancelled: "ملغي" };

export function buildOrderWhatsAppLink(order: WhatsAppOrder, items: WhatsAppOrderItem[]) {
  const preferred = resolvePreferredWhatsAppPhone({ primaryPhone: order.mobile, primaryPhoneHasWhatsApp: order.primaryPhoneHasWhatsApp, alternatePhone: order.altMobile, alternatePhoneHasWhatsApp: order.alternatePhoneHasWhatsApp, preferredWhatsAppPhone: order.preferredWhatsAppPhone });
  const phone = preferred ? toWhatsAppInternational(preferred) : null;
  if (!phone) return null;
  const lines = [
    `مرحبًا أ/ ${order.customerName} 👋`,
    "",
    "معك مكتبة دوت كوم بخصوص طلبك رقم:",
    order.orderNumber,
    "",
    "ملخص الطلب:",
    ...items.map(item => `- ${item.nameAr} × ${item.quantity} — ${money(item.subtotal)}`),
    "",
    `قيمة المنتجات: ${money(order.subtotal)}`,
    `الشحن: ${money(order.shippingCost)}${order.freeShippingReason ? ` (${order.freeShippingReason})` : ""}`,
    `الخصم: ${money(String(Number(order.discount) + Number(order.couponDiscount)))}`,
    `الإجمالي: ${money(order.total)}`,
    "",
    `طريقة الدفع: ${order.paymentMethod === "cash_on_delivery" ? "الدفع عند الاستلام" : order.paymentMethod}`,
    `حالة الطلب: ${statusLabels[order.status] || order.status}`,
    "",
    "العنوان:",
    `${order.governorateName} - ${order.city}`,
    `${order.detailedAddress}${order.landmark ? `، علامة مميزة: ${order.landmark}` : ""}`,
    ...(order.deliveryNotes ? [`ملاحظات التوصيل: ${order.deliveryNotes}`] : []),
    ...(order.orderNotes ? [`ملاحظات الطلب: ${order.orderNotes}`] : []),
    "",
    "برجاء تأكيد البيانات، وشكرًا لاختيارك مكتبة دوت كوم.",
  ];
  const message = lines.join("\n");
  return { phone, message, url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}` };
}
