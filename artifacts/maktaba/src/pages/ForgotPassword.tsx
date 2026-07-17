import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Seo } from "@/components/storefront/Seo";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json() as { message?: string };
      setMessage(data.message || "إذا كان البريد مسجلاً فستصلك رسالة استعادة كلمة المرور.");
    } finally { setLoading(false); }
  };

  return <div className="container mx-auto flex min-h-[65vh] items-center justify-center px-4 py-14">
    <Seo title="نسيت كلمة المرور | مكتبة دوت كوم" description="استعادة آمنة لكلمة مرور حساب مكتبة دوت كوم" />
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="text-center"><CardTitle className="text-2xl font-black">استعادة كلمة المرور</CardTitle><CardDescription>أدخل بريدك الإلكتروني وسنرسل لك رابطًا صالحًا لمدة 30 دقيقة.</CardDescription></CardHeader>
      <CardContent>{message ? <div className="space-y-5 text-center"><MailCheck className="mx-auto h-14 w-14 text-emerald-600" /><p className="leading-7">{message}</p><Button asChild variant="outline"><Link href="/login">العودة إلى تسجيل الدخول</Link></Button></div> : <form className="space-y-5" onSubmit={submit}><div className="space-y-2"><Label htmlFor="reset-email">البريد الإلكتروني</Label><Input id="reset-email" dir="ltr" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></div><Button className="w-full" disabled={loading}>{loading ? "جاري الإرسال..." : "إرسال رابط الاستعادة"}</Button></form>}</CardContent>
    </Card>
  </div>;
}
