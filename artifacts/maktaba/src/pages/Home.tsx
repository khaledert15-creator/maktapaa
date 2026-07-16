import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { getGetHomepageContentQueryKey, useGetHomepageContent, type ProductSummary } from "@workspace/api-client-react";
import { BookOpen, GraduationCap, Library, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductSection } from "@/components/storefront/ProductSection";
import { Seo } from "@/components/storefront/Seo";
import { HeroBanner, type HeroSlide } from "@/components/storefront/HeroBanner";

export default function Home() {
  const { data, isLoading, isError, refetch } = useGetHomepageContent({
    query: {
      queryKey: getGetHomepageContentQueryKey(),
      staleTime: 0,
      refetchOnMount: "always",
      refetchInterval: 5_000,
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

      {banner && <div className="relative"><HeroBanner slide={banner as HeroSlide} />{banners.length > 1 && <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">{banners.map((item, index) => <button key={item.id} aria-label={`العرض ${index + 1}`} onClick={() => setBannerIndex(index)} className={`h-2.5 rounded-full transition-all ${index === bannerIndex ? "w-8 bg-sky-400" : "w-2.5 bg-white/60"}`} />)}</div>}</div>}

      <section className={`container relative z-10 mx-auto px-4 ${banner ? "-mt-5" : "pt-6"}`}><div className="grid grid-cols-2 gap-3 rounded-2xl border bg-white p-3 shadow-xl md:grid-cols-4">{[
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

      {!!data.publishers?.length && <section className="container mx-auto px-4 py-12"><div className="mb-6 text-center"><h2 className="text-3xl font-black">دور النشر</h2><p className="mt-2 text-muted-foreground">اختر دار النشر التي تثق بها</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">{data.publishers.slice(0, 12).map(publisher => <Link key={publisher.id} href={`/publisher/${publisher.id}-${slugify(publisher.nameAr)}`} className="flex min-h-24 items-center justify-center rounded-2xl border bg-white p-4 text-center font-extrabold transition hover:-translate-y-1 hover:border-secondary hover:shadow-lg">{publisher.logo ? <img src={publisher.logo} alt={publisher.nameAr} loading="lazy" decoding="async" width="220" height="100" className="max-h-14 max-w-full object-contain" /> : publisher.nameAr}</Link>)}</div></section>}
    </div>
  );
}

function ExploreStrip({ title, subtitle, items, compact = false }: { title: string; subtitle?: string; items: { id: number; label: string; href: string; icon: typeof BookOpen }[]; compact?: boolean }) {
  return <section className="container mx-auto px-4 py-10"><div className="mb-6"><h2 className="text-2xl font-black sm:text-3xl">{title}</h2>{subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}</div><div className={`grid gap-3 ${compact ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" : "grid-cols-2 md:grid-cols-4"}`}>{items.slice(0, compact ? 12 : 8).map(item => <Link key={item.id} href={item.href}><Card className="h-full rounded-2xl transition hover:-translate-y-1 hover:border-secondary hover:shadow-lg"><CardContent className={`flex items-center gap-3 ${compact ? "p-4" : "p-5 sm:p-6"}`}><div className="rounded-xl bg-sky-50 p-2.5 text-sky-600"><item.icon className="h-5 w-5" /></div><span className="font-extrabold">{item.label}</span></CardContent></Card></Link>)}</div></section>;
}

function HomeSkeleton() {
  return <div className="space-y-10 pb-12"><Skeleton className="h-[440px] w-full rounded-none" /><div className="container mx-auto grid grid-cols-2 gap-4 px-4 md:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div><div className="container mx-auto px-4"><Skeleton className="mb-6 h-9 w-64" /><div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-96 rounded-2xl" />)}</div></div></div>;
}

function slugify(value: string) { return value.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, ""); }
