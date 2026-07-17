import type { Banner } from "@workspace/api-client-react";
import { ChevronLeft, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type HeroSlide = Banner & {
  imageWidth?: number | null;
  imageHeight?: number | null;
  imageVariants?: Record<string, { url: string; width: number }> | null;
};

export function HeroBanner({ slide, preview = false, className }: { slide: HeroSlide; preview?: boolean; className?: string }) {
  const alignment = slide.textAlignment || "right";
  const bannerSrcSet = slide.imageVariants
    ? Object.values(slide.imageVariants).map(image => `${image.url} ${image.width}w`).join(", ")
    : undefined;
  const contentAlignment = alignment === "center"
    ? "mx-auto items-center text-center"
    : alignment === "left"
      ? "mr-auto items-end text-left"
      : "ml-auto items-start text-right";
  const buttonAlignment = alignment === "center" ? "justify-center" : alignment === "left" ? "justify-end" : "justify-start";

  return (
    <section className={cn("relative overflow-hidden bg-gradient-to-l from-slate-950 via-slate-900 to-blue-950 text-white", className)}>
      {slide.imageUrl && (
        <img
          key={slide.id}
          src={slide.imageUrl}
          srcSet={bannerSrcSet}
          sizes="100vw"
          alt={slide.titleAr || ""}
          width={slide.imageWidth || 1600}
          height={slide.imageHeight || 650}
          fetchPriority={preview ? undefined : "high"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-l from-slate-950/95 via-slate-900/75 to-transparent" />
      <div className={cn("container relative mx-auto flex min-h-[440px] items-center px-4 py-14 md:py-20", preview && "min-h-[360px]")}>
        <div className={cn("flex max-w-2xl flex-col animate-in fade-in slide-in-from-bottom-3 duration-700", contentAlignment)}>
          {slide.badgeText && (
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-300/10 px-4 py-2 text-sm font-bold text-sky-200">
              <Sparkles className="h-4 w-4" />
              {slide.badgeText}
            </div>
          )}
          {slide.titleAr && <h1 className="text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">{slide.titleAr}</h1>}
          {slide.subtitleAr && <p className="mt-5 max-w-xl text-lg leading-8 text-slate-200">{slide.subtitleAr}</p>}
          {(slide.primaryButtonText && slide.primaryButtonUrl) || (slide.secondaryButtonText && slide.secondaryButtonUrl) ? (
            <div className={cn("mt-8 flex flex-wrap gap-3", buttonAlignment)}>
              {slide.primaryButtonText && slide.primaryButtonUrl && (
                preview
                  ? <Button type="button" size="lg" className="h-13 rounded-xl bg-sky-500 px-7 text-base text-white hover:bg-sky-400">{slide.primaryButtonText} <ChevronLeft className="mr-2 h-5 w-5" /></Button>
                  : <Button size="lg" className="h-13 rounded-xl bg-sky-500 px-7 text-base text-white hover:bg-sky-400" asChild>{/^https?:\/\//i.test(slide.primaryButtonUrl) ? <a href={slide.primaryButtonUrl} rel="noopener noreferrer">{slide.primaryButtonText} <ChevronLeft className="mr-2 h-5 w-5" /></a> : <Link href={slide.primaryButtonUrl}>{slide.primaryButtonText} <ChevronLeft className="mr-2 h-5 w-5" /></Link>}</Button>
              )}
              {slide.secondaryButtonText && slide.secondaryButtonUrl && (
                preview
                  ? <Button type="button" size="lg" variant="outline" className="h-13 rounded-xl border-white/30 bg-white/10 px-7 text-base text-white hover:bg-white/20">{slide.secondaryButtonText}</Button>
                  : <Button size="lg" variant="outline" className="h-13 rounded-xl border-white/30 bg-white/10 px-7 text-base text-white hover:bg-white/20" asChild>{/^https?:\/\//i.test(slide.secondaryButtonUrl) ? <a href={slide.secondaryButtonUrl} rel="noopener noreferrer">{slide.secondaryButtonText}</a> : <Link href={slide.secondaryButtonUrl}>{slide.secondaryButtonText}</Link>}</Button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
