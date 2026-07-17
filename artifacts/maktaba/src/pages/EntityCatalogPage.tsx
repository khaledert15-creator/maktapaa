import { useParams } from "wouter";
import { BookOpen } from "lucide-react";
import { useListCategories, useListProducts, useListPublishers } from "@workspace/api-client-react";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Seo } from "@/components/storefront/Seo";
import { Skeleton } from "@/components/ui/skeleton";

function Products({ title, description, categoryId, publisherId }: { title: string; description: string; categoryId?: number; publisherId?: number }) {
  const { data, isLoading } = useListProducts({ categoryId, publisherId, limit: 48, sortBy: "newest" });
  return <div className="container mx-auto px-4 py-10"><Seo title={`${title} | مكتبة دوت كوم`} description={description} /><div className="mb-8 rounded-3xl bg-gradient-to-l from-slate-950 to-blue-950 p-8 text-white"><h1 className="text-3xl font-black sm:text-4xl">{title}</h1><p className="mt-3 text-slate-300">{description}</p></div>{isLoading ? <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Skeleton className="h-96 rounded-2xl" key={index} />)}</div> : data?.items.length ? <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{data.items.map(product => <ProductCard product={product} key={product.id} />)}</div> : <div className="rounded-3xl border border-dashed py-20 text-center"><BookOpen className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" /><p>لا توجد كتب متاحة هنا حاليًا.</p></div>}</div>;
}

export function CategoryCatalogPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: categories } = useListCategories();
  const category = categories?.find(item => item.slug === slug);
  if (!category) return <div className="container mx-auto px-4 py-24 text-center">جاري تحميل التصنيف...</div>;
  return <Products title={category.nameAr} description={`تصفح كتب ${category.nameAr} المتاحة والأسعار والمخزون المحدث.`} categoryId={category.id} />;
}

export function PublisherCatalogPage() {
  const { reference } = useParams<{ reference: string }>();
  const id = Number(reference?.split("-")[0]);
  const { data: publishers } = useListPublishers();
  const publisher = publishers?.find(item => item.id === id);
  if (!publisher) return <div className="container mx-auto px-4 py-24 text-center">جاري تحميل دار النشر...</div>;
  return <Products title={publisher.nameAr} description={`تصفح إصدارات ${publisher.nameAr} المتاحة في مكتبة دوت كوم.`} publisherId={publisher.id} />;
}
