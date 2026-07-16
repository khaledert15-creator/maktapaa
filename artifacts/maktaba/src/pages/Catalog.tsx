import { useState } from "react";
import { useListProducts, useListStages, useListPublishers } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Filter, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { Link } from "wouter";

export default function Catalog() {
  const searchParams = new URLSearchParams(window.location.search);
  
  const [page, setPage] = useState(1);
  const [stageId, setStageId] = useState<number | undefined>(searchParams.get('stageId') ? Number(searchParams.get('stageId')) : undefined);
  const [publisherId, setPublisherId] = useState<number | undefined>(searchParams.get('publisherId') ? Number(searchParams.get('publisherId')) : undefined);
  const [educationType, setEducationType] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<any>('newest');

  const { data: productsData, isLoading } = useListProducts({
    page,
    limit: 24,
    stageId,
    publisherId,
    educationType,
    sortBy
  });

  const { data: stages } = useListStages();
  const { data: publishers } = useListPublishers();

  const resetFilters = () => {
    setStageId(undefined);
    setPublisherId(undefined);
    setEducationType(undefined);
    setPage(1);
  };

  const FilterSidebar = () => (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg">تصفية النتائج</h3>
        <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground h-8">
          إعادة ضبط <X className="h-3 w-3 ml-1" />
        </Button>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold text-sm border-b pb-2">المرحلة الدراسية</h4>
        <div className="space-y-2">
          {stages?.map(stage => (
            <div key={stage.id} className="flex items-center gap-2">
              <Checkbox 
                id={`stage-${stage.id}`} 
                checked={stageId === stage.id}
                onCheckedChange={(checked) => setStageId(checked ? stage.id : undefined)}
              />
              <Label htmlFor={`stage-${stage.id}`} className="cursor-pointer">{stage.nameAr}</Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold text-sm border-b pb-2">نوع التعليم</h4>
        <div className="space-y-2">
          {['عربي', 'لغات', 'أزهر'].map(type => (
            <div key={type} className="flex items-center gap-2">
              <Checkbox 
                id={`type-${type}`} 
                checked={educationType === type}
                onCheckedChange={(checked) => setEducationType(checked ? type : undefined)}
              />
              <Label htmlFor={`type-${type}`} className="cursor-pointer">{type}</Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold text-sm border-b pb-2">دار النشر</h4>
        <div className="space-y-2">
          {publishers?.map(pub => (
            <div key={pub.id} className="flex items-center gap-2">
              <Checkbox 
                id={`pub-${pub.id}`} 
                checked={publisherId === pub.id}
                onCheckedChange={(checked) => setPublisherId(checked ? pub.id : undefined)}
              />
              <Label htmlFor={`pub-${pub.id}`} className="cursor-pointer">{pub.nameAr}</Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-64 shrink-0">
          <FilterSidebar />
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-primary">تصفح الكتب</h1>
            
            <div className="flex items-center gap-2">
              {/* Mobile Filter Button */}
              <div className="md:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Filter className="h-4 w-4" /> تصفية
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[300px] sm:w-[400px] overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>تصفية النتائج</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6">
                      <FilterSidebar />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="ترتيب حسب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">الأحدث</SelectItem>
                  <SelectItem value="price_asc">السعر: من الأقل للأعلى</SelectItem>
                  <SelectItem value="price_desc">السعر: من الأعلى للأقل</SelectItem>
                  <SelectItem value="best_selling">الأكثر مبيعاً</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {Array(12).fill(0).map((_, i) => (
                <Card key={i} className="overflow-hidden border-border/50">
                  <Skeleton className="h-48 w-full rounded-none" />
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-6 w-1/3 mt-4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : productsData?.items.length === 0 ? (
            <div className="text-center py-20">
              <BookOpen className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-xl font-bold mb-2">لم نجد أي كتب</h3>
              <p className="text-muted-foreground">جرب تغيير خيارات التصفية للوصول لنتائج أفضل.</p>
              <Button onClick={resetFilters} variant="outline" className="mt-6">عرض كل الكتب</Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {productsData?.items.map((product) => (
                  <Link key={product.id} href={`/product/${product.slug}`}>
                    <Card className="h-full overflow-hidden hover-elevate border-border/50 transition-all hover:border-secondary cursor-pointer group flex flex-col">
                      <div className="aspect-[3/4] bg-muted relative overflow-hidden shrink-0">
                        {product.coverImage ? (
                          <img src={product.coverImage} alt={product.nameAr} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-primary/5 text-primary/40 group-hover:bg-primary/10 transition-colors">
                            <BookOpen className="w-12 h-12 mb-2" />
                            <span className="text-xs font-bold text-center px-4 line-clamp-2">{product.nameAr}</span>
                          </div>
                        )}
                        {product.discountPercent && product.discountPercent > 0 && (
                          <Badge className="absolute top-2 right-2 bg-destructive text-destructive-foreground font-bold">
                            خصم {product.discountPercent}%
                          </Badge>
                        )}
                        {!product.inStock && (
                          <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-[2px]">
                            <Badge variant="outline" className="bg-background text-muted-foreground font-bold border-muted-foreground/30">نفذت الكمية</Badge>
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4 flex-1 flex flex-col">
                        <div className="text-xs text-muted-foreground mb-1">{product.publisher || 'ناشر غير معروف'}</div>
                        <h3 className="font-bold text-sm md:text-base mb-2 line-clamp-2 leading-tight group-hover:text-secondary transition-colors">
                          {product.nameAr}
                        </h3>
                        <div className="flex items-center gap-2 mt-auto pt-2">
                          <span className="font-black text-lg text-primary">{product.price} ج.م</span>
                          {product.oldPrice && (
                            <span className="text-xs text-muted-foreground line-through">{product.oldPrice} ج.م</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {productsData && productsData.total > productsData.limit && (
                <div className="flex justify-center mt-10 gap-2">
                  <Button 
                    variant="outline" 
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    السابق
                  </Button>
                  <div className="flex items-center px-4 font-medium">
                    صفحة {page} من {Math.ceil(productsData.total / productsData.limit)}
                  </div>
                  <Button 
                    variant="outline" 
                    disabled={page >= Math.ceil(productsData.total / productsData.limit)}
                    onClick={() => setPage(p => p + 1)}
                  >
                    التالي
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
