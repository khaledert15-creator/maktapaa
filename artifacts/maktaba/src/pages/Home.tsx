import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { getGetHomepageContentQueryKey, useGetHomepageContent, type ProductSummary } from "@workspace/api-client-react";
import { BookOpen, GraduationCap, Library, PackageCheck, ShieldCheck, Truck, ChevronLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductSection } from "@/components/storefront/ProductSection";
import { Seo } from "@/components/storefront/Seo";

export default function Home() {
  const { data, isLoading, isError, refetch } = useGetHomepageContent({
    query: {
      queryKey: getGetHomepageContentQueryKey(),
      staleTime: 0,
      refetchOnMount: "always",
    },
  });
  const [bannerIndex, setBannerIndex] = useState(0);
  const banners = data?.banners || [];
  useEffect(() => {
    if (banners.length < 2) return;
    const timer = window.setInterval(() => setBannerIndex(index => (index + 1) % banners.length), 6000);
    return () => window.clearInterval(timer);
  }, [banners.length]);
  const banner = banners[bannerIndex];
  const recentlyViewed = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("maktaba_recently_viewed") || "[]") as ProductSummary[]; }
    catch { return []; }
  }, []);

  if (isLoading) return <HomeSkeleton />;
  if (isError || !data) return <div className="container mx-auto px-4 py-24 text-center"><BookOpen className="mx-auto mb-4 h-14 w-14 text-muted-foreground/40" /><h1 className="text-2xl font-black">تعذر تحميل المكتبة</h1><p className="mt-2 text-muted-foreground">تحقق من الاتصال ثم حاول مرة أخرى.</p><Button className="mt-6" onClick={() => refetch()}>إعادة المحاولة</Button></div>;

  return (
    <div className="overflow-hidden pb-10">
      <Seo title={data.settings?.seoTitle || `${data.settings?.storeNameAr || "مكتبة دوت كوم"} | كتبك الدراسية في مكان واحد`} description={data.settings?.seoDescription} />

      <section className="relative bg-gradient-to-l from-slate-950 via-slate-900 to-blue-950 text-white">
        {banner?.imageUrl && <img key={banner.id} src={banner.imageUrl} alt={banner.titleAr || "عرض مكتبة دوت كوم"} width="1600" height="650" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover opacity-35" />}
        <div className="absolute inset-0 bg-gradient-to-l from-slate-950/95 via-slate-900/75 to-transparent" />
        <div className="container relative mx-auto grid min-h-[440px] items-center gap-8 px-4 py-14 md:grid-cols-[1.1fr_.9fr] md:py-20">
          <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-3 duration-700">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-300/10 px-4 py-2 text-sm font-bold text-sky-200"><Sparkles className="h-4 w-4" /> اختيارات ذكية لكل طالب</div>
            <h1 className="text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">{banner?.titleAr || "كل كتبك الدراسية في مكان واحد"}</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-200">{banner?.subtitleAr || data.settings?.seoDescription || "اكتشف أحدث الكتب والمراجعات من دور النشر المفضلة لديك، مع شحن لكل محافظات مصر."}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="h-13 rounded-xl bg-sky-500 px-7 text-base text-white hover:bg-sky-400" asChild><Link href={banner?.linkUrl || "/catalog"}>ابدأ التصفح <ChevronLeft className="mr-2 h-5 w-5" /></Link></Button>
              <Button size="lg" variant="outline" className="h-13 rounded-xl border-white/30 bg-white/10 px-7 text-base text-white hover:bg-white/20" asChild><Link href="/offers">العروض الحالية</Link></Button>
            </div>
          </div>
          {!banner?.imageUrl && <div className="hidden justify-center md:flex"><div className="relative flex aspect-square w-80 items-center justify-center rounded-[4rem] border border-white/15 bg-white/5 backdrop-blur"><BookOpen className="h-32 w-32 text-sky-300" /><div className="absolute -right-6 top-10 rounded-2xl bg-amber-400 px-5 py-3 font-black text-slate-950 shadow-xl">أحدث الطبعات</div><div className="absolute -left-8 bottom-14 rounded-2xl bg-white px-5 py-3 font-black text-slate-950 shadow-xl">دفع عند الاستلام</div></div></div>}
        </div>
        {banners.length > 1 && <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">{banners.map((item, index) => <button key={item.id} aria-label={`العرض ${index + 1}`} onClick={() => setBannerIndex(index)} className={`h-2.5 rounded-full transition-all ${index === bannerIndex ? "w-8 bg-sky-400" : "w-2.5 bg-white/60"}`} />)}</div>}
      </section>

      <section className="container mx-auto -mt-5 px-4 relative z-10"><div className="grid grid-cols-2 gap-3 rounded-2xl border bg-white p-3 shadow-xl md:grid-cols-4">{[
        [Truck, "شحن لكل مصر", "تسعير واضح حسب منطقتك"], [ShieldCheck, "دفع عند الاستلام", "بدون دفع إلكتروني حاليًا"], [PackageCheck, "تغليف آمن", "كتبك تصل بحالة ممتازة"], [Library, "بيانات محدثة", "السعر والمخزون لحظيًا"],
      ].map(([Icon, title, text]) => <div key={String(title)} className="flex items-center gap-3 rounded-xl p-3 sm:p-4"><div className="rounded-xl bg-sky-50 p-2.5 text-sky-600"><Icon className="h-5 w-5" /></div><div><div className="text-sm font-extrabold sm:text-base">{String(title)}</div><div className="hidden text-xs text-muted-foreground sm:block">{String(text)}</div></div></div>)}</div></section>

      {!!data.stages?.length && <ExploreStrip title="اختَر مرحلتك الدراسية" subtitle="ابدأ من مرحلتك للوصول لأقرب كتاب" items={data.stages.map(stage => ({ id: stage.id, label: stage.nameAr, href: `/catalog?stageId=${stage.id}`, icon: GraduationCap }))} />}
      {!!data.grades?.length && <ExploreStrip title="الصفوف الدراسية" items={data.grades.map(grade => ({ id: grade.id, label: grade.nameAr, href: `/catalog?gradeId=${grade.id}`, icon: BookOpen }))} compact />}
      {!!data.subjects?.length && <ExploreStrip title="تصفح حسب المادة" items={data.subjects.map(subject => ({ id: subject.id, label: subject.nameAr, href: `/catalog?subjectId=${subject.id}`, icon: Library }))} compact />}

      <ProductSection title="الأكثر مبيعًا" subtitle="كتب اختارها طلاب كثيرون" products={data.bestSellers} href="/catalog?sortBy=best_selling" />
      <ProductSection title="وصل حديثًا" subtitle="أحدث الإضافات من لوحة الإدارة" products={data.newArrivals} href="/catalog?sortBy=newest" tone="soft" />
      <ProductSection title="عروض تستحق" subtitle="خصومات فعلية على الأسعار الحالية" products={data.offers} href="/offers" />
      <ProductSection title="مراجعات وامتحانات" products={data.revisionBooks} href="/catalog?isRevision=true" tone="soft" />
      <ProductSection title="باقات الكتب" products={data.bundles} href="/catalog?isBundle=true" />
      <ProductSection title="منتجات بشحن مجاني" products={data.freeShippingProducts} href="/catalog?freeShipping=true" tone="soft" />
      <ProductSection title="مقترحة لك" products={data.recommendedProducts?.length ? data.recommendedProducts : data.featuredProducts} href="/catalog?sortBy=recommended" />
      <ProductSection title="شاهدتها مؤخرًا" products={recentlyViewed} />

      {!!data.publishers?.length && <section className="container mx-auto px-4 py-12"><div className="mb-6 text-center"><h2 className="text-3xl font-black">دور النشر</h2><p className="mt-2 text-muted-foreground">اختر دار النشر التي تثق بها</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">{data.publishers.slice(0, 12).map(publisher => <Link key={publisher.id} href={`/catalog?publisherId=${publisher.id}`} className="flex min-h-24 items-center justify-center rounded-2xl border bg-white p-4 text-center font-extrabold transition hover:-translate-y-1 hover:border-secondary hover:shadow-lg">{publisher.logo ? <img src={publisher.logo} alt={publisher.nameAr} loading="lazy" className="max-h-14 max-w-full object-contain" /> : publisher.nameAr}</Link>)}</div></section>}
    </div>
  );
}

function ExploreStrip({ title, subtitle, items, compact = false }: { title: string; subtitle?: string; items: { id: number; label: string; href: string; icon: typeof BookOpen }[]; compact?: boolean }) {
  return <section className="container mx-auto px-4 py-10"><div className="mb-6"><h2 className="text-2xl font-black sm:text-3xl">{title}</h2>{subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}</div><div className={`grid gap-3 ${compact ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" : "grid-cols-2 md:grid-cols-4"}`}>{items.slice(0, compact ? 12 : 8).map(item => <Link key={item.id} href={item.href}><Card className="h-full rounded-2xl transition hover:-translate-y-1 hover:border-secondary hover:shadow-lg"><CardContent className={`flex items-center gap-3 ${compact ? "p-4" : "p-5 sm:p-6"}`}><div className="rounded-xl bg-sky-50 p-2.5 text-sky-600"><item.icon className="h-5 w-5" /></div><span className="font-extrabold">{item.label}</span></CardContent></Card></Link>)}</div></section>;
}

function HomeSkeleton() {
  return <div className="space-y-10 pb-12"><Skeleton className="h-[440px] w-full rounded-none" /><div className="container mx-auto grid grid-cols-2 gap-4 px-4 md:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div><div className="container mx-auto px-4"><Skeleton className="mb-6 h-9 w-64" /><div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-96 rounded-2xl" />)}</div></div></div>;
}
