import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import {
  AdminProductInputStatus,
  useAdminCreateProduct,
  useAdminGetOrder,
  useAdminGetProduct,
  useAdminHandleCancellation,
  useAdminListOrders,
  useAdminUpdateOrderStatus,
  useAdminUpdateProduct,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

const statusLabels: Record<string, string> = {
  new: 'جديد', awaiting_confirmation: 'بانتظار التأكيد', confirmed: 'مؤكد', preparing: 'جاري التجهيز',
  ready_for_shipping: 'جاهز للشحن', shipped: 'تم الشحن', out_for_delivery: 'خرج للتوصيل',
  delivered: 'تم التسليم', delivery_failed: 'تعذر التسليم', returned: 'مرتجع', cancelled: 'ملغي',
};

export function AdminProductForm() {
  const { id } = useParams<{ id?: string }>();
  const productId = id ? Number(id) : 0;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: product } = useAdminGetProduct(productId, {
    query: { queryKey: [`/api/admin/products/${productId}`], enabled: productId > 0 },
  });
  const [form, setForm] = useState({ nameAr: '', price: '', sku: '', stockQuantity: '0', minStockLevel: '5', status: 'draft', descriptionShort: '', coverImage: '' });

  useEffect(() => {
    if (product) setForm({
      nameAr: product.nameAr, price: String(product.price), sku: product.sku || '',
      stockQuantity: String(product.stockQuantity), minStockLevel: String(product.minStockLevel || 5),
      status: product.status, descriptionShort: product.descriptionShort || '', coverImage: product.coverImage || '',
    });
  }, [product]);

  const done = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
    toast({ title: productId ? 'تم تحديث المنتج' : 'تمت إضافة المنتج' });
    navigate('/admin/products');
  };
  const failed = () => toast({ title: 'تعذر حفظ المنتج', description: 'راجع البيانات وحاول مرة أخرى', variant: 'destructive' });
  const create = useAdminCreateProduct({ mutation: { onSuccess: done, onError: failed } });
  const update = useAdminUpdateProduct({ mutation: { onSuccess: done, onError: failed } });

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!form.nameAr.trim() || Number(form.price) <= 0) {
      failed();
      return;
    }
    const data = {
      nameAr: form.nameAr.trim(), price: Number(form.price), sku: form.sku || undefined,
      status: form.status as AdminProductInputStatus, minStockLevel: Number(form.minStockLevel),
      descriptionShort: form.descriptionShort || undefined, coverImage: form.coverImage || undefined,
    };
    if (productId) update.mutate({ id: productId, data });
    else create.mutate({ data: { ...data, stockQuantity: Number(form.stockQuantity) } });
  };

  return <form onSubmit={submit} className="max-w-4xl space-y-6" dir="rtl">
    <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">{productId ? 'تعديل المنتج' : 'إضافة منتج'}</h1><Button variant="outline" asChild><Link href="/admin/products">رجوع</Link></Button></div>
    <Card><CardHeader><CardTitle>بيانات الكتاب</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-2">
      <label className="space-y-2"><span>الاسم العربي *</span><Input value={form.nameAr} onChange={e => setForm(v => ({ ...v, nameAr: e.target.value }))} /></label>
      <label className="space-y-2"><span>السعر بالجنيه *</span><Input type="number" min="0.01" step="0.01" value={form.price} onChange={e => setForm(v => ({ ...v, price: e.target.value }))} /></label>
      <label className="space-y-2"><span>SKU</span><Input dir="ltr" value={form.sku} onChange={e => setForm(v => ({ ...v, sku: e.target.value }))} /></label>
      {!productId && <label className="space-y-2"><span>المخزون الافتتاحي</span><Input type="number" min="0" value={form.stockQuantity} onChange={e => setForm(v => ({ ...v, stockQuantity: e.target.value }))} /></label>}
      <label className="space-y-2"><span>حد تنبيه المخزون</span><Input type="number" min="0" value={form.minStockLevel} onChange={e => setForm(v => ({ ...v, minStockLevel: e.target.value }))} /></label>
      <label className="space-y-2"><span>الحالة</span><Select value={form.status} onValueChange={status => setForm(v => ({ ...v, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">مسودة</SelectItem><SelectItem value="active">نشط</SelectItem><SelectItem value="archived">مؤرشف</SelectItem></SelectContent></Select></label>
      <label className="space-y-2 md:col-span-2"><span>رابط صورة الغلاف</span><Input dir="ltr" value={form.coverImage} onChange={e => setForm(v => ({ ...v, coverImage: e.target.value }))} /></label>
      <label className="space-y-2 md:col-span-2"><span>وصف مختصر</span><Textarea value={form.descriptionShort} onChange={e => setForm(v => ({ ...v, descriptionShort: e.target.value }))} /></label>
    </CardContent></Card>
    <Button type="submit" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'جاري الحفظ...' : 'حفظ المنتج'}</Button>
  </form>;
}

export function AdminOrders() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const { data, isLoading } = useAdminListOrders({ page, limit: 20, status: status === 'all' ? undefined : status });
  return <div className="space-y-6" dir="rtl">
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-bold">إدارة الطلبات</h1><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل الحالات</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
    <Card><Table><TableHeader><TableRow><TableHead>رقم الطلب</TableHead><TableHead>العميل</TableHead><TableHead>المحافظة</TableHead><TableHead>الإجمالي</TableHead><TableHead>الحالة</TableHead><TableHead>التاريخ</TableHead></TableRow></TableHeader><TableBody>
      {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-12">جاري التحميل...</TableCell></TableRow> : data?.items.map(order => <TableRow key={order.id} className="cursor-pointer"><TableCell><Link className="font-mono font-bold text-primary" href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link></TableCell><TableCell>{order.customerName}<div className="text-xs text-muted-foreground" dir="ltr">{order.mobile}</div></TableCell><TableCell>{order.governorate}</TableCell><TableCell>{order.total.toFixed(2)} ج.م</TableCell><TableCell><Badge variant="outline">{statusLabels[order.status] || order.status}</Badge></TableCell><TableCell>{new Date(order.createdAt).toLocaleDateString('ar-EG')}</TableCell></TableRow>)}
      {!isLoading && !data?.items.length && <TableRow><TableCell colSpan={6} className="text-center py-12">لا توجد طلبات</TableCell></TableRow>}
    </TableBody></Table></Card>
    {data && data.total > data.limit && <div className="flex justify-between"><Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>السابق</Button><span>صفحة {page}</span><Button variant="outline" disabled={page * data.limit >= data.total} onClick={() => setPage(p => p + 1)}>التالي</Button></div>}
  </div>;
}

export function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: order, isLoading } = useAdminGetOrder(orderId, { query: { queryKey: [`/api/admin/orders/${orderId}`], enabled: orderId > 0 } });
  const [status, setStatus] = useState('');
  const refresh = () => queryClient.invalidateQueries({ queryKey: [`/api/admin/orders/${orderId}`] });
  const statusMutation = useAdminUpdateOrderStatus({ mutation: { onSuccess: () => { refresh(); toast({ title: 'تم تحديث حالة الطلب' }); }, onError: () => toast({ title: 'تعذر تحديث الطلب', variant: 'destructive' }) } });
  const cancellation = useAdminHandleCancellation({ mutation: { onSuccess: () => { refresh(); toast({ title: 'تم تسجيل قرار طلب الإلغاء' }); }, onError: () => toast({ title: 'لا يوجد طلب إلغاء قيد المراجعة', variant: 'destructive' }) } });
  if (isLoading || !order) return <div className="py-16 text-center">جاري تحميل الطلب...</div>;
  return <div className="space-y-6" dir="rtl">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">الطلب {order.orderNumber}</h1><p className="text-muted-foreground">{new Date(order.createdAt).toLocaleString('ar-EG')}</p></div><Button variant="outline" asChild><Link href="/admin/orders">كل الطلبات</Link></Button></div>
    <div className="grid gap-6 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader><CardTitle>المنتجات</CardTitle></CardHeader><CardContent className="space-y-3">{order.items.map((item, index) => <div key={`${item.productId}-${index}`} className="flex justify-between border-b pb-3"><span>{item.nameAr} × {item.quantity}</span><strong>{item.subtotal.toFixed(2)} ج.م</strong></div>)}<div className="flex justify-between text-lg pt-2"><span>الإجمالي</span><strong>{order.total.toFixed(2)} ج.م</strong></div></CardContent></Card>
      <Card><CardHeader><CardTitle>بيانات العميل</CardTitle></CardHeader><CardContent className="space-y-2"><p className="font-bold">{order.customerName}</p><p dir="ltr" className="text-right">{order.mobile}</p><p>{order.governorate}، {order.city}</p><p>{order.detailedAddress}</p><p className="text-sm text-muted-foreground">الدفع عند الاستلام</p></CardContent></Card></div>
    <Card><CardHeader><CardTitle>تحديث الحالة</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-3"><Select value={status || order.status} onValueChange={setStatus}><SelectTrigger className="w-60"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Button onClick={() => statusMutation.mutate({ id: orderId, data: { status: status || order.status } })} disabled={statusMutation.isPending}>حفظ الحالة</Button><div className="ms-auto flex gap-2"><Button variant="outline" onClick={() => cancellation.mutate({ id: orderId, data: { decision: 'rejected' } })}>رفض طلب الإلغاء</Button><Button variant="destructive" onClick={() => cancellation.mutate({ id: orderId, data: { decision: 'approved' } })}>الموافقة على الإلغاء</Button></div></CardContent></Card>
    <Card><CardHeader><CardTitle>سجل الحالة</CardTitle></CardHeader><CardContent className="space-y-3">{order.statusHistory?.map((entry, index) => <div key={index} className="border-r-2 border-primary pr-4"><strong>{statusLabels[entry.status] || entry.status}</strong><p className="text-sm text-muted-foreground">{entry.notes} — {new Date(entry.createdAt).toLocaleString('ar-EG')}</p></div>)}</CardContent></Card>
  </div>;
}
