import { Link, useLocation } from "wouter";
import { Heart, BookOpen, ShoppingCart } from "lucide-react";
import type { ProductSummary } from "@workspace/api-client-react";
import { getGetCartQueryKey, getListFavoritesQueryKey, useAddFavorite, useAddToCart, useRemoveFavorite } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export function ProductCard({ product, isFavorite = false }: { product: ProductSummary; isFavorite?: boolean }) {
  const { customer } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const refreshFavorites = () => queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() });
  const addFavorite = useAddFavorite({ mutation: { onSuccess: refreshFavorites } });
  const removeFavorite = useRemoveFavorite({ mutation: { onSuccess: refreshFavorites } });
  const addToCart = useAddToCart({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        toast({ title: "تمت الإضافة إلى السلة" });
      },
      onError: () => toast({ title: "تعذر إضافة المنتج", variant: "destructive" }),
    },
  });

  const toggleFavorite = () => {
    if (!customer) { setLocation(`/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
    if (isFavorite) removeFavorite.mutate({ productId: product.id });
    else addFavorite.mutate({ productId: product.id });
  };

  return (
    <Card className="group relative flex h-full flex-col overflow-hidden rounded-2xl border-border/70 bg-card transition duration-300 hover:-translate-y-1 hover:border-secondary/50 hover:shadow-xl">
      <Link href={`/product/${product.slug}`} className="relative block aspect-[3/4] overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50">
        {product.coverImage ? (
          <img src={product.coverImage} alt={product.nameAr} width="360" height="480" loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center text-primary/35">
            <BookOpen className="h-14 w-14" />
            <span className="line-clamp-3 text-sm font-bold">{product.nameAr}</span>
          </div>
        )}
        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          {!!product.discountPercent && product.discountPercent > 0 && <Badge className="bg-rose-600 text-white">خصم {product.discountPercent}%</Badge>}
          {product.freeShipping && <Badge className="bg-emerald-600 text-white">{product.freeShippingBadgeText || "شحن مجاني"}</Badge>}
        </div>
        {!product.inStock && <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-[2px]"><Badge variant="outline" className="bg-background text-base">نفدت الكمية</Badge></div>}
      </Link>
      <Button aria-label={isFavorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"} variant="secondary" size="icon" onClick={toggleFavorite} className={`absolute left-2 top-2 z-10 h-9 w-9 rounded-full bg-white/95 shadow ${isFavorite ? "text-rose-600" : "text-slate-500"}`}>
        <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
      </Button>
      <CardContent className="flex flex-1 flex-col p-3.5 sm:p-4">
        <div className="mb-1 truncate text-xs font-semibold text-secondary">{product.publisher || product.subject || "مكتبة دوت كوم"}</div>
        <Link href={`/product/${product.slug}`} className="mb-3 line-clamp-2 min-h-10 text-sm font-extrabold leading-5 transition group-hover:text-secondary sm:text-base">{product.nameAr}</Link>
        <div className="mb-3 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
          {product.grade && <span className="rounded-full bg-muted px-2 py-1">{product.grade}</span>}
          {product.subject && <span className="rounded-full bg-muted px-2 py-1">{product.subject}</span>}
        </div>
        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            <div className="whitespace-nowrap text-lg font-black text-primary">{product.price.toLocaleString("ar-EG")} ج.م</div>
            {product.oldPrice && product.oldPrice > product.price ? <div className="text-xs text-muted-foreground line-through">{product.oldPrice.toLocaleString("ar-EG")} ج.م</div> : null}
          </div>
          <Button aria-label="إضافة إلى السلة" size="icon" disabled={!product.inStock || addToCart.isPending} onClick={() => addToCart.mutate({ data: { productId: product.id, quantity: 1 } })} className="h-10 w-10 shrink-0 rounded-xl bg-secondary text-white hover:bg-secondary/90">
            <ShoppingCart className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
