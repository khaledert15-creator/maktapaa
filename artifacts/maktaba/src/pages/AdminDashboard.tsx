import { useState } from "react";
import { Link } from "wouter";
import { 
  useGetAdminDashboardSummary, 
  useGetAdminSalesChart, 
  useGetAdminRecentOrders, 
  useGetAdminTopProducts,
  useGetAdminLowStockProducts 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  DollarSign, 
  ShoppingCart, 
  PackageX, 
  TrendingUp, 
  Users, 
  Clock, 
  AlertTriangle,
  ArrowUpRight
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function AdminDashboard() {
  const [chartPeriod, setChartPeriod] = useState<"7d" | "30d" | "90d" | "365d">("7d");
  
  const { data: summary, isLoading: isLoadingSummary } = useGetAdminDashboardSummary();
  const { data: chartData, isLoading: isLoadingChart } = useGetAdminSalesChart({ period: chartPeriod });
  const { data: recentOrders, isLoading: isLoadingOrders } = useGetAdminRecentOrders();
  const { data: topProducts, isLoading: isLoadingTopProducts } = useGetAdminTopProducts();
  const { data: lowStock, isLoading: isLoadingLowStock } = useGetAdminLowStockProducts();

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
      case 'delivered': return 'تم التسليم';
      case 'cancelled': return 'ملغي';
      default: return status;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">لوحة التحكم</h1>
        <p className="text-muted-foreground mt-2">نظرة عامة على أداء المتجر والمبيعات</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مبيعات اليوم</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{summary?.salesToday?.toLocaleString()} ج.م</div>
            )}
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مبيعات الشهر</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{summary?.salesThisMonth?.toLocaleString()} ج.م</div>
            )}
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الطلبات الجديدة</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{summary?.newOrders}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">بانتظار التأكيد والتجهيز</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">نواقص المخزون</CardTitle>
            <PackageX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold text-destructive">{summary?.outOfStockCount}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">منتجات انتهت كميتها</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Sales Chart */}
        <Card className="col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>المبيعات</CardTitle>
            </div>
            <Select value={chartPeriod} onValueChange={(v: any) => setChartPeriod(v)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="الفترة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">آخر 7 أيام</SelectItem>
                <SelectItem value="30d">آخر 30 يوم</SelectItem>
                <SelectItem value="90d">آخر 3 شهور</SelectItem>
                <SelectItem value="365d">آخر سنة</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="px-2">
            {isLoadingChart ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="h-[300px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: '#888', fontSize: 12 }}
                      tickMargin={10}
                      tickFormatter={(val) => {
                        const date = new Date(val);
                        return `${date.getDate()}/${date.getMonth() + 1}`;
                      }}
                    />
                    <YAxis 
                      tick={{ fill: '#888', fontSize: 12 }}
                      tickMargin={10}
                      tickFormatter={(val) => `${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value} ج.م`, 'المبيعات']}
                      labelFormatter={(label) => new Date(label as string).toLocaleDateString('ar-EG')}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#0ea5e9" 
                      fill="#0ea5e9" 
                      fillOpacity={0.2} 
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              تنبيهات المخزون
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingLowStock ? (
              <div className="space-y-4">
                {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : lowStock?.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                لا توجد منتجات ناقصة المخزون
              </div>
            ) : (
              <div className="space-y-4">
                {lowStock?.slice(0, 5).map(item => (
                  <div key={item.productId} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium line-clamp-1">{item.nameAr}</p>
                      <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                    </div>
                    <Badge variant={item.stockQuantity === 0 ? "destructive" : "secondary"}>
                      المتبقي: {item.stockQuantity}
                    </Badge>
                  </div>
                ))}
                {lowStock && lowStock.length > 5 && (
                  <Button variant="outline" className="w-full" size="sm" asChild>
                    <Link href="/admin/inventory">عرض كل النواقص</Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>أحدث الطلبات</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/orders">الكل <ArrowUpRight className="mr-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingOrders ? (
              <div className="space-y-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الطلب</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>القيمة</TableHead>
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentOrders?.slice(0, 5).map(order => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono font-medium">{order.orderNumber}</TableCell>
                        <TableCell>{order.customerName}</TableCell>
                        <TableCell className="font-bold">{order.total} ج.م</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] px-2 py-0 h-5 ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>الأكثر مبيعاً</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/reports">التقارير <ArrowUpRight className="mr-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingTopProducts ? (
              <div className="space-y-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {topProducts?.slice(0, 5).map((product, idx) => (
                  <div key={product.productId} className="flex items-center gap-4 border-b pb-3 last:border-0 last:pb-0">
                    <div className="font-bold text-muted-foreground w-4">{idx + 1}</div>
                    <div className="w-10 h-12 bg-muted rounded overflow-hidden shrink-0">
                      {product.coverImage ? (
                        <img src={product.coverImage} alt={product.nameAr} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-primary/10" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold line-clamp-1">{product.nameAr}</p>
                      <p className="text-xs text-muted-foreground">{product.soldCount} نسخة مباعة</p>
                    </div>
                    <div className="font-bold text-sm text-primary">
                      {product.revenue?.toLocaleString()} ج.م
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
