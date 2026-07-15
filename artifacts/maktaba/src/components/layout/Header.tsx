import { Link } from "wouter";
import { Search, ShoppingCart, User, Heart, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartContext } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Header() {
  const { itemCount } = useCartContext();
  const { customer } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b shadow-sm">
      <div className="bg-primary text-primary-foreground py-2 text-center text-sm font-medium">
        شحن مجاني للطلبات فوق 500 جنيه! 🎉
      </div>
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Mobile Menu */}
        <div className="md:hidden flex items-center">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-foreground">
                <Menu className="h-6 w-6" />
                <span className="sr-only">القائمة</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <nav className="flex flex-col gap-4 mt-8 text-lg font-medium">
                <Link href="/" className="hover:text-primary transition-colors" onClick={() => setIsMobileMenuOpen(false)}>الرئيسية</Link>
                <Link href="/catalog" className="hover:text-primary transition-colors" onClick={() => setIsMobileMenuOpen(false)}>الكتب</Link>
                <Link href="/stages" className="hover:text-primary transition-colors" onClick={() => setIsMobileMenuOpen(false)}>المراحل الدراسية</Link>
                <Link href="/publishers" className="hover:text-primary transition-colors" onClick={() => setIsMobileMenuOpen(false)}>دور النشر</Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-black text-primary tracking-tight">مكتبة دوت كوم</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 font-medium text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">الرئيسية</Link>
          <Link href="/catalog" className="hover:text-foreground transition-colors">تصفح الكتب</Link>
          <Link href="/stages" className="hover:text-foreground transition-colors">المراحل الدراسية</Link>
          <Link href="/publishers" className="hover:text-foreground transition-colors">دور النشر</Link>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="hidden sm:inline-flex" asChild>
            <Link href="/search">
              <Search className="h-5 w-5" />
              <span className="sr-only">بحث</span>
            </Link>
          </Button>

          {customer ? (
            <Button variant="ghost" size="icon" asChild>
              <Link href="/account">
                <User className="h-5 w-5" />
                <span className="sr-only">حسابي</span>
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" size="icon" asChild>
              <Link href="/login">
                <User className="h-5 w-5" />
                <span className="sr-only">تسجيل الدخول</span>
              </Link>
            </Button>
          )}

          <Button variant="ghost" size="icon" className="hidden sm:inline-flex" asChild>
            <Link href="/account?tab=favorites">
              <Heart className="h-5 w-5" />
              <span className="sr-only">المفضلة</span>
            </Link>
          </Button>

          <Button variant="ghost" size="icon" className="relative" asChild>
            <Link href="/cart">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
                  {itemCount}
                </span>
              )}
              <span className="sr-only">السلة</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
