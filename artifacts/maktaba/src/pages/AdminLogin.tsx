import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLoginAdmin, getGetCurrentAdminQueryKey, getGetSiteSettingsQueryKey, useGetSiteSettings } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert } from "lucide-react";

const formSchema = z.object({
  email: z.string().min(1, "البريد الإلكتروني مطلوب").email("بريد إلكتروني غير صحيح"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
});

function adminLandingPath(user: { role: string; permissions?: string[] | null }) {
  if (user.role === "owner" || user.role === "administrator") return "/admin";
  const routes = [
    ["dashboard.view", "/admin"],
    ["orders.view", "/admin/orders"],
    ["inventory.view", "/admin/inventory"],
    ["products.view", "/admin/products"],
    ["customers.view", "/admin/customers"],
    ["coupons.view", "/admin/coupons"],
    ["shipping.view", "/admin/shipping"],
    ["classifications.view", "/admin/classifications"],
    ["content.view", "/admin/content"],
    ["reports.view", "/admin/reports"],
    ["employees.manage", "/admin/employees"],
  ] as const;
  return routes.find(([permission]) => user.permissions?.includes(permission) || (permission === "content.view" && (user.permissions?.includes("content.manage") || user.permissions?.includes("branding.manage"))))?.[1] || "/admin";
}

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { setAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings } = useGetSiteSettings({ query: { queryKey: getGetSiteSettingsQueryKey(), staleTime: 60_000 } });
  const logo = settings?.adminLogoUrl || settings?.mainLogoUrl || settings?.logoUrl;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  const loginMutation = useLoginAdmin({
    mutation: {
      onSuccess: (data) => {
        setAdmin(data.user);
        queryClient.invalidateQueries({ queryKey: getGetCurrentAdminQueryKey() });
        toast({ title: "تم تسجيل الدخول", description: "مرحباً بك في لوحة التحكم" });
        setLocation(adminLandingPath(data.user));
      },
      onError: () => {
        toast({ title: "خطأ", description: "بيانات الدخول غير صحيحة", variant: "destructive" });
      }
    }
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    loginMutation.mutate({ data: values });
  };

  return (
    <div className="min-h-screen bg-muted/30 flex justify-center items-center p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-20 min-w-20 max-w-56 items-center justify-center rounded-2xl bg-primary/10 p-3 text-primary">
            {logo ? <img src={logo} alt={settings?.storeNameAr || "مكتبة دوت كوم"} className="max-h-14 max-w-full object-contain" /> : <ShieldAlert className="h-8 w-8" />}
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-black text-primary">لوحة تحكم الإدارة</CardTitle>
            <CardDescription>{settings?.storeNameAr || "مكتبة دوت كوم"}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>البريد الإلكتروني للإدارة</FormLabel>
                    <FormControl>
                      <Input placeholder="admin@maktaba.com" dir="ltr" className="text-right" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>كلمة المرور</FormLabel>
                    <FormControl>
                      <Input type="password" dir="ltr" className="text-right" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" size="lg" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "جاري الدخول..." : "دخول للوحة التحكم"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
