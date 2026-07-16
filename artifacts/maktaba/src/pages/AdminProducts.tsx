import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAdminListProducts, useAdminDeleteProduct } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Eye, Filter } from "lucide-react";
import useDebounce from "@/hooks/use-debounce";

export default function AdminProducts() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: productsData, isLoading } = useAdminListProducts({
    page,
    limit: 20,
    q: debouncedSearch || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const deleteMutation = useAdminDeleteProduct({
    mutation: {
      onSuccess: () => {
        toast({ title: "تم الحذف", description: "تم حذف المنتج بنجاح" });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      },
      onError: () => {
        toast({ title: "خطأ", description: "لا يمكن حذف منتج مرتبط بطلبات سابقة", variant: "destructive" });
      }
    }
  });

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
      deleteMutation.mutate({ id });
    }
  };

  const runBulk = async (action: 'active' | 'draft' | 'archive') => {
    if (!selected.size) return;
    if (action === 'archive' && !confirm(`أرشفة ${selected.size} منتج؟`)) return;
    await Promise.all([...selected].map(id => fetch(`/api/admin/products/${id}`, {
      method: action === 'archive' ? 'DELETE' : 'PATCH', credentials: 'include',
      headers: action === 'archive' ? undefined : { 'content-type': 'application/json' },
      body: action === 'archive' ? undefined : JSON.stringify({ status: action }),
    })));
    setSelected(new Set());
    toast({ title: 'تم تنفيذ الإجراء الجماعي' });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'active': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">نشط</Badge>;
      case 'draft': return <Badge variant="outline" className="bg-gray-100 text-gray-800">مسودة</Badge>;
      case 'archived': return <Badge variant="secondary" className="bg-red-100 text-red-800">مؤرشف</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">إدارة المنتجات</h1>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus className="ml-2 h-4 w-4" />
            إضافة منتج
          </Link>
        </Button>
      </div>

      {selected.size > 0 && <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3"><strong>تم تحديد {selected.size}</strong><Button size="sm" onClick={() => void runBulk('active')}>تفعيل</Button><Button size="sm" variant="outline" onClick={() => void runBulk('draft')}>تحويل لمسودة</Button><Button size="sm" variant="destructive" onClick={() => void runBulk('archive')}>أرشفة</Button></div>}

      <div className="bg-card border rounded-lg p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="بحث بالاسم أو SKU..." 
            className="pl-3 pr-9" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-[200px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="تصفية بالحالة" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="draft">مسودة</SelectItem>
              <SelectItem value="archived">مؤرشف</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-10"><input type="checkbox" aria-label="تحديد كل المنتجات" onChange={event => setSelected(event.target.checked ? new Set(productsData?.items.map(item => item.id) || []) : new Set())} /></TableHead>
              <TableHead className="w-[80px]">صورة</TableHead>
              <TableHead>اسم الكتاب</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>السعر</TableHead>
              <TableHead>المخزون</TableHead>
              <TableHead>الشحن</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead className="text-left">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-12 w-10" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-[60px] rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 rounded-md float-left" /></TableCell>
                </TableRow>
              ))
            ) : productsData?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                  لا توجد منتجات تطابق بحثك
                </TableCell>
              </TableRow>
            ) : (
              productsData?.items.map((product) => (
                <TableRow key={product.id}>
                  <TableCell><input type="checkbox" checked={selected.has(product.id)} onChange={event => setSelected(current => { const next = new Set(current); if (event.target.checked) next.add(product.id); else next.delete(product.id); return next; })} /></TableCell>
                  <TableCell>
                    <div className="h-12 w-10 bg-muted rounded overflow-hidden">
                      {product.coverImage ? (
                        <img src={product.coverImage} alt={product.nameAr} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-primary/5" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{(product as typeof product & { freeShipping?: boolean }).freeShipping ? <Badge className="bg-emerald-100 text-emerald-800">مجاني</Badge> : <span className="text-muted-foreground">عادي</span>}</TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate" title={product.nameAr}>
                    {product.nameAr}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{product.sku || '-'}</TableCell>
                  <TableCell className="font-bold">{product.price} ج.م</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className={`font-bold ${product.stockQuantity <= (product.minStockLevel || 0) ? 'text-destructive' : ''}`}>
                        {product.stockQuantity}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(product.status)}</TableCell>
                  <TableCell className="text-left">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">فتح القائمة</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>إجراءات</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href={`/product/${product.slug}`} target="_blank" className="cursor-pointer">
                            <Eye className="mr-2 h-4 w-4" /> عرض في المتجر
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/products/${product.id}/edit`} className="cursor-pointer">
                            <Pencil className="mr-2 h-4 w-4" /> تعديل البيانات
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive cursor-pointer"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> حذف المنتج
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {productsData && productsData.total > productsData.limit && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            عرض {(page - 1) * 20 + 1} إلى {Math.min(page * 20, productsData.total)} من {productsData.total} منتج
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              السابق
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= Math.ceil(productsData.total / 20)}
            >
              التالي
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
