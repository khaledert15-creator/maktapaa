import { Link } from "wouter";
import { useListFeaturedProducts, useListStages, useListPublishers } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Truck, ShieldCheck, Package, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const { data: featuredProducts, isLoading: isLoadingFeatured } = useListFeaturedProducts();
  const { data: stages, isLoading: isLoadingStages } = useListStages();
  const { data: publishers, isLoading: isLoadingPublishers } = useListPublishers();

  return (
    <div className="flex flex-col gap-12 pb-12">
      {/* Hero Banner Area */}
      <section className="bg-primary/5 py-8 md:py-16">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 space-y-6 text-center md:text-right">
            <Badge variant="outline" className="bg-white px-3 py-1 text-sm border-secondary text-secondary">
              الأقوى في مصر 🇪🇬
            </Badge>
            <h1 className="text-4xl md:text-6xl font-black text-primary leading-tight">
              كل كتبك المدرسية<br/>في مكان واحد
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl">
              مكتبة دوت كوم توفر لك أحدث طبعات الكتب المدرسية، كتب اللغات، وكتب المراجعات النهائية لجميع المراحل الدراسية.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start pt-4">
              <Button size="lg" className="text-lg px-8 bg-secondary hover:bg-secondary/90 text-secondary-foreground" asChild>
                <Link href="/catalog">تصفح الكتب الآن</Link>
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8" asChild>
                <Link href="/stages">اختر المرحلة الدراسية</Link>
              </Button>
            </div>
          </div>
          <div className="flex-1 w-full max-w-lg aspect-square bg-gradient-to-tr from-accent/20 to-secondary/20 rounded-[3rem] p-8 flex items-center justify-center relative overflow-hidden">
             {/* Abstract decorative shapes */}
             <div className="absolute top-10 right-10 w-32 h-32 bg-secondary/30 rounded-full blur-2xl"></div>
             <div className="absolute bottom-10 left-10 w-40 h-40 bg-accent/30 rounded-full blur-2xl"></div>
             
             {/* We can use an abstract icon composition since we don't have images ready */}
             <div className="relative z-10 grid grid-cols-2 gap-4 w-full h-full">
                <div className="bg-white rounded-2xl shadow-xl p-6 flex flex-col items-center justify-center gap-4 transform -rotate-6 hover:rotate-0 transition-transform">
                  <BookOpen className="w-16 h-16 text-primary" />
                  <div className="w-20 h-3 bg-muted rounded-full"></div>
                  <div className="w-16 h-3 bg-muted rounded-full"></div>
                </div>
                <div className="bg-primary text-primary-foreground rounded-2xl shadow-xl p-6 flex flex-col items-center justify-center gap-4 transform translate-y-8 rotate-3 hover:rotate-0 transition-transform">
                  <span className="text-4xl font-bold text-accent">2025</span>
                  <span className="text-lg font-medium">أحدث الطبعات</span>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
          <Card className="border-none shadow-sm bg-blue-50/50">
            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
              <div className="h-12 w-12 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                <Truck className="h-6 w-6" />
              </div>
              <h3 className="font-bold">شحن لكل مصر</h3>
              <p className="text-sm text-muted-foreground">نوصلك في أي محافظة لحد باب البيت</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-amber-50/50">
            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
              <div className="h-12 w-12 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="font-bold">دفع عند الاستلام</h3>
              <p className="text-sm text-muted-foreground">عاين طلبك الأول وبعدين ادفع</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-emerald-50/50">
            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Package className="h-6 w-6" />
              </div>
              <h3 className="font-bold">كتبك في كرتونة</h3>
              <p className="text-sm text-muted-foreground">تغليف ممتاز يحافظ على كتبك</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-purple-50/50">
            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
              <div className="h-12 w-12 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="font-bold">أقوى الكتب</h3>
              <p className="text-sm text-muted-foreground">أفضل دور النشر والمراجعات</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Featured Products */}
      <section className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-primary mb-2">أحدث وأقوى الكتب</h2>
            <p className="text-muted-foreground">الكتب الأكثر طلباً هذا الأسبوع</p>
          </div>
          <Button variant="ghost" className="text-secondary" asChild>
            <Link href="/catalog" className="flex items-center gap-1">
              عرض الكل
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {isLoadingFeatured ? (
            Array(5).fill(0).map((_, i) => (
              <Card key={i} className="overflow-hidden border-border/50">
                <Skeleton className="h-48 w-full rounded-none" />
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-6 w-1/3 mt-4" />
                </CardContent>
              </Card>
            ))
          ) : (
            featuredProducts?.slice(0, 5).map((product) => (
              <Link key={product.id} href={`/product/${product.slug}`}>
                <Card className="h-full overflow-hidden hover-elevate border-border/50 transition-all hover:border-secondary cursor-pointer group">
                  <div className="aspect-[3/4] bg-muted relative overflow-hidden">
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
                    {product.freeShipping && <Badge className="absolute bottom-2 right-2 bg-emerald-600 text-white">{product.freeShippingBadgeText || 'شحن مجاني'}</Badge>}
                  </div>
                  <CardContent className="p-4">
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
            ))
          )}
        </div>
      </section>

      {/* Educational Stages */}
      <section className="bg-muted/30 py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-primary mb-2">تصفح حسب المرحلة الدراسية</h2>
            <p className="text-muted-foreground">اختر المرحلة لتجد كل الكتب والملازم الخاصة بها</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {isLoadingStages ? (
              Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
            ) : (
              stages?.slice(0, 4).map((stage) => (
                <Link key={stage.id} href={`/catalog?stageId=${stage.id}`}>
                  <Card className="hover-elevate cursor-pointer border-2 border-transparent hover:border-secondary transition-colors h-full">
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
                      <div className="h-16 w-16 bg-primary/5 rounded-full flex items-center justify-center mb-4 text-primary">
                        <BookOpen className="h-8 w-8" />
                      </div>
                      <h3 className="text-lg font-bold">{stage.nameAr}</h3>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Publishers */}
      <section className="container mx-auto px-4">
         <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-primary mb-2">أشهر دور النشر</h2>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
             {isLoadingPublishers ? (
               Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
             ) : (
               publishers?.slice(0, 6).map(pub => (
                 <Link key={pub.id} href={`/catalog?publisherId=${pub.id}`}>
                    <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer border-border/50 flex items-center justify-center p-4">
                       <span className="font-bold text-center text-muted-foreground">{pub.nameAr}</span>
                    </Card>
                 </Link>
               ))
             )}
          </div>
      </section>

    </div>
  );
}
