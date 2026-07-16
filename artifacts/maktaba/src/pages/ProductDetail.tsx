import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { BookOpen, Check, Heart, Maximize2, Minus, Plus, Share2, ShieldCheck, ShoppingCart, Truck } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { getGetCartQueryKey, getGetFrequentlyBoughtProductsQueryKey, getGetRelatedProductsQueryKey, getListFavoritesQueryKey, useAddFavorite, useAddToCart, useGetFrequentlyBoughtProducts, useGetProduct, useGetRelatedProducts, useGetSiteSettings, useListFavorites, useListGovernorates, useRemoveFavorite, type ProductSummary } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductSection } from "@/components/storefront/ProductSection";
import { Seo } from "@/components/storefront/Seo";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { type ProductNotice, useProductNotice } from "@/components/storefront/ProductNoticeModal";

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { customer } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: product, isLoading, isError, refetch } = useGetProduct(slug);
  const productId = product?.id || 0;
  const { data: related } = useGetRelatedProducts(productId, { query: { queryKey: getGetRelatedProductsQueryKey(productId), enabled: Boolean(product?.id) } });
  const { data: frequentlyBought } = useGetFrequentlyBoughtProducts(productId, { query: { queryKey: getGetFrequentlyBoughtProductsQueryKey(productId), enabled: Boolean(product?.id) } });
  const { data: favorites } = useListFavorites({ query: { queryKey: getListFavoritesQueryKey(), enabled: Boolean(customer), retry: false } });
  const { data: settings } = useGetSiteSettings();
  const { data: governorates } = useListGovernorates();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const isFavorite = Boolean(product && favorites?.some(item => item.id === product.id));
  const refreshFavorites = () => queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() });
  const addFavorite = useAddFavorite({ mutation: { onSuccess: refreshFavorites } });
  const removeFavorite = useRemoveFavorite({ mutation: { onSuccess: refreshFavorites } });
  const addToCart = useAddToCart({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }) } });
  const notice = useProductNotice(product as unknown as ProductNotice | undefined, true);

  useEffect(() => { if (product) setSelectedImage(product.images[0] || product.coverImage || null); }, [product]);
  useEffect(() => {
    if (!product) return;
    const summary: ProductSummary = { id: product.id, nameAr: product.nameAr, nameEn: product.nameEn, slug: product.slug, coverImage: product.coverImage, price: product.price, oldPrice: product.oldPrice, discountPercent: product.discountPercent, inStock: product.inStock, isBestSeller: product.isBestSeller, isNew: product.isNew, isFeatured: product.isFeatured, isOffer: product.isOffer, isRevision: product.isRevision, isBundle: product.isBundle, freeShipping: product.freeShipping, freeShippingBadgeText: product.freeShippingBadgeText, publisher: product.publisher, stage: product.stage, grade: product.grade, subject: product.subject, educationType: product.educationType, schoolYear: product.schoolYear, author: product.author };
    try {
      const current = JSON.parse(localStorage.getItem("maktaba_recently_viewed") || "[]") as ProductSummary[];
      localStorage.setItem("maktaba_recently_viewed", JSON.stringify([summary, ...current.filter(item => item.id !== summary.id)].slice(0, 10)));
    } catch { localStorage.removeItem("maktaba_recently_viewed"); }
  }, [product]);

  const performAdd = async (buyNow = false) => {
    if (!product) return;
    try { await addToCart.mutateAsync({ data: { productId: product.id, quantity } }); toast({ title: "تمت الإضافة إلى السلة" }); if (buyNow) setLocation("/checkout"); }
    catch { toast({ title: "تعذر إضافة المنتج", variant: "destructive" }); }
  };
  const add = (buyNow = false) => notice.request(buyNow ? "buy_now" : "add_to_cart", () => void performAdd(buyNow));
  const toggleFavorite = () => {
    if (!product) return;
    if (!customer) { setLocation(`/login?next=/product/${product.slug}`); return; }
    if (isFavorite) removeFavorite.mutate({ productId: product.id }); else addFavorite.mutate({ productId: product.id });
  };
  const share = async () => {
    const shareData = { title: product?.nameAr, url: window.location.href };
    if (navigator.share) await navigator.share(shareData).catch(() => undefined);
    else { await navigator.clipboard.writeText(window.location.href); toast({ title: "تم نسخ رابط المنتج" }); }
  };
  const deliveryRange = useMemo(() => {
    const ranges = (governorates || []).filter(item => item.isActive).map(item => item as typeof item & { minDeliveryDays?: number; maxDeliveryDays?: number });
    return ranges.length ? `${Math.min(...ranges.map(item => item.minDeliveryDays ?? item.estimatedDays))}–${Math.max(...ranges.map(item => item.maxDeliveryDays ?? item.estimatedDays))} أيام عمل حسب المحافظة` : "تظهر المدة الدقيقة بعد اختيار المحافظة";
  }, [governorates]);

  const responsiveImages = (product as typeof product & { imageVariants?: { url: string; srcSet?: string | null; width?: number | null; height?: number | null }[] } | undefined)?.imageVariants || [];
  const selectedVariant = responsiveImages.find(image => image.url === selectedImage);

  if (isLoading) return <div className="container mx-auto grid gap-10 px-4 py-10 md:grid-cols-2"><Skeleton className="mx-auto aspect-[3/4] w-full max-w-lg rounded-3xl" /><div className="space-y-5"><Skeleton className="h-10 w-3/4" /><Skeleton className="h-8 w-1/3" /><Skeleton className="h-28 w-full" /><Skeleton className="h-14 w-full" /></div></div>;
  if (isError || !product) return <div className="container mx-auto px-4 py-24 text-center"><BookOpen className="mx-auto mb-4 h-16 w-16 text-muted-foreground/30" /><h1 className="text-2xl font-black">المنتج غير موجود أو لم يعد متاحًا</h1><div className="mt-6 flex justify-center gap-3"><Button variant="outline" onClick={() => refetch()}>إعادة المحاولة</Button><Button asChild><Link href="/catalog">تصفح الكتب</Link></Button></div></div>;

  const whatsapp = settings?.whatsappNumber?.replace(/\D/g, "");
  const jsonLd = [{ "@context": "https://schema.org", "@type": "Product", name: product.nameAr, image: product.images, description: product.seoDescription || product.descriptionShort || product.nameAr, sku: product.sku, brand: { "@type": "Brand", name: product.publisher || settings?.storeNameAr || "مكتبة دوت كوم" }, offers: { "@type": "Offer", priceCurrency: "EGP", price: product.price, availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: window.location.href } }, { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "الرئيسية", item: new URL("/", window.location.origin).href }, { "@type": "ListItem", position: 2, name: "الكتب", item: new URL("/catalog", window.location.origin).href }, { "@type": "ListItem", position: 3, name: product.nameAr, item: window.location.href }] }];
  return <div className="container mx-auto px-4 py-7 sm:py-10">
    <Seo title={product.seoTitle || `${product.nameAr} | ${settings?.storeNameAr || "مكتبة دوت كوم"}`} description={product.seoDescription || product.descriptionShort} image={product.coverImage} jsonLd={jsonLd} />
    <nav className="mb-7 flex items-center gap-2 overflow-hidden text-sm text-muted-foreground"><Link href="/">الرئيسية</Link><span>/</span><Link href="/catalog">الكتب</Link><span>/</span><span className="truncate text-foreground">{product.nameAr}</span></nav>
    <div className="grid gap-9 lg:grid-cols-[1fr_1fr] lg:gap-14">
      <section className="grid gap-3 sm:grid-cols-[84px_1fr]">
        <div className="order-2 flex gap-2 overflow-x-auto sm:order-1 sm:flex-col">{product.images.map((image, index) => <button key={`${image}-${index}`} onClick={() => setSelectedImage(image)} aria-label={`عرض الصورة ${index + 1}`} className={`h-24 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-white ${selectedImage === image ? "border-secondary" : "border-transparent"}`}><img src={image} alt={`${product.nameAr} - ${index + 1}`} width="80" height="96" className="h-full w-full object-cover" /></button>)}</div>
        <button onClick={() => selectedImage && setZoomOpen(true)} className="group relative order-1 mx-auto aspect-[3/4] w-full max-w-lg overflow-hidden rounded-3xl border bg-slate-50 sm:order-2" aria-label="تكبير صورة المنتج">{selectedImage ? <img src={selectedImage} srcSet={selectedVariant?.srcSet || undefined} sizes="(max-width: 1024px) 90vw, 50vw" alt={product.nameAr} width={selectedVariant?.width || 640} height={selectedVariant?.height || 850} decoding="async" className="h-full w-full object-contain transition duration-500 group-hover:scale-105" /> : <BookOpen className="m-auto h-full w-28 text-muted-foreground/25" />}<span className="absolute bottom-4 left-4 rounded-full bg-white/95 p-3 shadow"><Maximize2 className="h-5 w-5" /></span>{!!product.discountPercent && product.discountPercent > 0 && <Badge className="absolute right-4 top-4 bg-rose-600 px-3 py-1.5 text-white">خصم {product.discountPercent}%</Badge>}</button>
      </section>
      <section className="flex flex-col"><div className="flex items-start justify-between gap-4"><div><div className="mb-2 text-sm font-bold text-secondary">{product.publisher || "مكتبة دوت كوم"}</div><h1 className="text-3xl font-black leading-tight text-primary sm:text-4xl">{product.nameAr}</h1>{product.nameEn && <p className="mt-2 text-muted-foreground" dir="ltr">{product.nameEn}</p>}</div><div className="flex gap-1"><Button aria-label="المفضلة" variant="outline" size="icon" onClick={toggleFavorite} className={isFavorite ? "text-rose-600" : ""}><Heart className={`h-5 w-5 ${isFavorite ? "fill-current" : ""}`} /></Button><Button aria-label="مشاركة" variant="outline" size="icon" onClick={share}><Share2 className="h-5 w-5" /></Button></div></div>
        <div className="mt-5 flex flex-wrap gap-2">{product.freeShipping && <Badge className="bg-emerald-600 text-white">{product.freeShippingBadgeText || "شحن مجاني"}</Badge>}{product.isBestSeller && <Badge className="bg-amber-400 text-slate-950">الأكثر مبيعًا</Badge>}{product.isNew && <Badge variant="secondary">جديد</Badge>}<Badge variant={product.inStock ? "outline" : "destructive"}>{product.inStock ? `متوفر (${product.stockQuantity})` : "نفدت الكمية"}</Badge></div>
        <div className="my-7 flex items-baseline gap-3 border-y py-6"><span className="text-4xl font-black text-primary">{product.price.toLocaleString("ar-EG")} ج.م</span>{product.oldPrice && product.oldPrice > product.price && <span className="text-xl text-muted-foreground line-through">{product.oldPrice.toLocaleString("ar-EG")} ج.م</span>}</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl bg-slate-50 p-5 text-sm">{[["المرحلة", product.stage], ["الصف", product.grade], ["المادة", product.subject], ["نوع التعليم", product.educationType], ["السنة الدراسية", product.schoolYear], ["المؤلف / المدرس", product.author], ["الطبعة", product.edition], ["كود المنتج", product.sku]].filter(([, value]) => value).map(([label, value]) => <div key={label}><span className="block text-xs text-muted-foreground">{label}</span><strong>{value}</strong></div>)}</div>
        {product.descriptionShort && <p className="mt-6 leading-8 text-muted-foreground">{product.descriptionShort}</p>}
        <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="flex gap-3 rounded-2xl border p-4"><Truck className="h-6 w-6 shrink-0 text-secondary" /><div><strong className="block">توصيل محسوب بدقة</strong><span className="text-xs text-muted-foreground">{deliveryRange}</span></div></div><div className="flex gap-3 rounded-2xl border p-4"><ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600" /><div><strong className="block">الدفع عند الاستلام</strong><span className="text-xs text-muted-foreground">الوسيلة الفعالة حاليًا</span></div></div></div>
        <div className="mt-6 flex flex-wrap gap-3"><div className="flex h-13 items-center rounded-xl border"><Button variant="ghost" size="icon" onClick={() => setQuantity(value => Math.max(1, value - 1))}><Minus className="h-4 w-4" /></Button><span className="w-10 text-center font-black">{quantity}</span><Button variant="ghost" size="icon" onClick={() => setQuantity(value => Math.min(product.stockQuantity ?? 1, value + 1))}><Plus className="h-4 w-4" /></Button></div><Button size="lg" disabled={!product.inStock || addToCart.isPending} onClick={() => add(false)} className="h-13 flex-1 rounded-xl text-base"><ShoppingCart className="ml-2 h-5 w-5" /> إضافة للسلة</Button><Button size="lg" variant="secondary" disabled={!product.inStock || addToCart.isPending} onClick={() => add(true)} className="h-13 flex-1 rounded-xl text-base text-white"><Check className="ml-2 h-5 w-5" /> اشترِ الآن</Button></div>
        {whatsapp && <Button variant="outline" className="mt-3 h-12 rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50" asChild><a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`أريد الاستفسار عن: ${product.nameAr}\n${window.location.href}`)}`} target="_blank" rel="noreferrer"><FaWhatsapp className="ml-2 h-5 w-5" /> اسأل عن المنتج عبر واتساب</a></Button>}
      </section>
    </div>
    {product.descriptionFull && <section className="mt-14 rounded-3xl border bg-white p-6 sm:p-9"><h2 className="mb-4 text-2xl font-black">تفاصيل الكتاب</h2><div className="whitespace-pre-line leading-9 text-muted-foreground">{product.descriptionFull}</div></section>}
    <div className="mt-12"><ProductSection title="يُشترى معه غالبًا" products={frequentlyBought} /></div><ProductSection title="كتب مرتبطة" products={related} tone="soft" />
    <Dialog open={zoomOpen} onOpenChange={setZoomOpen}><DialogContent className="max-w-4xl border-none bg-white p-3"><DialogTitle className="sr-only">صورة {product.nameAr}</DialogTitle>{selectedImage && <img src={selectedImage} alt={product.nameAr} className="max-h-[85vh] w-full object-contain" />}</DialogContent></Dialog>
    {notice.modal}
  </div>;
}
