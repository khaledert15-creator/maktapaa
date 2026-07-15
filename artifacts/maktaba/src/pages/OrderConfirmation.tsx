import { Link, useParams } from "wouter";
import { CheckCircle2, Package, MapPin, Truck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useGetMyOrders } from "@workspace/api-client-react";

export default function OrderConfirmation() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  // In a real app we might fetch the specific order by number
  // For now we'll just fetch orders and try to match, or just show the number
  
  return (
    <div className="container mx-auto px-4 py-16 flex flex-col items-center">
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-600 animate-in zoom-in duration-500">
        <CheckCircle2 className="w-14 h-14" />
      </div>
      
      <h1 className="text-3xl md:text-4xl font-black text-primary mb-2 text-center">
        تم تأكيد طلبك بنجاح!
      </h1>
      
      <p className="text-muted-foreground text-center max-w-md mb-8">
        شكراً لتسوقك من مكتبة دوت كوم. جاري تجهيز طلبك وسنتواصل معك قريباً لتأكيد موعد التسليم.
      </p>

      <Card className="w-full max-w-md border-border/50 shadow-md mb-8">
        <CardContent className="p-6">
          <div className="text-center pb-6 border-b mb-6">
            <span className="text-sm text-muted-foreground block mb-1">رقم الطلب</span>
            <span className="text-3xl font-black font-mono tracking-wider text-primary">{orderNumber}</span>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/5 rounded-full flex items-center justify-center text-primary shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold">حالة الطلب</div>
                <div className="text-sm text-muted-foreground">قيد المراجعة</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center text-secondary shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold">الشحن والتوصيل</div>
                <div className="text-sm text-muted-foreground">يتم التوصيل خلال 2-4 أيام عمل</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-4">
        <Button size="lg" variant="outline" className="px-8" asChild>
          <Link href="/catalog">متابعة التسوق</Link>
        </Button>
        <Button size="lg" className="px-8" asChild>
          <Link href={`/track?orderNumber=${orderNumber}`}>تتبع الطلب</Link>
        </Button>
      </div>
    </div>
  );
}
