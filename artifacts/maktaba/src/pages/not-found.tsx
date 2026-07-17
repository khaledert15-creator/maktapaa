import { Link } from "wouter";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Seo } from "@/components/storefront/Seo";

export default function NotFound() {
  return <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-12"><Seo title="الصفحة غير موجودة | مكتبة دوت كوم" description="تعذر العثور على الصفحة المطلوبة" /><Card className="w-full max-w-lg"><CardContent className="space-y-5 p-10 text-center"><CircleHelp className="mx-auto h-16 w-16 text-secondary" /><h1 className="text-3xl font-black">الصفحة غير موجودة</h1><p className="text-muted-foreground">قد يكون الرابط قد تغير أو تمت إزالة الصفحة.</p><div className="flex justify-center gap-3"><Button asChild><Link href="/">العودة للرئيسية</Link></Button><Button asChild variant="outline"><Link href="/catalog">تصفح الكتب</Link></Button></div></CardContent></Card></div>;
}
