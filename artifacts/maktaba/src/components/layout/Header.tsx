import { FormEvent, type ReactElement, useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, ShoppingCart, User, Heart, Menu, PackageSearch } from "lucide-react";
import { getGetSiteSettingsQueryKey, useGetSiteSettings } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useCartContext } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const navigation = [
  ["الرئيسية", "/"], ["كل الكتب", "/catalog"], ["العروض", "/offers"], ["المراحل الدراسية", "/stages"], ["دور النشر", "/publishers"], ["تتبع طلبك", "/track"],
] as const;

export function Header() {
  const { itemCount } = useCartContext();
  const { customer } = useAuth();
  const { data: settings } = useGetSiteSettings({ query: { queryKey: getGetSiteSettingsQueryKey(), staleTime: 0, refetchOnMount: "always", refetchInterval: 5_000 } });
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const submitSearch = (event: FormEvent) => { event.preventDefault(); if (query.trim()) setLocation(`/search?q=${encodeURIComponent(query.trim())}`); };
  const announcementLink = settings?.announcementLink && (settings.announcementLink.startsWith("/") || /^https?:\/\//i.test(settings.announcementLink)) ? settings.announcementLink : null;

  const mainLogo = settings?.mainLogoUrl || settings?.logoUrl;
  const mobileLogo = settings?.mobileLogoUrl || mainLogo;
  return <TooltipProvider delayDuration={250}><header className="sticky top-0 z-50 border-b bg-white/95 shadow-sm backdrop-blur">
    {settings?.announcementEnabled && settings.announcementBar && <div className="bg-primary px-4 py-2 text-center text-xs font-bold text-primary-foreground sm:text-sm">{announcementLink ? <a href={announcementLink} className="block transition-opacity hover:opacity-85">{settings.announcementBar}</a> : settings.announcementBar}</div>}
    <div className="container mx-auto flex min-h-20 items-center gap-3 px-4">
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="md:hidden" aria-label="فتح القائمة" title="فتح القائمة"><Menu className="h-6 w-6" /></Button></SheetTrigger><SheetContent side="right" className="w-80"><SheetHeader><SheetTitle className="text-right">القائمة الرئيسية</SheetTitle></SheetHeader><nav className="mt-8 flex flex-col gap-1">{navigation.map(([label, href]) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 font-bold hover:bg-muted">{label}</Link>)}</nav></SheetContent></Sheet>
      <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="الصفحة الرئيسية">{mainLogo ? <><img src={mobileLogo!} alt={settings?.storeNameAr || "مكتبة دوت كوم"} width="54" height="48" className="h-11 w-auto max-w-14 object-contain sm:hidden" /><img src={mainLogo} alt={settings?.storeNameAr || "مكتبة دوت كوم"} width="150" height="48" className="hidden h-11 w-auto max-w-36 object-contain sm:block" /></> : <span className="whitespace-nowrap text-xl font-black tracking-tight text-primary sm:text-2xl">{settings?.storeNameAr || "مكتبة دوت كوم"}</span>}</Link>
      <form onSubmit={submitSearch} className="relative mx-auto hidden max-w-2xl flex-1 sm:block"><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث باسم الكتاب، المادة، المؤلف أو دار النشر..." aria-label="البحث في المنتجات" className="h-12 rounded-2xl border-slate-200 bg-slate-50 pr-5 pl-14 focus-visible:bg-white" /><IconTooltip label="بحث"><Button type="submit" size="icon" aria-label="بحث" className="absolute left-1.5 top-1.5 h-9 w-10 rounded-xl bg-secondary text-white"><Search className="h-5 w-5" /></Button></IconTooltip></form>
      <div className="flex items-center gap-0.5 sm:gap-1">
        <IconTooltip label="بحث"><Button variant="ghost" size="icon" className="sm:hidden" asChild><Link href="/search" aria-label="بحث"><Search className="h-5 w-5" /></Link></Button></IconTooltip>
        <IconTooltip label="تتبع الطلب"><Button variant="ghost" size="icon" className="hidden lg:inline-flex" asChild><Link href="/track" aria-label="تتبع الطلب"><PackageSearch className="h-5 w-5" /></Link></Button></IconTooltip>
        <IconTooltip label="المفضلة"><Button variant="ghost" size="icon" className="hidden sm:inline-flex" asChild><Link href={customer ? "/account?tab=favorites" : "/login?next=/account?tab=favorites"} aria-label="المفضلة"><Heart className="h-5 w-5" /></Link></Button></IconTooltip>
        <IconTooltip label={customer ? "حسابي" : "تسجيل الدخول"}><Button variant="ghost" size="icon" asChild><Link href={customer ? "/account" : "/login"} aria-label={customer ? "حسابي" : "تسجيل الدخول"}><User className="h-5 w-5" /></Link></Button></IconTooltip>
        <IconTooltip label="السلة"><Button variant="ghost" size="icon" className="relative" asChild><Link href="/cart" aria-label={`السلة${itemCount ? `، ${itemCount} منتجات` : ""}`}><ShoppingCart className="h-5 w-5" />{itemCount > 0 && <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-slate-950">{itemCount}</span>}</Link></Button></IconTooltip>
      </div>
    </div>
    <nav className="hidden border-t bg-white md:block"><div className="container mx-auto flex items-center justify-center gap-7 px-4 py-3 text-sm font-bold text-muted-foreground">{navigation.map(([label, href]) => <Link key={href} href={href} className="transition hover:text-secondary">{label}</Link>)}</div></nav>
  </header></TooltipProvider>;
}

function IconTooltip({ label, children }: { label: string; children: ReactElement }) { return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent side="bottom" dir="rtl">{label}</TooltipContent></Tooltip>; }
