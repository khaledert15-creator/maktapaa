import { Link } from "wouter";
import { Facebook, Instagram, Phone, Mail, MapPin } from "lucide-react";
import { FaWhatsapp, FaTiktok, FaTelegram } from "react-icons/fa";
import { getGetSiteSettingsQueryKey, useGetSiteSettings } from "@workspace/api-client-react";

export function Footer() {
  const { data: settings } = useGetSiteSettings({ query: { queryKey: getGetSiteSettingsQueryKey(), staleTime: 60_000 } });
  const whatsapp = settings?.whatsappNumber?.replace(/\D/g, "");
  const socialLinks = [
    settings?.facebookUrl && [settings.facebookUrl, Facebook, "فيسبوك"], settings?.instagramUrl && [settings.instagramUrl, Instagram, "إنستجرام"], settings?.tiktokUrl && [settings.tiktokUrl, FaTiktok, "تيك توك"], settings?.telegramUrl && [settings.telegramUrl, FaTelegram, "تليجرام"], whatsapp && [`https://wa.me/${whatsapp}`, FaWhatsapp, "واتساب"],
  ].filter(Boolean) as [string, typeof Facebook, string][];
  return <footer className="border-t-4 border-sky-500 bg-slate-950 pb-24 pt-14 text-white md:pb-8">
    <div className="container mx-auto grid grid-cols-1 gap-10 px-4 sm:grid-cols-2 lg:grid-cols-4">
      <div><Link href="/" className="text-3xl font-black">{settings?.storeNameAr || "مكتبة دوت كوم"}</Link><p className="mt-5 max-w-sm leading-7 text-slate-400">متجر عربي للكتب التعليمية والمراجعات، ببيانات أسعار ومخزون محدثة مباشرة من إدارة المكتبة.</p><div className="mt-6 flex flex-wrap gap-3">{socialLinks.map(([href, Icon, label]) => <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} className="rounded-xl bg-white/10 p-2.5 text-slate-300 transition hover:bg-sky-500 hover:text-white"><Icon className="h-5 w-5" /></a>)}</div></div>
      <div><h2 className="mb-5 text-lg font-black">اكتشف المكتبة</h2><ul className="space-y-3 text-slate-400"><li><Link href="/catalog" className="hover:text-white">كل الكتب</Link></li><li><Link href="/offers" className="hover:text-white">العروض</Link></li><li><Link href="/stages" className="hover:text-white">المراحل والصفوف</Link></li><li><Link href="/publishers" className="hover:text-white">دور النشر</Link></li><li><Link href="/categories" className="hover:text-white">التصنيفات</Link></li></ul></div>
      <div><h2 className="mb-5 text-lg font-black">مساعدة وخدمة العملاء</h2><ul className="space-y-3 text-slate-400"><li><Link href="/track" className="hover:text-white">تتبع طلبك</Link></li><li><Link href="/faq" className="hover:text-white">الأسئلة الشائعة</Link></li><li><Link href="/shipping-policy" className="hover:text-white">سياسة الشحن</Link></li><li><Link href="/return-policy" className="hover:text-white">الإلغاء والاسترجاع</Link></li><li><Link href="/privacy" className="hover:text-white">سياسة الخصوصية</Link></li><li><Link href="/terms" className="hover:text-white">الشروط والأحكام</Link></li></ul></div>
      <div><h2 className="mb-5 text-lg font-black">تواصل معنا</h2><ul className="space-y-4 text-slate-400">{settings?.address && <li className="flex gap-3"><MapPin className="mt-1 h-5 w-5 shrink-0 text-sky-400" /><span>{settings.address}</span></li>}{settings?.phoneNumber && <li className="flex gap-3"><Phone className="h-5 w-5 shrink-0 text-sky-400" /><a dir="ltr" href={`tel:${settings.phoneNumber}`}>{settings.phoneNumber}</a></li>}{settings?.email && <li className="flex gap-3"><Mail className="h-5 w-5 shrink-0 text-sky-400" /><a dir="ltr" href={`mailto:${settings.email}`}>{settings.email}</a></li>}</ul><p className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">الدفع المتاح حاليًا: نقدًا عند الاستلام فقط.</p></div>
    </div>
    <div className="container mx-auto mt-12 border-t border-white/10 px-4 pt-7 text-center text-sm text-slate-500">جميع الحقوق محفوظة © {new Date().getFullYear()} {settings?.storeNameAr || "مكتبة دوت كوم"}</div>
    {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" aria-label="استفسار عبر واتساب" className="fixed bottom-20 left-5 z-40 rounded-full bg-[#25D366] p-3.5 text-white shadow-xl transition hover:scale-105 md:bottom-6"><FaWhatsapp className="h-7 w-7" /></a>}
  </footer>;
}
