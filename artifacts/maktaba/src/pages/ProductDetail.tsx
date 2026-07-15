import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetProduct, useGetRelatedProducts, useAddToCart } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Heart, Share2, BookOpen, Truck, ShieldCheck, Plus, Minus } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCartQueryKey } from "@workspace/api-client-react";

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading, isError } = useGetProduct(slug);
  const relatedProductId = product?.id || 0;
  const { data: relatedProducts } = useGetRelatedProducts(relatedProductId, {
    query: { queryKey: [`/api/products/${relatedProductId}/related`], enabled: !!product?.id }
  });
  
  const [quantity, setQuantity] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const addToCartMutation = useAddToCart({
    mutation: {
      onSuccess: () => {
        toast({ title: "تم الإضافة بنجاح", description: "تم إضافة الكتاب إلى سلة المشتريات" });
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      },
      onError: () => {
        toast({ title: "خطأ", description: "حدث خطأ أثناء الإضافة للسلة", variant: "destructive" });
      }
    }
  });

  const handleAddToCart = () => {
    if (!product) return;
    addToCartMutation.mutate({ data: { productId: product.id, quantity } });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-10">
          <Skeleton className="aspect-[3/4] w-full max-w-md mx-auto rounded-xl" />
          <div className="space-y-6">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-12 w-1/3" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">الكتاب غير موجود</h2>
        <Button asChild><Link href="/catalog">العودة للمكتبة</Link></Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-primary">الرئيسية</Link>
        <span>/</span>
        <Link href="/catalog" className="hover:text-primary">الكتب</Link>
        <span>/</span>
        <span className="text-foreground truncate">{product.nameAr}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-10 mb-16">
        {/* Image Gallery */}
        <div className="flex flex-col gap-4">
          <div className="aspect-[3/4] w-full max-w-md mx-auto bg-muted rounded-2xl overflow-hidden relative border">
            {product.coverImage ? (
              <img src={product.coverImage} alt={product.nameAr} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/5 text-primary/30">
                <BookOpen className="w-24 h-24" />
              </div>
            )}
            {product.discountPercent && product.discountPercent > 0 && (
              <Badge className="absolute top-4 right-4 text-sm px-3 py-1 bg-destructive text-destructive-foreground font-bold">
                خصم {product.discountPercent}%
              </Badge>
            )}
            {!product.inStock && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-sm">
                <Badge variant="outline" className="text-lg px-6 py-2 bg-background text-muted-foreground font-bold border-2">نفذت الكمية</Badge>
              </div>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="flex flex-col">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-secondary font-bold">{product.publisher || 'ناشر غير معروف'}</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                <Heart className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <Share2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-black text-primary leading-tight mb-2">
            {product.nameAr}
          </h1>
          
          {product.nameEn && (
            <h2 className="text-lg text-muted-foreground mb-6" dir="ltr">{product.nameEn}</h2>
          )}

          <div className="flex items-center gap-4 mb-8 pb-8 border-b">
            <span className="text-4xl font-black text-primary">{product.price} ج.م</span>
            {product.oldPrice && (
              <span className="text-xl text-muted-foreground line-through">{product.oldPrice} ج.م</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-y-4 gap-x-8 mb-8 text-sm">
            {product.stage && (
              <div className="flex flex-col">
                <span className="text-muted-foreground">المرحلة</span>
                <span className="font-semibold">{product.stage}</span>
              </div>
            )}
            {product.grade && (
              <div className="flex flex-col">
                <span className="text-muted-foreground">الصف</span>
                <span className="font-semibold">{product.grade}</span>
              </div>
            )}
            {product.subject && (
              <div className="flex flex-col">
                <span className="text-muted-foreground">المادة</span>
                <span className="font-semibold">{product.subject}</span>
              </div>
            )}
            {product.edition && (
              <div className="flex flex-col">
                <span className="text-muted-foreground">الطبعة</span>
                <span className="font-semibold">{product.edition}</span>
              </div>
            )}
          </div>

          {product.descriptionShort && (
            <p className="text-muted-foreground mb-8 leading-relaxed">
              {product.descriptionShort}
            </p>
          )}

          <div className="mt-auto space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center border rounded-md h-12">
                <Button variant="ghost" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={!product.inStock}>
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="w-12 text-center font-semibold">{quantity}</div>
                <Button variant="ghost" size="icon" onClick={() => setQuantity(quantity + 1)} disabled={!product.inStock || (product.stockQuantity !== undefined && quantity >= product.stockQuantity)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button 
                size="lg" 
                className="flex-1 h-12 text-lg font-bold" 
                disabled={!product.inStock || addToCartMutation.isPending}
                onClick={handleAddToCart}
              >
                <ShoppingCart className="ml-2 h-5 w-5" />
                أضف للسلة
              </Button>
            </div>
            
            <Button variant="outline" size="lg" className="w-full h-12 bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800" asChild>
              <a href={`https://wa.me/201000000000?text=${encodeURIComponent(`مرحباً، أستفسر عن كتاب: ${product.nameAr}`)}`} target="_blank" rel="noreferrer">
                <FaWhatsapp className="ml-2 h-5 w-5" />
                استفسر عبر واتساب
              </a>
            </Button>
          </div>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg flex items-start gap-3">
            <Truck className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold block mb-1">توصيل سريع لكل المحافظات</span>
              <span className="text-muted-foreground">اطلب الآن ويصلك خلال 2-4 أيام عمل حسب محافظتك.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Description Tabs */}
      <div className="mb-16">
        <h3 className="text-2xl font-bold mb-4 border-b pb-2">وصف الكتاب</h3>
        <div className="prose prose-blue max-w-none text-muted-foreground leading-loose">
          {product.descriptionFull ? (
             <div dangerouslySetInnerHTML={{ __html: product.descriptionFull }} />
          ) : (
            <p>لا يوجد وصف تفصيلي متاح حالياً لهذا الكتاب.</p>
          )}
        </div>
      </div>
    </div>
  );
}
