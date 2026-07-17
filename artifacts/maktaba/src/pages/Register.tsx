import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegisterCustomer, getGetCurrentCustomerQueryKey, getGetSiteSettingsQueryKey, useGetSiteSettings } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formSchema = z.object({
  name: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
  mobile: z.string().regex(/^01[0125][0-9]{8}$/, "رقم موبايل مصري غير صحيح"),
  primaryPhoneHasWhatsApp: z.boolean(),
  alternatePhone: z.string().regex(/^01[0125][0-9]{8}$/, "رقم موبايل مصري غير صحيح").optional().or(z.literal("")),
  alternatePhoneHasWhatsApp: z.boolean(),
  preferredWhatsApp: z.enum(["primary", "alternate", "none"]),
  email: z.string().email("بريد إلكتروني غير صحيح").optional().or(z.literal("")),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
}).superRefine((values, context) => {
  if (values.preferredWhatsApp === "primary" && !values.primaryPhoneHasWhatsApp) context.addIssue({ code: "custom", path: ["preferredWhatsApp"], message: "حدد أن الرقم الأساسي عليه واتساب أولًا" });
  if (values.preferredWhatsApp === "alternate" && (!values.alternatePhone || !values.alternatePhoneHasWhatsApp)) context.addIssue({ code: "custom", path: ["preferredWhatsApp"], message: "اكتب الرقم البديل وحدد أنه عليه واتساب" });
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { setCustomer } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings } = useGetSiteSettings({ query: { queryKey: getGetSiteSettingsQueryKey(), staleTime: 60_000 } });
  const logo = settings?.lightBackgroundLogoUrl || settings?.mainLogoUrl || settings?.logoUrl;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", mobile: "", primaryPhoneHasWhatsApp: true, alternatePhone: "", alternatePhoneHasWhatsApp: false, preferredWhatsApp: "primary", email: "", password: "" },
  });

  const registerMutation = useRegisterCustomer({
    mutation: {
      onSuccess: (data) => {
        setCustomer(data.customer);
        queryClient.invalidateQueries({ queryKey: getGetCurrentCustomerQueryKey() });
        toast({ title: "مرحباً بك!", description: "تم إنشاء حسابك بنجاح." });
        setLocation("/");
      },
      onError: () => {
        toast({ title: "خطأ", description: "حدث خطأ أو البريد/الرقم مسجل مسبقاً", variant: "destructive" });
      }
    }
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    registerMutation.mutate({ 
      data: {
        ...values,
        alternatePhone: values.alternatePhone || null,
        preferredWhatsAppPhone: values.preferredWhatsApp === "primary" ? values.mobile : values.preferredWhatsApp === "alternate" ? values.alternatePhone || null : null,
        email: values.email || null
      } as Parameters<typeof registerMutation.mutate>[0]["data"]
    });
  };

  return (
    <div className="container mx-auto px-4 py-16 flex justify-center items-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-md shadow-lg border-border/50">
        <CardHeader className="text-center space-y-2">
          {logo && <img src={logo} alt={settings?.storeNameAr || "مكتبة دوت كوم"} className="mx-auto mb-3 max-h-16 max-w-56 object-contain" />}
          <CardTitle className="text-2xl font-black text-primary">إنشاء حساب جديد</CardTitle>
          <CardDescription>انضم لعائلة {settings?.storeNameAr || "مكتبة دوت كوم"}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الاسم بالكامل</FormLabel>
                    <FormControl>
                      <Input placeholder="أحمد محمد" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>رقم الموبايل الأساسي</FormLabel>
                    <FormControl>
                      <Input placeholder="01xxxxxxxxx" dir="ltr" className="text-right" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="primaryPhoneHasWhatsApp" render={({ field }) => <FormItem className="flex items-center gap-3 rounded-xl border p-3"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">الرقم الأساسي عليه واتساب</FormLabel></FormItem>} />
              <FormField control={form.control} name="alternatePhone" render={({ field }) => <FormItem><FormLabel>رقم موبايل بديل (اختياري)</FormLabel><FormControl><Input placeholder="01xxxxxxxxx" dir="ltr" className="text-right" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="alternatePhoneHasWhatsApp" render={({ field }) => <FormItem className="flex items-center gap-3 rounded-xl border p-3"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">الرقم البديل عليه واتساب</FormLabel></FormItem>} />
              <FormField control={form.control} name="preferredWhatsApp" render={({ field }) => <FormItem><FormLabel>رقم واتساب المفضل</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="primary">الرقم الأساسي</SelectItem><SelectItem value="alternate">الرقم البديل</SelectItem><SelectItem value="none">لا يوجد رقم واتساب</SelectItem></SelectContent></Select><FormMessage /></FormItem>} />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>البريد الإلكتروني (اختياري)</FormLabel>
                    <FormControl>
                      <Input placeholder="example@email.com" dir="ltr" className="text-right" {...field} />
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
              <Button type="submit" className="w-full mt-6" size="lg" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? "جاري التسجيل..." : "إنشاء الحساب"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center border-t p-6">
          <p className="text-sm text-muted-foreground">
            لديك حساب بالفعل؟{" "}
            <Link href="/login" className="text-secondary font-bold hover:underline">
              تسجيل الدخول
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
