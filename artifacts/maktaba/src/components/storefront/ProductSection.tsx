import type { ProductSummary } from "@workspace/api-client-react";
import { ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { ProductCard } from "./ProductCard";

export function ProductSection({ title, subtitle, products, href = "/catalog", tone = "plain" }: { title: string; subtitle?: string; products?: ProductSummary[]; href?: string; tone?: "plain" | "soft" }) {
  if (!products?.length) return null;
  return (
    <section className={tone === "soft" ? "bg-slate-50/80 py-10 sm:py-14" : "py-4 sm:py-8"}>
      <div className="container mx-auto px-4">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div><h2 className="text-2xl font-black text-primary sm:text-3xl">{title}</h2>{subtitle && <p className="mt-1 text-sm text-muted-foreground sm:text-base">{subtitle}</p>}</div>
          <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-bold text-secondary hover:underline">عرض الكل <ChevronLeft className="h-4 w-4" /></Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.slice(0, 10).map(product => <ProductCard key={product.id} product={product} />)}
        </div>
      </div>
    </section>
  );
}
