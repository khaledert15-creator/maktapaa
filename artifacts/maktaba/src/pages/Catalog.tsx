import { useEffect, useState } from "react";
import { getListProductsQueryKey, useListCategories, useListGrades, useListProducts, useListPublishers, useListStages, useListSubjects, type ListProductsParams } from "@workspace/api-client-react";
import { BookOpen, Filter, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Seo } from "@/components/storefront/Seo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

type Filters = Omit<ListProductsParams, "page" | "limit">;
const initialParams = new URLSearchParams(window.location.search);
const numberParam = (name: string) => initialParams.get(name) ? Number(initialParams.get(name)) : undefined;
const boolParam = (name: string) => initialParams.get(name) === "true" ? true : undefined;

export default function Catalog() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    q: initialParams.get("q") || undefined,
    stageId: numberParam("stageId"), gradeId: numberParam("gradeId"), subjectId: numberParam("subjectId"), publisherId: numberParam("publisherId"), categoryId: numberParam("categoryId"),
    educationType: initialParams.get("educationType") || undefined, author: initialParams.get("author") || undefined, schoolYear: initialParams.get("schoolYear") || undefined,
    minPrice: numberParam("minPrice"), maxPrice: numberParam("maxPrice"), inStock: boolParam("inStock"), hasDiscount: boolParam("hasDiscount"), freeShipping: boolParam("freeShipping"),
    isRevision: boolParam("isRevision"), isBundle: boolParam("isBundle"), isOffer: boolParam("isOffer"), sortBy: (initialParams.get("sortBy") as Filters["sortBy"]) || "newest",
  });
  const [searchText, setSearchText] = useState(filters.q || "");
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => { setFilters(current => ({ ...current, [key]: value || undefined })); setPage(1); };
  const productParams = { page, limit: 24, ...filters };
  const { data, isLoading, isError, refetch } = useListProducts(productParams, { query: { queryKey: getListProductsQueryKey(productParams), placeholderData: previous => previous } });
  const { data: stages } = useListStages();
  const { data: grades } = useListGrades(filters.stageId ? { stageId: filters.stageId } : undefined);
  const { data: subjects } = useListSubjects();
  const { data: publishers } = useListPublishers();
  const { data: categories } = useListCategories();

  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== "") params.set(key, String(value)); });
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }, [filters]);
  const reset = () => { setFilters({ sortBy: "newest" }); setSearchText(""); setPage(1); };
  const activeCount = Object.entries(filters).filter(([key, value]) => key !== "sortBy" && value !== undefined && value !== "").length;

  const filterPanel = <div className="space-y-7">
    <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-black"><SlidersHorizontal className="h-5 w-5" /> تصفية النتائج</h2><Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="ml-1 h-3.5 w-3.5" /> مسح</Button></div>
    <FilterSelect label="المرحلة" value={filters.stageId} items={stages} onChange={value => { update("stageId", value); update("gradeId", undefined); }} />
    <FilterSelect label="الصف" value={filters.gradeId} items={grades} onChange={value => update("gradeId", value)} />
    <FilterSelect label="المادة" value={filters.subjectId} items={subjects} onChange={value => update("subjectId", value)} />
    <FilterSelect label="دار النشر" value={filters.publisherId} items={publishers} onChange={value => update("publisherId", value)} />
    <FilterSelect label="التصنيف" value={filters.categoryId} items={categories} onChange={value => update("categoryId", value)} />
    <div><Label className="mb-2 block font-bold">نوع التعليم</Label><Select value={filters.educationType || "all"} onValueChange={value => update("educationType", value === "all" ? undefined : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">الكل</SelectItem>{["عربي", "لغات", "أزهر"].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
    <div className="grid grid-cols-2 gap-2"><div><Label className="mb-2 block text-xs">أقل سعر</Label><Input type="number" min="0" value={filters.minPrice ?? ""} onChange={event => update("minPrice", event.target.value ? Number(event.target.value) : undefined)} /></div><div><Label className="mb-2 block text-xs">أعلى سعر</Label><Input type="number" min="0" value={filters.maxPrice ?? ""} onChange={event => update("maxPrice", event.target.value ? Number(event.target.value) : undefined)} /></div></div>
    <div><Label className="mb-2 block font-bold">المؤلف / المدرس</Label><Input value={filters.author || ""} onChange={event => update("author", event.target.value)} placeholder="اسم المؤلف أو المدرس" /></div>
    <div><Label className="mb-2 block font-bold">العام الدراسي</Label><Input value={filters.schoolYear || ""} onChange={event => update("schoolYear", event.target.value)} placeholder="مثال: 2026/2027" /></div>
    <div className="space-y-3">{[
      ["inStock", "متوفر في المخزون"], ["hasDiscount", "عليه خصم"], ["freeShipping", "شحن مجاني"], ["isRevision", "كتب المراجعة"], ["isBundle", "باقات كتب"], ["isOffer", "العروض"],
    ].map(([key, label]) => <div key={key} className="flex items-center gap-2"><Checkbox id={`filter-${key}`} checked={Boolean(filters[key as keyof Filters])} onCheckedChange={checked => update(key as keyof Filters, (checked ? true : undefined) as never)} /><Label htmlFor={`filter-${key}`} className="cursor-pointer">{label}</Label></div>)}</div>
  </div>;

  return <div className="container mx-auto px-4 py-8 sm:py-10">
    <Seo title="تصفح الكتب | مكتبة دوت كوم" description="ابحث وفلتر الكتب حسب المرحلة والصف والمادة والناشر والسعر والتوفر." />
    <div className="mb-7 rounded-3xl bg-gradient-to-l from-slate-950 to-blue-950 p-6 text-white sm:p-8"><h1 className="text-3xl font-black sm:text-4xl">كل الكتب في مكتبتك</h1><p className="mt-2 text-slate-300">فلترة دقيقة وبيانات سعر ومخزون مباشرة من إدارة المكتبة</p><form onSubmit={event => { event.preventDefault(); update("q", searchText.trim() || undefined); }} className="relative mt-6 max-w-2xl"><Input value={searchText} onChange={event => setSearchText(event.target.value)} className="h-12 rounded-2xl border-white/10 bg-white pr-4 pl-14 text-slate-950" placeholder="ابحث داخل النتائج..." /><Button type="submit" size="icon" className="absolute left-1.5 top-1.5 h-9 w-10 rounded-xl bg-secondary"><Search className="h-4 w-4" /></Button></form></div>
    <div className="grid gap-8 md:grid-cols-[260px_1fr]">
      <aside className="hidden md:block"><div className="sticky top-40 rounded-2xl border bg-white p-5">{filterPanel}</div></aside>
      <main className="min-w-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">{data ? `${data.total.toLocaleString("ar-EG")} منتج` : "المنتجات"}</h2>{activeCount > 0 && <p className="mt-1 text-xs text-muted-foreground">{activeCount} خيارات تصفية مفعّلة</p>}</div><div className="flex gap-2"><Sheet><SheetTrigger asChild><Button variant="outline" className="md:hidden"><Filter className="ml-2 h-4 w-4" /> التصفية {activeCount > 0 && <span className="mr-2 rounded-full bg-secondary px-2 text-xs text-white">{activeCount}</span>}</Button></SheetTrigger><SheetContent side="right" className="w-[90vw] overflow-y-auto sm:w-96"><SheetHeader><SheetTitle className="sr-only">تصفية المنتجات</SheetTitle></SheetHeader><div className="py-6">{filterPanel}</div></SheetContent></Sheet><Select value={filters.sortBy || "newest"} onValueChange={value => update("sortBy", value as Filters["sortBy"])}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="newest">الأحدث</SelectItem><SelectItem value="best_selling">الأكثر مبيعًا</SelectItem><SelectItem value="price_asc">الأقل سعرًا</SelectItem><SelectItem value="price_desc">الأعلى سعرًا</SelectItem><SelectItem value="discount">أكبر خصم</SelectItem><SelectItem value="recommended">المقترحة</SelectItem></SelectContent></Select></div></div>
        {isLoading ? <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-96 rounded-2xl" />)}</div> : isError ? <EmptyState icon={BookOpen} title="تعذر تحميل المنتجات" text="حاول مرة أخرى بعد لحظات" action={() => refetch()} actionLabel="إعادة المحاولة" /> : !data?.items.length ? <EmptyState icon={Search} title="لا توجد نتائج مطابقة" text="جرّب إزالة بعض خيارات التصفية أو البحث بكلمات أخرى" action={reset} actionLabel="عرض كل الكتب" /> : <><div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">{data.items.map(product => <ProductCard key={product.id} product={product} />)}</div>{data.total > data.limit && <div className="mt-10 flex items-center justify-center gap-3"><Button variant="outline" disabled={page <= 1} onClick={() => { setPage(value => value - 1); window.scrollTo({ top: 260, behavior: "smooth" }); }}>السابق</Button><span className="rounded-xl bg-muted px-4 py-2 text-sm font-bold">{page} / {Math.ceil(data.total / data.limit)}</span><Button variant="outline" disabled={page >= Math.ceil(data.total / data.limit)} onClick={() => { setPage(value => value + 1); window.scrollTo({ top: 260, behavior: "smooth" }); }}>التالي</Button></div>}</>}
      </main>
    </div>
  </div>;
}

function FilterSelect({ label, value, items, onChange }: { label: string; value?: number; items?: { id: number; nameAr: string }[]; onChange: (value?: number) => void }) {
  return <div><Label className="mb-2 block font-bold">{label}</Label><Select value={value ? String(value) : "all"} onValueChange={next => onChange(next === "all" ? undefined : Number(next))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">الكل</SelectItem>{items?.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.nameAr}</SelectItem>)}</SelectContent></Select></div>;
}

function EmptyState({ icon: Icon, title, text, action, actionLabel }: { icon: typeof BookOpen; title: string; text: string; action: () => void; actionLabel: string }) {
  return <div className="rounded-3xl border border-dashed bg-muted/20 px-5 py-24 text-center"><Icon className="mx-auto mb-4 h-14 w-14 text-muted-foreground/30" /><h3 className="text-xl font-black">{title}</h3><p className="mt-2 text-muted-foreground">{text}</p><Button className="mt-6" variant="outline" onClick={action}>{actionLabel}</Button></div>;
}
