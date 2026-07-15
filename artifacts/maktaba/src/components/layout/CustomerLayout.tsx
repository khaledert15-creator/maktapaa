import { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { Link, useLocation } from "wouter";
import { Home, Search, ShoppingCart, User } from "lucide-react";
import { useCartContext } from "@/contexts/CartContext";

export function CustomerLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { itemCount } = useCartContext();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1 pb-16 md:pb-0">
        {children}
      </main>
      <Footer />

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-40 px-4 py-2 flex justify-between items-center safe-area-bottom">
        <Link href="/" className={`flex flex-col items-center p-2 rounded-lg transition-colors ${location === '/' ? 'text-secondary font-bold' : 'text-muted-foreground'}`}>
          <Home className="h-5 w-5 mb-1" />
          <span className="text-[10px]">الرئيسية</span>
        </Link>
        <Link href="/search" className={`flex flex-col items-center p-2 rounded-lg transition-colors ${location === '/search' ? 'text-secondary font-bold' : 'text-muted-foreground'}`}>
          <Search className="h-5 w-5 mb-1" />
          <span className="text-[10px]">بحث</span>
        </Link>
        <Link href="/cart" className={`flex flex-col items-center p-2 rounded-lg transition-colors relative ${location === '/cart' ? 'text-secondary font-bold' : 'text-muted-foreground'}`}>
          <div className="relative">
            <ShoppingCart className="h-5 w-5 mb-1" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-2 h-4 w-4 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">السلة</span>
        </Link>
        <Link href="/account" className={`flex flex-col items-center p-2 rounded-lg transition-colors ${location.startsWith('/account') ? 'text-secondary font-bold' : 'text-muted-foreground'}`}>
          <User className="h-5 w-5 mb-1" />
          <span className="text-[10px]">حسابي</span>
        </Link>
      </div>
    </div>
  );
}
