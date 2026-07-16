import { FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...init, headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), ...init?.headers } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'تعذر الاتصال بالخادم');
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function useResource<T>(url: string) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await api<T>(url)); } catch (reason) { setError(reason instanceof Error ? reason.message : 'حدث خطأ'); } finally { setLoading(false); }
  }, [url]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload };
}

function PageState({ loading, error, empty, children }: { loading: boolean; error: string; empty: boolean; children: ReactNode }) {
  if (loading) return <Card><CardContent className="py-16 text-center">جاري تحميل البيانات...</CardContent></Card>;
  if (error) return <Card className="border-destructive/30"><CardContent className="py-16 text-center"><p className="font-bold text-destructive">تعذر تحميل البيانات</p><p className="mt-2 text-sm text-muted-foreground">{error}</p><p className="mt-3 text-xs">شغّل PostgreSQL وخادم API على المنفذ 5001 لعرض البيانات الحقيقية.</p></CardContent></Card>;
  if (empty) return <Card><CardContent className="py-16 text-center text-muted-foreground">لا توجد بيانات بعد</CardContent></Card>;
  return <>{children}</>;
}

type Customer = { id: number; name: string; email?: string; mobile: string; isBlocked: boolean; totalOrders?: number; totalSpend?: number; internalNotes?: string };
export function AdminCustomers() {
  const [q, setQ] = useState(''); const resource = useResource<{ items: Customer[] }>('/api/admin/customers?limit=100');
  const rows = resource.data?.items.filter(row => `${row.name} ${row.mobile} ${row.email || ''}`.includes(q)) || [];
  return <section className="space-y-6"><h1 className="text-2xl font-bold">إدارة العملاء</h1><Input placeholder="بحث بالاسم أو الهاتف أو البريد" value={q} onChange={event => setQ(event.target.value)} /><PageState loading={resource.loading} error={resource.error} empty={!rows.length}><Card><Table><TableHeader><TableRow><TableHead>العميل</TableHead><TableHead>الهاتف</TableHead><TableHead>الطلبات</TableHead><TableHead>إجمالي المشتريات</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader><TableBody>{rows.map(row => <TableRow key={row.id}><TableCell><strong>{row.name}</strong><div className="text-xs text-muted-foreground">{row.email}</div></TableCell><TableCell dir="ltr" className="text-right">{row.mobile}</TableCell><TableCell>{row.totalOrders || 0}</TableCell><TableCell>{row.totalSpend || 0} ج.م</TableCell><TableCell><Badge variant={row.isBlocked ? 'destructive' : 'outline'}>{row.isBlocked ? 'محظور' : 'نشط'}</Badge></TableCell></TableRow>)}</TableBody></Table></Card></PageState></section>;
}

type ProductRow = { id: number; nameAr: string; sku?: string; coverImage?: string; stockQuantity: number; reservedQuantity?: number; minStockLevel?: number };
export function AdminInventory() {
  const resource = useResource<{ items: ProductRow[] }>('/api/admin/products?limit=100'); const { toast } = useToast();
  const adjust = async (product: ProductRow, delta: number) => { const reason = window.prompt('اكتب سبب حركة المخزون'); if (!reason) return; try { await api(`/api/admin/products/${product.id}/stock`, { method: 'PATCH', body: JSON.stringify({ quantity: Math.abs(delta), movementType: delta > 0 ? 'manual_increase' : 'manual_decrease', reason }) }); toast({ title: 'تم تسجيل حركة المخزون' }); await resource.reload(); } catch (error) { toast({ title: 'تعذر تعديل المخزون', description: String(error), variant: 'destructive' }); } };
  const rows = resource.data?.items || [];
  return <section className="space-y-6"><h1 className="text-2xl font-bold">المخزون وحركاته</h1><PageState loading={resource.loading} error={resource.error} empty={!rows.length}><Card><Table><TableHeader><TableRow><TableHead>المنتج</TableHead><TableHead>SKU</TableHead><TableHead>الحالي</TableHead><TableHead>المحجوز</TableHead><TableHead>المتاح</TableHead><TableHead>الحالة</TableHead><TableHead>تعديل</TableHead></TableRow></TableHeader><TableBody>{rows.map(row => { const available = row.stockQuantity - (row.reservedQuantity || 0); return <TableRow key={row.id}><TableCell>{row.nameAr}</TableCell><TableCell>{row.sku || '-'}</TableCell><TableCell>{row.stockQuantity}</TableCell><TableCell>{row.reservedQuantity || 0}</TableCell><TableCell>{available}</TableCell><TableCell><Badge variant={available <= (row.minStockLevel || 0) ? 'destructive' : 'outline'}>{available === 0 ? 'نفد' : available <= (row.minStockLevel || 0) ? 'منخفض' : 'جيد'}</Badge></TableCell><TableCell className="space-x-2 space-x-reverse"><Button size="sm" onClick={() => void adjust(row, 1)}>زيادة</Button><Button size="sm" variant="outline" onClick={() => void adjust(row, -1)}>نقص</Button></TableCell></TableRow>; })}</TableBody></Table></Card></PageState></section>;
}

type Coupon = { id: number; code: string; type: string; value: number; usedCount: number; maxUses?: number; isActive: boolean; startDate?: string; endDate?: string };
export function AdminCoupons() {
  const resource = useResource<{ items: Coupon[] }>('/api/admin/coupons?limit=100'); const { toast } = useToast();
  const create = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await api('/api/admin/coupons', { method: 'POST', body: JSON.stringify({ code: form.get('code'), type: form.get('type'), value: Number(form.get('value')), isActive: true }) }); event.currentTarget.reset(); toast({ title: 'تم إنشاء الكوبون' }); await resource.reload(); } catch (error) { toast({ title: 'تعذر إنشاء الكوبون', description: String(error), variant: 'destructive' }); } };
  const rows = resource.data?.items || [];
  return <section className="space-y-6"><h1 className="text-2xl font-bold">إدارة الكوبونات</h1><Card><CardHeader><CardTitle>كوبون جديد</CardTitle></CardHeader><CardContent><form onSubmit={create} className="grid gap-3 md:grid-cols-4"><Input name="code" placeholder="الكود" required /><select name="type" className="h-10 rounded-md border bg-background px-3"><option value="percentage">نسبة مئوية</option><option value="fixed">قيمة ثابتة</option><option value="free_shipping">شحن مجاني</option></select><Input name="value" type="number" min="0" placeholder="القيمة" required /><Button type="submit">إضافة</Button></form></CardContent></Card><PageState loading={resource.loading} error={resource.error} empty={!rows.length}><Card><Table><TableHeader><TableRow><TableHead>الكود</TableHead><TableHead>النوع</TableHead><TableHead>القيمة</TableHead><TableHead>الاستخدام</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader><TableBody>{rows.map(row => <TableRow key={row.id}><TableCell className="font-mono font-bold">{row.code}</TableCell><TableCell>{row.type === 'free_shipping' ? 'شحن مجاني' : row.type === 'percentage' ? 'نسبة' : 'ثابت'}</TableCell><TableCell>{row.value}</TableCell><TableCell>{row.usedCount}/{row.maxUses || '∞'}</TableCell><TableCell><Badge variant="outline">{row.isActive ? 'نشط' : 'متوقف'}</Badge></TableCell></TableRow>)}</TableBody></Table></Card></PageState></section>;
}

type Governorate = { id: number; nameAr: string; nameEn?: string; shippingCost: number; freeShippingThreshold?: number; estimatedDays: number; isActive: boolean; updatedAt: string };
export function AdminShipping() {
  const resource = useResource<Governorate[]>('/api/admin/shipping/governorates'); const { toast } = useToast(); const [drafts, setDrafts] = useState<Record<number, Governorate>>({});
  useEffect(() => { if (resource.data) setDrafts(Object.fromEntries(resource.data.map(row => [row.id, row]))); }, [resource.data]);
  const saveAll = async () => { try { await api('/api/admin/shipping/governorates', { method: 'PATCH', body: JSON.stringify(Object.values(drafts)) }); toast({ title: 'تم حفظ أسعار الشحن' }); await resource.reload(); } catch (error) { toast({ title: 'تعذر الحفظ', description: String(error), variant: 'destructive' }); } };
  const rows = Object.values(drafts);
  return <section className="space-y-6"><div className="flex justify-between"><div><h1 className="text-2xl font-bold">الشحن والمحافظات</h1><p className="text-muted-foreground">تعديل جماعي لأسعار الشحن وحدود الشحن المجاني</p></div><Button onClick={() => void saveAll()} disabled={!rows.length}>حفظ التغييرات</Button></div><PageState loading={resource.loading} error={resource.error} empty={!rows.length}><Card><Table><TableHeader><TableRow><TableHead>المحافظة</TableHead><TableHead>سعر الشحن</TableHead><TableHead>حد المجاني</TableHead><TableHead>مدة التوصيل</TableHead><TableHead>نشط</TableHead><TableHead>آخر تحديث</TableHead></TableRow></TableHeader><TableBody>{rows.map(row => <TableRow key={row.id}><TableCell><strong>{row.nameAr}</strong><div className="text-xs">{row.nameEn}</div></TableCell><TableCell><Input type="number" className="w-28" value={row.shippingCost} onChange={e => setDrafts(v => ({ ...v, [row.id]: { ...row, shippingCost: Number(e.target.value) } }))} /></TableCell><TableCell><Input type="number" className="w-32" value={row.freeShippingThreshold || ''} onChange={e => setDrafts(v => ({ ...v, [row.id]: { ...row, freeShippingThreshold: Number(e.target.value) || undefined } }))} /></TableCell><TableCell>{row.estimatedDays} أيام</TableCell><TableCell><input type="checkbox" checked={row.isActive} onChange={e => setDrafts(v => ({ ...v, [row.id]: { ...row, isActive: e.target.checked } }))} /></TableCell><TableCell>{new Date(row.updatedAt).toLocaleDateString('ar-EG')}</TableCell></TableRow>)}</TableBody></Table></Card></PageState></section>;
}

type Classification = { id: number; nameAr: string; nameEn?: string; isActive: boolean };
export function AdminClassifications() {
  const [section, setSection] = useState('stages'); const resource = useResource<Classification[]>(`/api/admin/${section}`); const { toast } = useToast();
  const add = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await api(`/api/admin/${section}`, { method: 'POST', body: JSON.stringify({ nameAr: form.get('nameAr'), nameEn: form.get('nameEn'), isActive: true }) }); event.currentTarget.reset(); toast({ title: 'تمت الإضافة' }); await resource.reload(); } catch (error) { toast({ title: 'تعذر الإضافة', description: String(error), variant: 'destructive' }); } };
  return <section className="space-y-6"><h1 className="text-2xl font-bold">التصنيفات التعليمية</h1><div className="flex flex-wrap gap-2">{[['stages','المراحل'],['grades','الصفوف'],['subjects','المواد'],['publishers','دور النشر']].map(([value,label]) => <Button key={value} variant={section === value ? 'default' : 'outline'} onClick={() => setSection(value)}>{label}</Button>)}</div><Card><CardContent className="pt-6"><form onSubmit={add} className="flex flex-col gap-3 md:flex-row"><Input name="nameAr" placeholder="الاسم العربي" required /><Input name="nameEn" placeholder="الاسم الإنجليزي" /><Button>إضافة</Button></form></CardContent></Card><PageState loading={resource.loading} error={resource.error} empty={!resource.data?.length}><Card><Table><TableHeader><TableRow><TableHead>العربي</TableHead><TableHead>الإنجليزي</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader><TableBody>{resource.data?.map(row => <TableRow key={row.id}><TableCell>{row.nameAr}</TableCell><TableCell>{row.nameEn || '-'}</TableCell><TableCell>{row.isActive ? 'نشط' : 'متوقف'}</TableCell></TableRow>)}</TableBody></Table></Card></PageState></section>;
}

type Setting = { id: number; key: string; value?: string };
export function AdminContent() {
  const resource = useResource<Setting[]>('/api/admin/content/settings'); const { toast } = useToast(); const [drafts, setDrafts] = useState<Record<string,string>>({});
  useEffect(() => { if (resource.data) setDrafts(Object.fromEntries(resource.data.map(row => [row.key, row.value || '']))); }, [resource.data]);
  const defaults = ['announcement_bar','whatsapp','phone','email','facebook','instagram','shipping_policy','return_policy'];
  const keys = Array.from(new Set([...defaults, ...Object.keys(drafts)]));
  const save = async (key: string) => { try { await api(`/api/admin/content/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value: drafts[key] || '' }) }); toast({ title: 'تم حفظ المحتوى' }); } catch (error) { toast({ title: 'تعذر الحفظ', description: String(error), variant: 'destructive' }); } };
  return <section className="space-y-6"><h1 className="text-2xl font-bold">إدارة المحتوى</h1><PageState loading={resource.loading} error={resource.error} empty={false}><div className="grid gap-4 md:grid-cols-2">{keys.map(key => <Card key={key}><CardHeader><CardTitle className="text-base">{key}</CardTitle></CardHeader><CardContent className="space-y-3"><Textarea value={drafts[key] || ''} onChange={e => setDrafts(v => ({ ...v, [key]: e.target.value }))} /><Button size="sm" onClick={() => void save(key)}>حفظ</Button></CardContent></Card>)}</div></PageState></section>;
}

type Report = { totalRevenue: number; totalOrders: number; avgOrderValue: number; data: { date: string; amount: number; orderCount: number }[] };
export function AdminReports() {
  const to = new Date().toISOString().slice(0,10); const fromDate = new Date(); fromDate.setDate(fromDate.getDate()-30); const from = fromDate.toISOString().slice(0,10); const resource = useResource<Report>(`/api/admin/reports/sales?dateFrom=${from}&dateTo=${to}`);
  return <section className="space-y-6"><h1 className="text-2xl font-bold">التقارير</h1><PageState loading={resource.loading} error={resource.error} empty={!resource.data}><div className="grid gap-4 md:grid-cols-3"><Card><CardContent className="pt-6"><p>المبيعات</p><strong className="text-2xl">{resource.data?.totalRevenue || 0} ج.م</strong></CardContent></Card><Card><CardContent className="pt-6"><p>الطلبات</p><strong className="text-2xl">{resource.data?.totalOrders || 0}</strong></CardContent></Card><Card><CardContent className="pt-6"><p>متوسط الطلب</p><strong className="text-2xl">{resource.data?.avgOrderValue || 0} ج.م</strong></CardContent></Card></div><Card><Table><TableHeader><TableRow><TableHead>التاريخ</TableHead><TableHead>المبيعات</TableHead><TableHead>الطلبات</TableHead></TableRow></TableHeader><TableBody>{resource.data?.data.map(row => <TableRow key={row.date}><TableCell>{row.date}</TableCell><TableCell>{row.amount} ج.م</TableCell><TableCell>{row.orderCount}</TableCell></TableRow>)}</TableBody></Table></Card></PageState></section>;
}

type Employee = { id: number; name: string; email: string; role: string; permissions: string[]; isActive: boolean };
export function AdminEmployees() {
  const resource = useResource<Employee[]>('/api/admin/employees'); const audits = useResource<{ id:number; description:string; action:string; createdAt:string }[]>('/api/admin/audit-logs'); const { toast } = useToast();
  const create = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await api('/api/admin/employees', { method:'POST', body:JSON.stringify({ name:form.get('name'), email:form.get('email'), password:form.get('password'), role:form.get('role'), permissions:[] }) }); event.currentTarget.reset(); toast({title:'تمت إضافة الموظف'}); await resource.reload(); } catch(error) { toast({title:'تعذر إضافة الموظف',description:String(error),variant:'destructive'}); } };
  return <section className="space-y-6"><h1 className="text-2xl font-bold">الموظفون والصلاحيات</h1><Card><CardHeader><CardTitle>موظف جديد</CardTitle></CardHeader><CardContent><form onSubmit={create} className="grid gap-3 md:grid-cols-4"><Input name="name" placeholder="الاسم" required/><Input name="email" type="email" placeholder="البريد" required/><Input name="password" type="password" placeholder="كلمة المرور" required/><div className="flex gap-2"><select name="role" className="h-10 flex-1 rounded-md border bg-background px-2"><option value="sales">مبيعات</option><option value="warehouse">مخزن</option><option value="customer_service">خدمة عملاء</option><option value="administrator">مدير</option></select><Button>إضافة</Button></div></form></CardContent></Card><PageState loading={resource.loading} error={resource.error} empty={!resource.data?.length}><Card><Table><TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>البريد</TableHead><TableHead>الدور</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader><TableBody>{resource.data?.map(row=><TableRow key={row.id}><TableCell>{row.name}</TableCell><TableCell>{row.email}</TableCell><TableCell>{row.role}</TableCell><TableCell>{row.isActive?'نشط':'متوقف'}</TableCell></TableRow>)}</TableBody></Table></Card></PageState><h2 className="text-xl font-bold">أحدث إجراءات الموظفين</h2><PageState loading={audits.loading} error={audits.error} empty={!audits.data?.length}><Card><CardContent className="divide-y">{audits.data?.slice(0,20).map(row=><div key={row.id} className="py-3"><strong>{row.description}</strong><p className="text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString('ar-EG')}</p></div>)}</CardContent></Card></PageState></section>;
}
