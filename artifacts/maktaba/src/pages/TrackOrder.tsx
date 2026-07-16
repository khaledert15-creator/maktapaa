import { FormEvent, useState } from "react";
import { PackageSearch, Search } from "lucide-react";
import { getTrackOrderQueryKey, useTrackOrder } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OrderTimeline, orderStatusLabels } from "@/components/storefront/OrderTimeline";
import { Seo } from "@/components/storefront/Seo";

export default function TrackOrder() {
  const url = new URLSearchParams(window.location.search);
  const [orderNumber, setOrderNumber] = useState(url.get("orderNumber") || "");
  const [mobile, setMobile] = useState(url.get("mobile") || "");
  const [submitted, setSubmitted] = useState(Boolean(url.get("orderNumber") && url.get("mobile")));
  const trackParams = { orderNumber, mobile };
  const tracking = useTrackOrder(trackParams, { query: { queryKey: getTrackOrderQueryKey(trackParams), enabled: submitted && Boolean(orderNumber && mobile), retry: false } });
  const submit = (event: FormEvent) => { event.preventDefault(); setSubmitted(true); const params = new URLSearchParams({ orderNumber, mobile }); window.history.replaceState(null, "", `/track?${params}`); tracking.refetch(); };
  return <div className="container mx-auto max-w-3xl px-4 py-12"><Seo title="تتبع طلبك | مكتبة دوت كوم" description="تابع حالة طلبك باستخدام رقم الطلب ورقم الهاتف." /><div className="text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-100 text-sky-600"><PackageSearch className="h-8 w-8" /></div><h1 className="mt-5 text-3xl font-black">أين وصل طلبك؟</h1><p className="mt-2 text-muted-foreground">اكتب رقم الطلب ورقم الموبايل المستخدم وقت الشراء</p></div><Card className="mt-8 rounded-3xl"><CardContent className="p-6 sm:p-8"><form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]"><div><Label htmlFor="order-number" className="mb-2 block">رقم الطلب</Label><Input id="order-number" value={orderNumber} onChange={event => { setOrderNumber(event.target.value); setSubmitted(false); }} placeholder="MK..." dir="ltr" required /></div><div><Label htmlFor="track-mobile" className="mb-2 block">رقم الموبايل</Label><Input id="track-mobile" value={mobile} onChange={event => { setMobile(event.target.value); setSubmitted(false); }} placeholder="01xxxxxxxxx" dir="ltr" required /></div><Button type="submit" className="self-end"><Search className="ml-2 h-4 w-4" /> تتبع</Button></form></CardContent></Card>
    {tracking.isLoading && <Card className="mt-6 animate-pulse rounded-3xl"><CardContent className="h-72 p-8" /></Card>}
    {submitted && tracking.isError && <div className="mt-6 rounded-3xl border border-dashed p-12 text-center"><PackageSearch className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" /><h2 className="text-xl font-black">لم نعثر على الطلب</h2><p className="mt-2 text-muted-foreground">تأكد من رقم الطلب ورقم الموبايل كما كُتبا عند الشراء.</p></div>}
    {tracking.data && <Card className="mt-6 overflow-hidden rounded-3xl"><CardHeader className="bg-slate-950 text-white"><CardTitle className="flex flex-wrap justify-between gap-3"><span dir="ltr">{tracking.data.orderNumber}</span><span className="text-sky-300">{orderStatusLabels[tracking.data.status] || tracking.data.status}</span></CardTitle></CardHeader><CardContent className="p-7"><OrderTimeline history={tracking.data.statusHistory} />{tracking.data.trackingNumber && <p className="mt-6 rounded-xl bg-slate-50 p-4"><strong>رقم الشحنة:</strong> <span dir="ltr">{tracking.data.trackingNumber}</span>{tracking.data.shippingCompany && ` — ${tracking.data.shippingCompany}`}</p>}</CardContent></Card>}
  </div>;
}
