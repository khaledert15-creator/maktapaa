import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetCart, useUpdateCartItem, useRemoveFromCart, useApplyCoupon, useRemoveCoupon, getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Minus, Plus, Trash2, Tag, ShoppingBag, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Cart() {
  const [, setLocation] = useLocation();
  const { data: cart, isLoading } = useGetCart({ query: { queryKey: ['/api/cart'], retry: false } });
  const [couponCode, setCouponCode] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateItemMutation = useUpdateCartItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      }
    }
  });

  const removeItemMutation = useRemoveFromCart({
    mutation: {
      onSuccess: () => {
        toast({ title: "تم الحذف", description: "تم إزالة الكتاب من السلة" });
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      }
    }
  });

  const applyCouponMutation = useApplyCoupon({
    mutation: {
      onSuccess: () => {
        toast({ title: "تم التفعيل", description: "تم تفعيل كود الخصم بنجاح" });
        setCouponCode("");
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      },
      onError: () => {
        toast({ title: "خطأ", description: "كود الخصم غير صحيح أو منتهي الصلاحية", variant: "destructive" });
      }
    }
  });

  const removeCouponMutation = useRemoveCoupon({
    mutation: {
      onSuccess: () => {
        toast({ title: "تم الإلغاء", description: "تم إلغاء كود الخصم" });
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      }
    }
  });

  const handleUpdateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    updateItemMutation.mutate({ productId, data: { quantity: newQuantity } });
  };

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return;
    applyCouponMutation.mutate({ data: { code: couponCode } });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">سلة المشتريات</h1>
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-64 w-full" />
          </div>
          <div>
            <Skeleton className="h-80 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center flex flex-col items-center">
        <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
          <ShoppingBag className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-2">سلة المشتريات فارغة</h2>
        <p className="text-muted-foreground mb-8">لم تقم بإضافة أي كتب إلى السلة بعد.</p>
        <Button size="lg" asChild>
          <Link href="/catalog">تصفح الكتب الآن</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-6 text-primary">سلة المشتريات</h1>
      
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="overflow-hidden border-border/50">
            {/* Desktop View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[400px]">الكتاب</TableHead>
                    <TableHead>السعر</TableHead>
                    <TableHead className="text-center">الكمية</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.items.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell>
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-20 bg-muted rounded overflow-hidden shrink-0">
                            {item.coverImage ? (
                              <img src={item.coverImage} alt={item.nameAr} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <BookOpen className="h-6 w-6" />
                              </div>
                            )}
                          </div>
                          <div>
                            <Link href={`/product/${item.slug}`} className="font-bold hover:text-secondary line-clamp-2">
                              {item.nameAr}
                            </Link>
                            {!item.inStock && (
                              <span className="text-xs text-destructive font-semibold">غير متوفر حالياً</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold">{item.unitPrice} ج.م</span>
                          {item.oldPrice && <span className="text-xs text-muted-foreground line-through">{item.oldPrice} ج.م</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center border rounded-md h-9 w-24 mx-auto">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="flex-1 text-center text-sm font-semibold">{item.quantity}</span>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {item.subtotal} ج.م
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => removeItemMutation.mutate({ productId: item.productId })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden divide-y">
              {cart.items.map((item) => (
                <div key={item.productId} className="p-4 flex gap-4">
                  <div className="w-20 h-28 bg-muted rounded overflow-hidden shrink-0">
                    {item.coverImage ? (
                      <img src={item.coverImage} alt={item.nameAr} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <BookOpen className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col">
                    <Link href={`/product/${item.slug}`} className="font-bold hover:text-secondary line-clamp-2 text-sm mb-1">
                      {item.nameAr}
                    </Link>
                    <div className="flex items-center gap-2 mb-2 text-sm">
                      <span className="font-bold">{item.unitPrice} ج.م</span>
                      {item.oldPrice && <span className="text-xs text-muted-foreground line-through">{item.oldPrice} ج.م</span>}
                    </div>
                    
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center border rounded-md h-8 w-24">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="flex-1 text-center text-sm font-semibold">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8" onClick={() => removeItemMutation.mutate({ productId: item.productId })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          
          <Button variant="ghost" className="mt-4" onClick={() => setLocation('/catalog')}>
            <ArrowRight className="ml-2 h-4 w-4" />
            متابعة التسوق
          </Button>
        </div>

        <div>
          <Card className="sticky top-24 border-border/50 shadow-md">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="text-lg">ملخص الطلب</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">المجموع (قبل الخصم)</span>
                <span className="font-semibold">{cart.subtotal} ج.م</span>
              </div>
              
              {cart.discount && cart.discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>خصم على المنتجات</span>
                  <span className="font-semibold">-{cart.discount} ج.م</span>
                </div>
              )}

              {cart.couponCode ? (
                <div className="flex justify-between items-center text-sm bg-accent/10 text-accent-foreground p-2 rounded border border-accent/20">
                  <div className="flex items-center gap-2 font-bold">
                    <Tag className="h-4 w-4" />
                    كود {cart.couponCode}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">-{cart.couponDiscount} ج.م</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeCouponMutation.mutate()}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input 
                    placeholder="كود الخصم" 
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="h-9"
                  />
                  <Button 
                    variant="secondary" 
                    className="h-9 shrink-0"
                    onClick={handleApplyCoupon}
                    disabled={!couponCode || applyCouponMutation.isPending}
                  >
                    تطبيق
                  </Button>
                </div>
              )}

              <div className="border-t pt-4 mt-4 flex justify-between items-center">
                <span className="font-bold">الإجمالي</span>
                <div className="text-left">
                  <div className="text-2xl font-black text-primary">{cart.total} ج.م</div>
                  <div className="text-xs text-muted-foreground mt-1">غير شامل مصاريف الشحن</div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-6 pt-0">
              <Button size="lg" className="w-full text-lg h-14" asChild>
                <Link href="/checkout">إتمام الطلب</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Ensure X is imported for the remove coupon icon
import { X } from "lucide-react";
