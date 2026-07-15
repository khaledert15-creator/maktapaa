import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLoginAdmin, getGetCurrentAdminQueryKey } from "@workspace/api-client-react";
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

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { setAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
        setLocation("/admin");
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
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center text-primary">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-black text-primary">لوحة تحكم الإدارة</CardTitle>
            <CardDescription>مكتبة دوت كوم</CardDescription>
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
