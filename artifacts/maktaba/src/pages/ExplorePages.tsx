import { Link } from "wouter";
import { BookOpen, Building2, GraduationCap, Library } from "lucide-react";
import { useListCategories, useListGrades, useListProducts, useListPublishers, useListStages, useListSubjects } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Seo } from "@/components/storefront/Seo";
import { Skeleton } from "@/components/ui/skeleton";

export function OffersPage() {
  const { data, isLoading } = useListProducts({ isOffer: true, hasDiscount: true, sortBy: "discount", limit: 48 });
  return <Listing title="العروض والخصومات" subtitle="كل الأسعار المعروضة محدثة من لوحة الإدارة" icon={BookOpen}>{isLoading ? <GridSkeleton /> : data?.items.length ? <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{data.items.map(product => <ProductCard key={product.id} product={product} />)}</div> : <Empty text="لا توجد عروض فعالة حاليًا" />}</Listing>;
}
export function PublishersPage() {
  const { data, isLoading } = useListPublishers();
  return <Listing title="دور النشر" subtitle="تصفح كتب الناشر المفضل لديك" icon={Building2}>{isLoading ? <GridSkeleton short /> : data?.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{data.map(item => <Link key={item.id} href={`/publisher/${item.id}-${slugify(item.nameAr)}`}><Card className="h-full rounded-2xl transition hover:-translate-y-1 hover:border-secondary hover:shadow-lg"><CardContent className="flex min-h-36 flex-col items-center justify-center gap-4 p-5 text-center">{item.logo ? <img src={item.logo} alt={item.nameAr} loading="lazy" decoding="async" className="max-h-16 max-w-full object-contain" /> : <Building2 className="h-10 w-10 text-secondary" />}<strong>{item.nameAr}</strong></CardContent></Card></Link>)}</div> : <Empty text="لم تُضف دور نشر بعد" />}</Listing>;
}
export function CategoriesPage() {
  const { data, isLoading } = useListCategories();
  return <Listing title="تصنيفات المكتبة" subtitle="كل قسم يقودك للكتب المرتبطة به" icon={Library}>{isLoading ? <GridSkeleton short /> : data?.length ? <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">{data.map(item => <Link key={item.id} href={`/category/${item.slug}`}><Card className="h-full overflow-hidden rounded-2xl transition hover:-translate-y-1 hover:border-secondary hover:shadow-lg">{item.image && <img src={item.image} alt={item.nameAr} loading="lazy" decoding="async" width="600" height="300" className="h-36 w-full object-cover" />}<CardContent className="p-5"><strong className="text-lg">{item.nameAr}</strong><p className="mt-1 text-sm text-muted-foreground">{item.productCount || 0} منتج</p></CardContent></Card></Link>)}</div> : <Empty text="لم تُضف تصنيفات بعد" />}</Listing>;
}
export function StagesPage() {
  const { data: stages, isLoading } = useListStages();
  const { data: grades } = useListGrades();
  const { data: subjects } = useListSubjects();
  return <Listing title="المراحل والصفوف الدراسية" subtitle="اختر المرحلة أو الصف أو المادة" icon={GraduationCap}>{isLoading ? <GridSkeleton short /> : <div className="space-y-10"><div><h2 className="mb-4 text-xl font-black">المراحل</h2><div className="grid grid-cols-2 gap-4 md:grid-cols-4">{stages?.map(item => <Tile key={item.id} href={`/catalog?stageId=${item.id}`} icon={GraduationCap} label={item.nameAr} />)}</div></div><div><h2 className="mb-4 text-xl font-black">الصفوف</h2><div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">{grades?.map(item => <Tile key={item.id} href={`/catalog?gradeId=${item.id}`} icon={BookOpen} label={item.nameAr} />)}</div></div><div><h2 className="mb-4 text-xl font-black">المواد</h2><div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">{subjects?.map(item => <Tile key={item.id} href={`/catalog?subjectId=${item.id}`} icon={Library} label={item.nameAr} />)}</div></div></div>}</Listing>;
}
function Listing({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: typeof BookOpen; children: React.ReactNode }) { return <div className="container mx-auto px-4 py-10"><Seo title={`${title} | مكتبة دوت كوم`} description={subtitle} /><div className="mb-9 rounded-3xl bg-gradient-to-l from-slate-950 to-blue-950 p-8 text-white"><Icon className="mb-4 h-10 w-10 text-sky-300" /><h1 className="text-3xl font-black sm:text-4xl">{title}</h1><p className="mt-2 text-slate-300">{subtitle}</p></div>{children}</div>; }
function Tile({ href, icon: Icon, label }: { href: string; icon: typeof BookOpen; label: string }) { return <Link href={href}><Card className="h-full rounded-2xl transition hover:border-secondary hover:shadow-lg"><CardContent className="flex flex-col items-center gap-3 p-5 text-center"><div className="rounded-xl bg-sky-50 p-3 text-sky-600"><Icon className="h-6 w-6" /></div><strong>{label}</strong></CardContent></Card></Link>; }
function Empty({ text }: { text: string }) { return <div className="rounded-3xl border border-dashed py-20 text-center text-muted-foreground">{text}</div>; }
function GridSkeleton({ short = false }: { short?: boolean }) { return <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[1, 2, 3, 4, 5, 6, 7, 8].map(item => <Skeleton key={item} className={`${short ? "h-36" : "h-96"} rounded-2xl`} />)}</div>; }
function slugify(value: string) { return value.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, ""); }
