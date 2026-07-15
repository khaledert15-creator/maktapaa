import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Tags, 
  Truck, 
  Settings, 
  LogOut,
  Menu,
  X,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { admin, isAdminAuthLoaded, logoutAdmin } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (isAdminAuthLoaded && !admin) setLocation('/admin/login');
  }, [admin, isAdminAuthLoaded, setLocation]);

  if (!isAdminAuthLoaded || !admin) {
    return <div className="min-h-screen grid place-items-center" dir="rtl">جاري التحقق من صلاحية الدخول...</div>;
  }

  const navigation = [
    { name: "لوحة التحكم", href: "/admin", icon: LayoutDashboard },
    { name: "المنتجات", href: "/admin/products", icon: Package },
    { name: "الطلبات", href: "/admin/orders", icon: ShoppingCart },
    { name: "العملاء", href: "/admin/customers", icon: Users },
    { name: "المخزون", href: "/admin/inventory", icon: Package },
    { name: "الكوبونات", href: "/admin/coupons", icon: Tags },
    { name: "الشحن والمحافظات", href: "/admin/shipping", icon: Truck },
    { name: "التصنيفات", href: "/admin/classifications", icon: Tags },
    { name: "إدارة المحتوى", href: "/admin/content", icon: FileText },
    { name: "التقارير", href: "/admin/reports", icon: FileText },
    { name: "الموظفين", href: "/admin/employees", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 right-0 z-50 w-64 bg-sidebar border-l border-sidebar-border transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="h-16 flex items-center justify-between px-6 border-b border-sidebar-border">
            <Link href="/admin" className="text-xl font-bold text-sidebar-foreground">
              مكتبة دوت كوم | الإدارة
            </Link>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {navigation.map((item) => {
              const isActive = location === item.href || (item.href !== "/admin" && location.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                    isActive 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                {admin?.name?.charAt(0) || "م"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{admin?.name}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{admin?.role}</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={logoutAdmin}
            >
              <LogOut className="h-4 w-4 ml-2" />
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-background border-b flex items-center px-4 lg:px-8 shrink-0">
          <Button variant="ghost" size="icon" className="lg:hidden ml-4" onClick={() => setIsSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" asChild>
            <Link href="/" target="_blank">عرض المتجر</Link>
          </Button>
        </header>
        <div className="flex-1 overflow-auto p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
