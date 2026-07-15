import { Link } from "wouter";
import { Facebook, Instagram, Phone, Mail, MapPin } from "lucide-react";
import { FaWhatsapp, FaTiktok } from "react-icons/fa";

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground pt-16 pb-8 border-t-4 border-accent">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
        <div>
          <Link href="/" className="inline-block mb-6">
            <span className="text-3xl font-black text-white tracking-tight">مكتبة دوت كوم</span>
          </Link>
          <p className="text-primary-foreground/80 mb-6 leading-relaxed">
            الوجهة الأولى في مصر للكتب المدرسية وكتب المراجعات. نصلك أينما كنت في أسرع وقت.
          </p>
          <div className="flex items-center gap-4">
            <a href="https://facebook.com" target="_blank" rel="noreferrer" className="text-primary-foreground/80 hover:text-white transition-colors">
              <Facebook className="h-6 w-6" />
            </a>
            <a href="https://instagram.com" target="_blank" rel="noreferrer" className="text-primary-foreground/80 hover:text-white transition-colors">
              <Instagram className="h-6 w-6" />
            </a>
            <a href="https://wa.me/201000000000" target="_blank" rel="noreferrer" className="text-primary-foreground/80 hover:text-white transition-colors">
              <FaWhatsapp className="h-6 w-6" />
            </a>
            <a href="https://tiktok.com" target="_blank" rel="noreferrer" className="text-primary-foreground/80 hover:text-white transition-colors">
              <FaTiktok className="h-6 w-6" />
            </a>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold mb-6 text-white border-b-2 border-accent/50 pb-2 inline-block">روابط هامة</h3>
          <ul className="space-y-3">
            <li><Link href="/catalog" className="text-primary-foreground/80 hover:text-white transition-colors">تصفح الكتب</Link></li>
            <li><Link href="/stages" className="text-primary-foreground/80 hover:text-white transition-colors">المراحل الدراسية</Link></li>
            <li><Link href="/publishers" className="text-primary-foreground/80 hover:text-white transition-colors">دور النشر</Link></li>
            <li><Link href="/about" className="text-primary-foreground/80 hover:text-white transition-colors">من نحن</Link></li>
            <li><Link href="/contact" className="text-primary-foreground/80 hover:text-white transition-colors">اتصل بنا</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-bold mb-6 text-white border-b-2 border-accent/50 pb-2 inline-block">خدمة العملاء</h3>
          <ul className="space-y-3">
            <li><Link href="/faq" className="text-primary-foreground/80 hover:text-white transition-colors">الأسئلة الشائعة</Link></li>
            <li><Link href="/shipping-policy" className="text-primary-foreground/80 hover:text-white transition-colors">سياسة الشحن</Link></li>
            <li><Link href="/return-policy" className="text-primary-foreground/80 hover:text-white transition-colors">سياسة الاسترجاع</Link></li>
            <li><Link href="/privacy" className="text-primary-foreground/80 hover:text-white transition-colors">سياسة الخصوصية</Link></li>
            <li><Link href="/terms" className="text-primary-foreground/80 hover:text-white transition-colors">الشروط والأحكام</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-bold mb-6 text-white border-b-2 border-accent/50 pb-2 inline-block">تواصل معنا</h3>
          <ul className="space-y-4">
            <li className="flex items-center gap-3 text-primary-foreground/80">
              <MapPin className="h-5 w-5 text-accent" />
              <span>القاهرة، مصر</span>
            </li>
            <li className="flex items-center gap-3 text-primary-foreground/80">
              <Phone className="h-5 w-5 text-accent" />
              <span dir="ltr">+20 100 000 0000</span>
            </li>
            <li className="flex items-center gap-3 text-primary-foreground/80">
              <Mail className="h-5 w-5 text-accent" />
              <span>support@maktaba.com</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-8 border-t border-primary-foreground/10 text-center text-primary-foreground/60 text-sm">
        <p>جميع الحقوق محفوظة &copy; {new Date().getFullYear()} مكتبة دوت كوم</p>
      </div>

      {/* Floating WhatsApp Button */}
      <a 
        href="https://wa.me/201000000000" 
        target="_blank" 
        rel="noreferrer"
        className="fixed bottom-20 md:bottom-6 left-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-lg hover:scale-110 transition-transform hover:shadow-xl"
        aria-label="تواصل معنا عبر واتساب"
      >
        <FaWhatsapp className="h-8 w-8" />
      </a>
    </footer>
  );
}
