import { useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, BookOpen, CheckCircle2, MapPin, ShieldCheck, Truck, Wallet } from "lucide-react";
import { getGetCartQueryKey, getGetMyOrdersQueryKey, getListCustomerAddressesQueryKey, getListGovernorateCitiesQueryKey, useCreateOrder, useGetCart, useGetShippingQuote, useListCustomerAddresses, useListGovernorateCities, useListGovernorates } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Seo } from "@/components/storefront/Seo";
import { type ProductNotice, useProductNotice } from "@/components/storefront/ProductNoticeModal";
import { Checkbox } from "@/components/ui/checkbox";

const schema = z.object({
  customerName: z.string().trim().min(2, "اكتب الاسم الكامل"), mobile: z.string().regex(/^01[0125][0-9]{8}$/, "رقم موبايل مصري غير صحيح"), primaryPhoneHasWhatsApp: z.boolean(), altMobile: z.string().regex(/^01[0125][0-9]{8}$/, "رقم موبايل مصري غير صحيح").optional().or(z.literal("")), alternatePhoneHasWhatsApp: z.boolean(), preferredWhatsApp: z.enum(["primary", "alternate", "none"]),
  governorateId: z.coerce.number().int().positive("اختر المحافظة"), city: z.string().trim().min(2, "اختر أو اكتب المدينة"), detailedAddress: z.string().trim().min(5, "اكتب العنوان بالتفصيل"), landmark: z.string().optional(), deliveryNotes: z.string().optional(), orderNotes: z.string().optional(), paymentMethod: z.literal("cash_on_delivery"),
}).superRefine((values, context) => {
  if (values.preferredWhatsApp === "primary" && !values.primaryPhoneHasWhatsApp) context.addIssue({ code: "custom", path: ["preferredWhatsApp"], message: "حدد أن الرقم الأساسي عليه واتساب" });
  if (values.preferredWhatsApp === "alternate" && (!values.altMobile || !values.alternatePhoneHasWhatsApp)) context.addIssue({ code: "custom", path: ["preferredWhatsApp"], message: "اكتب الرقم البديل وحدد أنه عليه واتساب" });
});
type CheckoutValues = z.infer<typeof schema>;

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { customer } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const checkoutToken = useRef(globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const { data: cart, isLoading } = useGetCart();
  const { data: governorates } = useListGovernorates();
  const { data: addresses } = useListCustomerAddresses({ query: { queryKey: getListCustomerAddressesQueryKey(), enabled: Boolean(customer), retry: false } });
  const form = useForm<CheckoutValues>({ resolver: zodResolver(schema), defaultValues: { customerName: "", mobile: "", primaryPhoneHasWhatsApp: true, altMobile: "", alternatePhoneHasWhatsApp: false, preferredWhatsApp: "primary", city: "", detailedAddress: "", landmark: "", deliveryNotes: "", orderNotes: "", paymentMethod: "cash_on_delivery" } });
  const governorateId = form.watch("governorateId");
  const city = form.watch("city");
  const { data: cities } = useListGovernorateCities(governorateId || 0, { query: { queryKey: getListGovernorateCitiesQueryKey(governorateId || 0), enabled: Boolean(governorateId) } });
  const quote = useGetShippingQuote();
  const noticeProduct = (cart?.items as unknown as ProductNotice[] | undefined)?.find(item => item.customerNoticeTrigger === "checkout" || item.customerNoticeTrigger === "first_interaction");
  const checkoutNotice = useProductNotice(noticeProduct);

  useEffect(() => { if (customer) { form.setValue("customerName", customer.name); form.setValue("mobile", customer.primaryPhone || customer.mobile); form.setValue("primaryPhoneHasWhatsApp", customer.primaryPhoneHasWhatsApp); form.setValue("altMobile", customer.alternatePhone || ""); form.setValue("alternatePhoneHasWhatsApp", customer.alternatePhoneHasWhatsApp); form.setValue("preferredWhatsApp", customer.preferredWhatsAppPhone === customer.alternatePhone ? "alternate" : customer.preferredWhatsAppPhone ? "primary" : "none"); } }, [customer, form]);
  useEffect(() => {
    const address = addresses?.find(item => item.isDefault);
    if (address && !form.getValues("detailedAddress")) {
      if (address.governorateId) form.setValue("governorateId", address.governorateId);
      form.setValue("city", address.city); form.setValue("detailedAddress", address.detailedAddress); form.setValue("landmark", address.landmark || "");
      if (address.primaryPhone) form.setValue("mobile", address.primaryPhone); form.setValue("primaryPhoneHasWhatsApp", address.primaryPhoneHasWhatsApp ?? true); form.setValue("altMobile", address.alternatePhone || ""); form.setValue("alternatePhoneHasWhatsApp", address.alternatePhoneHasWhatsApp ?? false); form.setValue("preferredWhatsApp", address.preferredWhatsAppPhone === address.alternatePhone ? "alternate" : address.preferredWhatsAppPhone ? "primary" : "none");
    }
  }, [addresses, form]);
  useEffect(() => {
    if (!governorateId || !cart?.items.length) return;
    const timer = window.setTimeout(() => quote.mutate({ data: { governorateId, city: city || undefined, couponCode: cart.couponCode || undefined } }), 250);
    return () => window.clearTimeout(timer);
  }, [governorateId, city, cart?.items.length, cart?.couponCode]);

  const createOrder = useCreateOrder({ mutation: { onSuccess: order => { queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetMyOrdersQueryKey() }); setLocation(`/order-confirmation/${order.orderNumber}`); }, onError: () => toast({ title: "لم يتم إنشاء الطلب", description: "راجع المخزون وبيانات التوصيل ثم حاول مرة أخرى. لن يتم تكرار الطلب عند إعادة المحاولة.", variant: "destructive" }) } });
  const submit = (values: CheckoutValues) => { if (!cart?.items.length || !quote.data) { toast({ title: "انتظر اكتمال حساب الشحن", variant: "destructive" }); return; } const { preferredWhatsApp, ...orderValues } = values; checkoutNotice.request("checkout", () => createOrder.mutate({ data: { ...orderValues, altMobile: values.altMobile || null, preferredWhatsAppPhone: preferredWhatsApp === "primary" ? values.mobile : preferredWhatsApp === "alternate" ? values.altMobile || null : null, checkoutToken: checkoutToken.current, couponCode: cart.couponCode || null } })); };
  const applyAddress = (id: number) => { const address = addresses?.find(item => item.id === id); if (!address) return; if (address.governorateId) form.setValue("governorateId", address.governorateId); form.setValue("city", address.city); form.setValue("detailedAddress", address.detailedAddress); form.setValue("landmark", address.landmark || ""); if (address.primaryPhone) form.setValue("mobile", address.primaryPhone); form.setValue("primaryPhoneHasWhatsApp", address.primaryPhoneHasWhatsApp ?? true); form.setValue("altMobile", address.alternatePhone || ""); form.setValue("alternatePhoneHasWhatsApp", address.alternatePhoneHasWhatsApp ?? false); form.setValue("preferredWhatsApp", address.preferredWhatsAppPhone === address.alternatePhone ? "alternate" : address.preferredWhatsAppPhone ? "primary" : "none"); };

  if (isLoading) return <div className="container mx-auto grid gap-8 px-4 py-10 lg:grid-cols-3"><Skeleton className="h-[650px] rounded-3xl lg:col-span-2" /><Skeleton className="h-[500px] rounded-3xl" /></div>;
  if (!cart?.items.length) return <div className="container mx-auto px-4 py-24 text-center"><BookOpen className="mx-auto mb-4 h-16 w-16 text-muted-foreground/30" /><h1 className="text-2xl font-black">سلتك فارغة</h1><Button className="mt-6" asChild><Link href="/catalog">ابدأ التسوق</Link></Button></div>;
  const finalTotal = cart.subtotal - (cart.couponDiscount || 0) + (quote.data?.finalCost || 0);

  return <div className="min-h-screen bg-slate-50/70 py-8"><Seo title="إتمام الطلب | مكتبة دوت كوم" description="أدخل بيانات التوصيل وأكد طلبك بالدفع عند الاستلام." /><div className="container mx-auto px-4"><div className="mb-7 flex items-center gap-3"><Button variant="ghost" size="icon" asChild><Link href="/cart" aria-label="العودة إلى السلة" title="العودة إلى السلة"><ArrowRight className="h-5 w-5" /></Link></Button><div><h1 className="text-3xl font-black">إتمام الطلب</h1><p className="text-sm text-muted-foreground">خطوة واحدة وتبدأ المكتبة تجهيز كتبك</p></div></div>
    <Form {...form}><form onSubmit={form.handleSubmit(submit)} className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        {addresses?.length ? <Card className="rounded-2xl"><CardHeader><CardTitle className="text-lg">استخدم عنوانًا محفوظًا</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-3">{addresses.map(address => <button type="button" key={address.id} onClick={() => applyAddress(address.id)} className="rounded-xl border p-3 text-right text-sm transition hover:border-secondary hover:bg-sky-50"><strong className="block">{address.governorate} - {address.city}</strong><span className="text-muted-foreground">{address.detailedAddress}</span>{address.isDefault && <span className="mr-2 text-xs font-bold text-secondary">الافتراضي</span>}</button>)}</CardContent></Card> : null}
        <Card className="overflow-hidden rounded-2xl"><CardHeader className="border-b bg-white"><CardTitle className="flex gap-2"><MapPin className="h-5 w-5 text-secondary" /> بيانات الاستلام</CardTitle></CardHeader><CardContent className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
          <Field form={form} name="customerName" label="الاسم الكامل *" placeholder="الاسم ثلاثي" /><Field form={form} name="mobile" label="رقم الموبايل الأساسي *" placeholder="01xxxxxxxxx" dir="ltr" /><FormField control={form.control} name="primaryPhoneHasWhatsApp" render={({ field }) => <FormItem className="flex items-center gap-3 rounded-xl border p-3"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">الرقم الأساسي عليه واتساب</FormLabel></FormItem>} /><Field form={form} name="altMobile" label="رقم بديل" placeholder="اختياري" dir="ltr" /><FormField control={form.control} name="alternatePhoneHasWhatsApp" render={({ field }) => <FormItem className="flex items-center gap-3 rounded-xl border p-3"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">الرقم البديل عليه واتساب</FormLabel></FormItem>} /><FormField control={form.control} name="preferredWhatsApp" render={({ field }) => <FormItem><FormLabel>رقم واتساب المفضل</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="primary">الرقم الأساسي</SelectItem><SelectItem value="alternate">الرقم البديل</SelectItem><SelectItem value="none">لا يوجد</SelectItem></SelectContent></Select><FormMessage /></FormItem>} />
          <FormField control={form.control} name="governorateId" render={({ field }) => <FormItem><FormLabel>المحافظة *</FormLabel><Select value={field.value ? String(field.value) : ""} onValueChange={value => { field.onChange(Number(value)); form.setValue("city", ""); }}><FormControl><SelectTrigger><SelectValue placeholder="اختر المحافظة" /></SelectTrigger></FormControl><SelectContent>{governorates?.filter(item => item.isActive).map(item => <SelectItem key={item.id} value={String(item.id)}>{item.nameAr}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
          <FormField control={form.control} name="city" render={({ field }) => <FormItem><FormLabel>المدينة / الحي *</FormLabel>{cities?.length ? <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="اختر المدينة" /></SelectTrigger></FormControl><SelectContent>{cities.map(item => <SelectItem key={item.id} value={item.nameAr}>{item.nameAr}{item.surcharge > 0 ? ` (+${item.surcharge} ج.م)` : ""}</SelectItem>)}</SelectContent></Select> : <FormControl><Input placeholder="اكتب المدينة أو الحي" {...field} /></FormControl>}<FormMessage /></FormItem>} />
          <div className="sm:col-span-2"><Field form={form} name="detailedAddress" label="العنوان بالتفصيل *" placeholder="الشارع، رقم العقار، الدور، الشقة" /></div><Field form={form} name="landmark" label="علامة مميزة" placeholder="بجوار..." /><Field form={form} name="deliveryNotes" label="ملاحظات التوصيل" placeholder="الاتصال قبل الوصول..." />
        </CardContent></Card>
        <Card className="rounded-2xl"><CardHeader className="border-b"><CardTitle className="flex gap-2"><Wallet className="h-5 w-5 text-secondary" /> طريقة الدفع</CardTitle></CardHeader><CardContent className="p-6"><div className="flex items-center gap-4 rounded-2xl border-2 border-secondary bg-sky-50 p-4"><div className="rounded-full bg-secondary p-2 text-white"><CheckCircle2 className="h-5 w-5" /></div><div><strong>الدفع نقدًا عند الاستلام</strong><p className="text-sm text-muted-foreground">الطريقة الوحيدة المفعلة حاليًا. فوري غير مفعل.</p></div></div><div className="mt-5"><FormField control={form.control} name="orderNotes" render={({ field }) => <FormItem><FormLabel>ملاحظات على الطلب</FormLabel><FormControl><Textarea rows={3} placeholder="أي تفاصيل أخرى..." {...field} /></FormControl><FormMessage /></FormItem>} /></div></CardContent></Card>
      </div>
      <aside><Card className="sticky top-40 overflow-hidden rounded-2xl shadow-lg"><CardHeader className="border-b"><CardTitle>ملخص الطلب</CardTitle></CardHeader><CardContent className="p-0"><div className="max-h-72 space-y-4 overflow-y-auto p-5">{cart.items.map(item => <div key={item.productId} className="flex gap-3"><div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">{item.coverImage ? <img src={item.coverImage} alt={item.nameAr} className="h-full w-full object-cover" /> : <BookOpen className="h-full w-full p-3 text-muted-foreground/30" />}</div><div className="min-w-0 flex-1"><strong className="line-clamp-2 text-sm">{item.nameAr}</strong><span className="text-xs text-muted-foreground">{item.quantity} × {item.unitPrice} ج.م</span></div><strong className="text-sm">{item.subtotal} ج.م</strong></div>)}</div><div className="space-y-3 border-t bg-slate-50 p-5 text-sm"><Summary label="المنتجات" value={`${cart.subtotal} ج.م`} />{Boolean(cart.couponDiscount) && <Summary label={`الكوبون ${cart.couponCode || ""}`} value={`-${cart.couponDiscount} ج.م`} green />}<Summary label="أساس الشحن" value={quote.data ? `${quote.data.baseCost} ج.م` : "—"} /><Summary label="إضافة المنطقة" value={quote.data ? `${quote.data.surcharge} ج.م` : "—"} />{quote.data && quote.data.discount > 0 && <Summary label="خصم الشحن" value={`-${quote.data.discount} ج.م`} green />}<Summary label="الشحن النهائي" value={quote.data ? (quote.data.finalCost === 0 ? "مجانًا" : `${quote.data.finalCost} ج.م`) : governorateId ? "جاري الحساب..." : "اختر المحافظة"} />{quote.data?.freeShippingReason && <p className="rounded-lg bg-emerald-50 p-2 text-xs font-bold text-emerald-700">{quote.data.freeShippingReason}</p>}{quote.data && <p className="flex gap-2 text-xs text-muted-foreground"><Truck className="h-4 w-4" /> {quote.data.estimatedDeliveryText || `${quote.data.estimatedDays} أيام عمل تقريبًا`}</p>}<div className="flex items-end justify-between border-t pt-4"><strong className="text-lg">الإجمالي</strong><span className="text-3xl font-black text-primary">{finalTotal.toLocaleString("ar-EG")} ج.م</span></div></div><div className="p-5"><Button type="submit" disabled={createOrder.isPending || quote.isPending || !quote.data} className="h-14 w-full rounded-xl text-lg">{createOrder.isPending ? "جاري تسجيل الطلب..." : "تأكيد الطلب"}</Button><p className="mt-3 flex items-center justify-center gap-1 text-center text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" /> الطلب محمي من التكرار عند الضغط أكثر من مرة</p></div></CardContent></Card></aside>
    </form></Form>
    {checkoutNotice.modal}
  </div></div>;
}

function Field({ form, name, label, placeholder, dir }: { form: ReturnType<typeof useForm<CheckoutValues>>; name: keyof CheckoutValues; label: string; placeholder: string; dir?: "ltr" | "rtl" }) {
  return <FormField control={form.control} name={name} render={({ field }) => <FormItem><FormLabel>{label}</FormLabel><FormControl><Input placeholder={placeholder} dir={dir} value={String(field.value ?? "")} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} /></FormControl><FormMessage /></FormItem>} />;
}
function Summary({ label, value, green = false }: { label: string; value: string; green?: boolean }) { return <div className={`flex justify-between ${green ? "font-bold text-emerald-700" : ""}`}><span>{label}</span><span>{value}</span></div>; }
