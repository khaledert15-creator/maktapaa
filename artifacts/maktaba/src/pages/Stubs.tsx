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
  const [form, setForm] = useState({ nameAr: '', nameEn: '', price: '', oldPrice: '', purchasePrice: '', sku: '', barcode: '', stockQuantity: '0', minStockLevel: '5', status: 'draft', descriptionShort: '', descriptionFull: '', author: '', schoolYear: '', bookType: '', internalNotes: '', freeShipping: false, freeShippingBadgeText: 'شحن مجاني', isFeatured: false, isBestSeller: false, isNew: false, seoTitle: '', seoDescription: '' });
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  useEffect(() => {
    if (product) {
      const extended = product as typeof product & { purchasePrice?: number | null; author?: string | null; freeShipping?: boolean; freeShippingBadgeText?: string | null; seoTitle?: string | null; seoDescription?: string | null; isOffer?: boolean };
      setForm({
      nameAr: product.nameAr, nameEn: product.nameEn || '', price: String(product.price), oldPrice: product.oldPrice ? String(product.oldPrice) : '', purchasePrice: extended.purchasePrice ? String(extended.purchasePrice) : '', sku: product.sku || '', barcode: product.barcode || '',
      stockQuantity: String(product.stockQuantity), minStockLevel: String(product.minStockLevel || 5),
      status: product.status, descriptionShort: product.descriptionShort || '', descriptionFull: product.descriptionFull || '', author: extended.author || '', schoolYear: product.schoolYear || '', bookType: product.bookType || '', internalNotes: product.internalNotes || '', freeShipping: extended.freeShipping || false, freeShippingBadgeText: extended.freeShippingBadgeText || 'شحن مجاني', isFeatured: product.isFeatured || false, isBestSeller: product.isBestSeller || false, isNew: product.isNew || false, seoTitle: extended.seoTitle || '', seoDescription: extended.seoDescription || '',
    }); }
  }, [product]);

  const uploadImages = async (savedProductId: number) => {
    if (!imageFiles.length) return;
    const body = new FormData();
    imageFiles.forEach(file => body.append('images', file));
    const response = await fetch(`/api/admin/products/${savedProductId}/images`, { method: 'POST', credentials: 'include', body });
    if (!response.ok) throw new Error('تعذر رفع الصور');
  };

  const done = async (saved: { id: number }) => {
    await uploadImages(saved.id);
    queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
    toast({ title: productId ? 'تم تحديث المنتج' : 'تمت إضافة المنتج' });
    navigate('/admin/products');
  };
  const failed = () => toast({ title: 'تعذر حفظ المنتج', description: 'راجع البيانات وحاول مرة أخرى', variant: 'destructive' });
  const create = useAdminCreateProduct({ mutation: { onSuccess: saved => void done(saved), onError: failed } });
  const update = useAdminUpdateProduct({ mutation: { onSuccess: saved => void done(saved), onError: failed } });

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!form.nameAr.trim() || Number(form.price) <= 0) {
      failed();
      return;
    }
    const data = {
      nameAr: form.nameAr.trim(), nameEn: form.nameEn || undefined, price: Number(form.price), oldPrice: Number(form.oldPrice) || undefined, sku: form.sku || `MK-${Date.now()}`, barcode: form.barcode || undefined,
      status: form.status as AdminProductInputStatus, minStockLevel: Number(form.minStockLevel),
      descriptionShort: form.descriptionShort || undefined, descriptionFull: form.descriptionFull || undefined,
      schoolYear: form.schoolYear || undefined, bookType: form.bookType || undefined,
      isFeatured: form.isFeatured, isBestSeller: form.isBestSeller, isNew: form.isNew,
      internalNotes: form.internalNotes || undefined,
      purchasePrice: Number(form.purchasePrice) || undefined, author: form.author || undefined,
      freeShipping: form.freeShipping, freeShippingBadgeText: form.freeShipping ? form.freeShippingBadgeText : undefined,
      seoTitle: form.seoTitle || undefined, seoDescription: form.seoDescription || undefined,
    };
    if (productId) update.mutate({ id: productId, data: data as Parameters<typeof update.mutate>[0]['data'] });
    else create.mutate({ data: { ...data, stockQuantity: Number(form.stockQuantity) } as Parameters<typeof create.mutate>[0]['data'] });
  };

  return <form onSubmit={submit} className="max-w-4xl space-y-6" dir="rtl">
    <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">{productId ? 'تعديل المنتج' : 'إضافة منتج'}</h1><Button variant="outline" asChild><Link href="/admin/products">رجوع</Link></Button></div>
    <Card><CardHeader><CardTitle>1. المعلومات الأساسية</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-2">
      <label className="space-y-2"><span>الاسم العربي *</span><Input value={form.nameAr} onChange={e => setForm(v => ({ ...v, nameAr: e.target.value }))} /></label>
      <label className="space-y-2"><span>الاسم الإنجليزي</span><Input dir="ltr" value={form.nameEn} onChange={e => setForm(v => ({ ...v, nameEn: e.target.value }))} /></label>
      <label className="space-y-2"><span>SKU (يُولد تلقائيًا إذا تُرك فارغًا)</span><Input dir="ltr" value={form.sku} onChange={e => setForm(v => ({ ...v, sku: e.target.value }))} /></label>
      <label className="space-y-2"><span>الباركود</span><Input dir="ltr" value={form.barcode} onChange={e => setForm(v => ({ ...v, barcode: e.target.value }))} /></label>
      <label className="space-y-2 md:col-span-2"><span>وصف مختصر</span><Textarea value={form.descriptionShort} onChange={e => setForm(v => ({ ...v, descriptionShort: e.target.value }))} /></label>
      <label className="space-y-2 md:col-span-2"><span>الوصف الكامل</span><Textarea rows={6} value={form.descriptionFull} onChange={e => setForm(v => ({ ...v, descriptionFull: e.target.value }))} /></label>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>2. التصنيف والأسعار</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-2">
      <label className="space-y-2"><span>السعر بالجنيه *</span><Input type="number" min="0.01" step="0.01" value={form.price} onChange={e => setForm(v => ({ ...v, price: e.target.value }))} /></label>
      <label className="space-y-2"><span>السعر القديم</span><Input type="number" min="0" value={form.oldPrice} onChange={e => setForm(v => ({ ...v, oldPrice: e.target.value }))} /></label>
      <label className="space-y-2"><span>سعر الشراء</span><Input type="number" min="0" value={form.purchasePrice} onChange={e => setForm(v => ({ ...v, purchasePrice: e.target.value }))} /></label>
      <label className="space-y-2"><span>المؤلف أو المدرس</span><Input value={form.author} onChange={e => setForm(v => ({ ...v, author: e.target.value }))} /></label>
      <label className="space-y-2"><span>السنة الدراسية</span><Input value={form.schoolYear} onChange={e => setForm(v => ({ ...v, schoolYear: e.target.value }))} /></label>
      <label className="space-y-2"><span>نوع الكتاب</span><Input value={form.bookType} onChange={e => setForm(v => ({ ...v, bookType: e.target.value }))} /></label>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>3. المخزون والنشر</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-2">
      {!productId && <label className="space-y-2"><span>المخزون الافتتاحي</span><Input type="number" min="0" value={form.stockQuantity} onChange={e => setForm(v => ({ ...v, stockQuantity: e.target.value }))} /></label>}
      <label className="space-y-2"><span>حد تنبيه المخزون</span><Input type="number" min="0" value={form.minStockLevel} onChange={e => setForm(v => ({ ...v, minStockLevel: e.target.value }))} /></label>
      <label className="space-y-2"><span>الحالة</span><Select value={form.status} onValueChange={status => setForm(v => ({ ...v, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">مسودة</SelectItem><SelectItem value="active">نشط</SelectItem><SelectItem value="archived">مؤرشف</SelectItem></SelectContent></Select></label>
      <div className="md:col-span-2 flex flex-wrap gap-5">{[['isFeatured','منتج مميز'],['isBestSeller','الأكثر مبيعًا'],['isNew','منتج جديد']].map(([key,label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={Boolean(form[key as keyof typeof form])} onChange={e => setForm(v => ({ ...v, [key]: e.target.checked }))}/>{label}</label>)}</div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>4. الصور</CardTitle></CardHeader><CardContent className="space-y-4">
      <Input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e => setImageFiles(Array.from(e.target.files || []))} />
      <p className="text-xs text-muted-foreground">حتى 10 صور، 8MB للصورة. تُحوّل تلقائيًا إلى WebP.</p>
      <div className="flex flex-wrap gap-3">{imageFiles.map(file => <div key={`${file.name}-${file.size}`} className="w-24"><img src={URL.createObjectURL(file)} alt={file.name} className="h-24 w-24 rounded object-cover"/><p className="truncate text-xs">{file.name}</p></div>)}</div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>5. الشحن المجاني</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-2">
      <label className="flex items-center gap-2"><input type="checkbox" checked={form.freeShipping} onChange={e => setForm(v => ({ ...v, freeShipping: e.target.checked }))}/>هذا المنتج يشمل شحنًا مجانيًا</label>
      <label className="space-y-2"><span>نص الشارة</span><Input disabled={!form.freeShipping} value={form.freeShippingBadgeText} onChange={e => setForm(v => ({ ...v, freeShippingBadgeText: e.target.value }))}/></label>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>6. SEO والملاحظات الداخلية</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-2">
      <label className="space-y-2"><span>عنوان SEO</span><Input value={form.seoTitle} onChange={e => setForm(v => ({ ...v, seoTitle: e.target.value }))}/></label>
      <label className="space-y-2"><span>وصف SEO</span><Input value={form.seoDescription} onChange={e => setForm(v => ({ ...v, seoDescription: e.target.value }))}/></label>
      <label className="space-y-2 md:col-span-2"><span>ملاحظات داخلية</span><Textarea value={form.internalNotes} onChange={e => setForm(v => ({ ...v, internalNotes: e.target.value }))}/></label>
    </CardContent></Card>
    <div className="flex gap-3"><Button type="submit" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'جاري الحفظ...' : form.status === 'draft' ? 'حفظ كمسودة' : 'حفظ ونشر'}</Button><Button type="button" variant="outline" onClick={() => navigate('/admin/products')}>إلغاء</Button></div>
  </form>;
}

export function AdminOrders() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const { data, isLoading } = useAdminListOrders({ page, limit: 20, q: query || undefined, status: status === 'all' ? undefined : status });
  return <div className="space-y-6" dir="rtl">
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-bold">إدارة الطلبات</h1><div className="flex flex-wrap gap-2"><Input className="w-72" placeholder="رقم الطلب أو العميل أو الهاتف" value={query} onChange={event => setQuery(event.target.value)} /><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل الحالات</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div>
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
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">الطلب {order.orderNumber}</h1><p className="text-muted-foreground">{new Date(order.createdAt).toLocaleString('ar-EG')}</p></div><div className="flex gap-2 print:hidden"><Button variant="outline" onClick={() => window.print()}>طباعة الفاتورة</Button><Button variant="outline" asChild><a href={`https://wa.me/2${order.mobile?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">واتساب</a></Button><Button variant="outline" asChild><Link href="/admin/orders">كل الطلبات</Link></Button></div></div>
    <div className="grid gap-6 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader><CardTitle>المنتجات</CardTitle></CardHeader><CardContent className="space-y-3">{order.items.map((item, index) => <div key={`${item.productId}-${index}`} className="flex justify-between border-b pb-3"><span>{item.nameAr} × {item.quantity}</span><strong>{item.subtotal.toFixed(2)} ج.م</strong></div>)}<div className="flex justify-between text-lg pt-2"><span>الإجمالي</span><strong>{order.total.toFixed(2)} ج.م</strong></div></CardContent></Card>
      <Card><CardHeader><CardTitle>بيانات العميل والشحن</CardTitle></CardHeader><CardContent className="space-y-2"><p className="font-bold">{order.customerName}</p><p dir="ltr" className="text-right">{order.mobile}</p><p>{order.governorate}، {order.city}</p><p>{order.detailedAddress}</p><p className="text-sm text-muted-foreground">الدفع عند الاستلام</p><hr/><p>تكلفة الشحن: <strong>{order.shippingCost || 0} ج.م</strong></p><p>خصم الكوبون: {order.couponDiscount || 0} ج.م</p></CardContent></Card></div>
    <Card><CardHeader><CardTitle>تحديث الحالة</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-3"><Select value={status || order.status} onValueChange={setStatus}><SelectTrigger className="w-60"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Button onClick={() => statusMutation.mutate({ id: orderId, data: { status: status || order.status } })} disabled={statusMutation.isPending}>حفظ الحالة</Button><div className="ms-auto flex gap-2"><Button variant="outline" onClick={() => cancellation.mutate({ id: orderId, data: { decision: 'rejected' } })}>رفض طلب الإلغاء</Button><Button variant="destructive" onClick={() => cancellation.mutate({ id: orderId, data: { decision: 'approved' } })}>الموافقة على الإلغاء</Button></div></CardContent></Card>
    <Card><CardHeader><CardTitle>سجل الحالة</CardTitle></CardHeader><CardContent className="space-y-3">{order.statusHistory?.map((entry, index) => <div key={index} className="border-r-2 border-primary pr-4"><strong>{statusLabels[entry.status] || entry.status}</strong><p className="text-sm text-muted-foreground">{entry.notes} — {new Date(entry.createdAt).toLocaleString('ar-EG')}</p></div>)}</CardContent></Card>
  </div>;
}
