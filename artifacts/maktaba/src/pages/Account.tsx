import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useGetMyOrders, useListFavorites, useLogoutCustomer } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Heart, User, MapPin, LogOut, BookOpen, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Account() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const defaultTab = searchParams.get('tab') || 'orders';
  
  const { customer, isCustomerAuthLoaded } = useAuth();
  
  const logoutMutation = useLogoutCustomer({
    mutation: {
      onSuccess: () => {
        window.location.href = '/login'; // hard reload to clear all states
      }
    }
  });

  const { data: ordersData, isLoading: isLoadingOrders } = useGetMyOrders(
    { page: 1, limit: 10 },
    { query: { queryKey: ['/api/orders/my', { page: 1, limit: 10 }], enabled: !!customer } }
  );

  const { data: favoritesData, isLoading: isLoadingFavs } = useListFavorites({
    query: { queryKey: ['/api/customers/me/favorites'], enabled: !!customer && defaultTab === 'favorites' }
  });

  // Auth Guard
  if (isCustomerAuthLoaded && !customer) {
    setLocation('/login');
    return null;
  }

  if (!customer) {
    return <div className="container p-8">جاري التحميل...</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'confirmed': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'preparing': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'shipped': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new': return 'جديد';
      case 'confirmed': return 'مؤكد';
      case 'preparing': return 'جاري التجهيز';
      case 'shipped': return 'تم الشحن';
      case 'out_for_delivery': return 'في الطريق إليك';
      case 'delivered': return 'تم التسليم';
      case 'cancelled': return 'ملغي';
      case 'returned': return 'مسترجع';
      default: return status;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-col md:flex-row items-start gap-8">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 shrink-0 space-y-4">
          <Card className="border-border/50 shadow-sm text-center pt-6">
            <div className="w-20 h-20 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto text-2xl font-bold mb-4 shadow-inner">
              {customer.name.charAt(0)}
            </div>
            <CardHeader className="pt-0 pb-4">
              <CardTitle className="text-lg">{customer.name}</CardTitle>
              <div className="text-sm text-muted-foreground" dir="ltr">{customer.mobile}</div>
            </CardHeader>
          </Card>
          
          <Button 
            variant="outline" 
            className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="h-4 w-4 ml-2" />
            تسجيل الخروج
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 w-full min-w-0">
          <Tabs defaultValue={defaultTab} onValueChange={(v) => setLocation(`/account?tab=${v}`)} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden mb-6 bg-muted/50 p-1 h-auto">
              <TabsTrigger value="orders" className="flex gap-2 py-2.5 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Package className="h-4 w-4" /> طلباتي
              </TabsTrigger>
              <TabsTrigger value="favorites" className="flex gap-2 py-2.5 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Heart className="h-4 w-4" /> المفضلة
              </TabsTrigger>
              <TabsTrigger value="addresses" className="flex gap-2 py-2.5 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <MapPin className="h-4 w-4" /> عناويني
              </TabsTrigger>
              <TabsTrigger value="profile" className="flex gap-2 py-2.5 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <User className="h-4 w-4" /> بياناتي
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="space-y-4 outline-none">
              <h2 className="text-xl font-bold mb-4">تاريخ الطلبات</h2>
              
              {isLoadingOrders ? (
                <div className="space-y-4">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
                </div>
              ) : ordersData?.items.length === 0 ? (
                <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed">
                  <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">لم تقم بأي طلبات بعد</p>
                  <Button variant="link" className="text-secondary mt-2" asChild>
                    <Link href="/catalog">ابدأ التسوق الآن</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {ordersData?.items.map(order => (
                    <Card key={order.id} className="border-border/50 shadow-sm overflow-hidden">
                      <div className="bg-muted/30 p-4 border-b flex flex-wrap gap-4 justify-between items-center">
                        <div>
                          <div className="text-sm text-muted-foreground mb-1">رقم الطلب</div>
                          <div className="font-bold font-mono">{order.orderNumber}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground mb-1">التاريخ</div>
                          <div className="font-medium" dir="ltr">{new Date(order.createdAt).toLocaleDateString('ar-EG')}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground mb-1">الإجمالي</div>
                          <div className="font-bold text-primary">{order.total} ج.م</div>
                        </div>
                        <div>
                          <Badge variant="outline" className={`px-3 py-1 ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </Badge>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/orders/${order.id}`}>التفاصيل</Link>
                        </Button>
                      </div>
                      <div className="p-4">
                        <div className="flex gap-4 overflow-x-auto pb-2">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 shrink-0 bg-muted/20 p-2 rounded-lg border">
                              <div className="w-10 h-14 bg-muted rounded overflow-hidden">
                                 {item.coverImage ? (
                                    <img src={item.coverImage} alt={item.nameAr} className="w-full h-full object-cover" />
                                  ) : (
                                    <BookOpen className="w-full h-full p-2 text-muted-foreground/50" />
                                  )}
                              </div>
                              <div className="text-sm max-w-[150px]">
                                <div className="font-semibold truncate">{item.nameAr}</div>
                                <div className="text-muted-foreground">الكمية: {item.quantity}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="favorites" className="outline-none">
               <h2 className="text-xl font-bold mb-4">قائمة المفضلة</h2>
               <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed">
                  <Heart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">المفضلة فارغة</p>
               </div>
            </TabsContent>

            <TabsContent value="addresses" className="outline-none">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">عناويني</h2>
                <Button size="sm">إضافة عنوان</Button>
              </div>
               <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed">
                  <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">لم تقم بإضافة عناوين بعد</p>
               </div>
            </TabsContent>

            <TabsContent value="profile" className="outline-none">
              <h2 className="text-xl font-bold mb-4">تعديل بياناتي</h2>
              <Card className="border-border/50">
                <CardContent className="p-6">
                  <p className="text-muted-foreground">نموذج تعديل البيانات هنا</p>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </div>
  );
}
