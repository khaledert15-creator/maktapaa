import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useGetCart, 
  useListGovernorates, 
  useCreateOrder, 
  OrderInputPaymentMethod 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Truck, MapPin, Wallet, ArrowRight, BookOpen } from "lucide-react";
import { getGetCartQueryKey, getGetMyOrdersQueryKey } from "@workspace/api-client-react";

const formSchema = z.object({
  customerName: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
  mobile: z.string().regex(/^01[0125][0-9]{8}$/, "رقم موبايل مصري غير صحيح"),
  altMobile: z.string().regex(/^01[0125][0-9]{8}$/, "رقم موبايل مصري غير صحيح").optional().or(z.literal("")),
  governorateId: z.coerce.number().min(1, "يرجى اختيار المحافظة"),
  city: z.string().min(2, "يرجى إدخال المدينة أو الحي"),
  detailedAddress: z.string().min(5, "يرجى إدخال العنوان بالتفصيل"),
  landmark: z.string().optional(),
  deliveryNotes: z.string().optional(),
  orderNotes: z.string().optional(),
  paymentMethod: z.enum(["cash_on_delivery", "fawry"]),
});

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { data: cart, isLoading: isLoadingCart } = useGetCart({ query: { queryKey: ['/api/cart'], retry: false } });
  const { data: governorates } = useListGovernorates();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedGovId, setSelectedGovId] = useState<number | undefined>(undefined);
  const selectedGov = governorates?.find(g => g.id === selectedGovId);
  const shippingCost = selectedGov?.shippingCost || 0;
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: "",
      mobile: "",
      altMobile: "",
      city: "",
      detailedAddress: "",
      landmark: "",
      deliveryNotes: "",
      orderNotes: "",
      paymentMethod: "cash_on_delivery",
    },
  });

  const createOrderMutation = useCreateOrder({
    mutation: {
      onSuccess: (response) => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyOrdersQueryKey() });
        toast({ title: "تم تأكيد الطلب!", description: `رقم طلبك هو: ${response.orderNumber}` });
        setLocation(`/order-confirmation/${response.orderNumber}`);
      },
      onError: () => {
        toast({ title: "خطأ", description: "حدث خطأ أثناء إنشاء الطلب، يرجى المحاولة مرة أخرى", variant: "destructive" });
      }
    }
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!cart || cart.items.length === 0) {
      toast({ title: "السلة فارغة", variant: "destructive" });
      return;
    }

    createOrderMutation.mutate({
      data: {
        ...values,
        paymentMethod: values.paymentMethod as OrderInputPaymentMethod,
      }
    });
  };

  if (isLoadingCart) {
    return <div className="container mx-auto p-8 text-center">جاري تحميل البيانات...</div>;
  }

  if (!cart || cart.items.length === 0) {
    setLocation('/cart');
    return null;
  }

  const finalTotal = cart.total + shippingCost;

  return (
    <div className="container mx-auto px-4 py-8 bg-muted/20 min-h-[calc(100vh-200px)]">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/cart')}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl md:text-3xl font-bold text-primary">إتمام الطلب</h1>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Delivery Info */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="bg-muted/30 pb-4 border-b">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-secondary" />
                  بيانات التوصيل
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الاسم الكامل *</FormLabel>
                        <FormControl><Input placeholder="الاسم ثلاثي" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="mobile"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>رقم الموبايل *</FormLabel>
                          <FormControl><Input placeholder="01xxxxxxxxx" dir="ltr" className="text-right" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="altMobile"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>رقم بديل (اختياري)</FormLabel>
                          <FormControl><Input placeholder="01xxxxxxxxx" dir="ltr" className="text-right" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="governorateId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>المحافظة *</FormLabel>
                        <Select 
                          onValueChange={(val) => {
                            field.onChange(val);
                            setSelectedGovId(Number(val));
                          }} 
                          defaultValue={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر المحافظة" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {governorates?.filter(g => g.isActive).map(gov => (
                              <SelectItem key={gov.id} value={gov.id.toString()}>{gov.nameAr}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>المدينة / الحي *</FormLabel>
                        <FormControl><Input placeholder="مثال: مدينة نصر، العباسية..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name="detailedAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>العنوان بالتفصيل *</FormLabel>
                          <FormControl><Input placeholder="اسم الشارع، رقم العمارة، رقم الشقة..." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="landmark"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>أقرب علامة مميزة (اختياري)</FormLabel>
                        <FormControl><Input placeholder="بجوار كذا..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="deliveryNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ملاحظات التوصيل (اختياري)</FormLabel>
                        <FormControl><Input placeholder="مثال: الاتصال قبل الوصول بساعة" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="bg-muted/30 pb-4 border-b">
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-secondary" />
                  طريقة الدفع
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-x-reverse space-y-0 p-4 border rounded-md cursor-pointer hover:bg-muted/50 data-[state=checked]:border-secondary data-[state=checked]:bg-secondary/5">
                            <FormControl>
                              <RadioGroupItem value="cash_on_delivery" />
                            </FormControl>
                            <FormLabel className="font-bold flex-1 cursor-pointer">
                              الدفع عند الاستلام (كاش)
                            </FormLabel>
                            <div className="bg-secondary/10 text-secondary p-2 rounded-full">
                              <Wallet className="h-5 w-5" />
                            </div>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-x-reverse space-y-0 p-4 border rounded-md opacity-60 cursor-not-allowed">
                            <FormControl>
                              <RadioGroupItem value="fawry" disabled />
                            </FormControl>
                            <div className="flex-1">
                              <FormLabel className="font-bold text-muted-foreground">
                                الدفع عبر فوري
                              </FormLabel>
                              <p className="text-xs text-muted-foreground mt-1">قريباً</p>
                            </div>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="mt-6">
                  <FormField
                    control={form.control}
                    name="orderNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ملاحظات على الطلب (اختياري)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="أي تفاصيل أخرى تود إضافتها للطلب..." className="resize-none" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="sticky top-24 border-border/50 shadow-md">
              <CardHeader className="bg-muted/30 pb-4 border-b">
                <CardTitle className="text-lg">ملخص الطلب</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-6 space-y-4">
                  {cart.items.map(item => (
                    <div key={item.productId} className="flex gap-3 items-center">
                      <div className="w-12 h-16 bg-muted rounded overflow-hidden shrink-0">
                         {item.coverImage ? (
                            <img src={item.coverImage} alt={item.nameAr} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <BookOpen className="h-4 w-4" />
                            </div>
                          )}
                      </div>
                      <div className="flex-1 text-sm">
                        <div className="font-bold line-clamp-1">{item.nameAr}</div>
                        <div className="text-muted-foreground">{item.quantity} × {item.unitPrice} ج.م</div>
                      </div>
                      <div className="font-bold">{item.subtotal} ج.م</div>
                    </div>
                  ))}
                </div>
                
                <div className="p-6 bg-muted/10 border-t space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المجموع (قبل الخصم)</span>
                    <span className="font-semibold">{cart.subtotal} ج.م</span>
                  </div>
                  
                  {cart.discount && cart.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>خصم المنتجات</span>
                      <span className="font-semibold">-{cart.discount} ج.م</span>
                    </div>
                  )}

                  {cart.couponCode && (
                    <div className="flex justify-between text-accent-foreground font-medium">
                      <span>كود خصم ({cart.couponCode})</span>
                      <span>-{cart.couponDiscount} ج.م</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Truck className="h-4 w-4" /> مصاريف الشحن
                    </span>
                    <span className="font-semibold">
                      {selectedGovId ? (shippingCost === 0 ? "مجانًا" : `${shippingCost} ج.م`) : "يحدد لاحقاً"}
                    </span>
                  </div>
                  
                  {selectedGovId && selectedGov && selectedGov.estimatedDays && (
                    <div className="text-xs text-muted-foreground mt-1">
                      مدة التوصيل المتوقعة: {selectedGov.estimatedDays} أيام عمل
                    </div>
                  )}

                  <div className="border-t pt-3 mt-3 flex justify-between items-center">
                    <span className="font-bold text-lg">الإجمالي النهائي</span>
                    <div className="text-2xl font-black text-primary">
                      {finalTotal} ج.م
                    </div>
                  </div>
                </div>
              </CardContent>
              <div className="p-6 pt-0 bg-muted/10">
                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full text-lg h-14" 
                  disabled={createOrderMutation.isPending}
                >
                  {createOrderMutation.isPending ? "جاري التأكيد..." : "تأكيد الطلب الآن"}
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-4">
                  بالضغط على تأكيد الطلب، أنت توافق على شروط وأحكام مكتبة دوت كوم
                </p>
              </div>
            </Card>
          </div>
        </form>
      </Form>
    </div>
  );
}
