import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Seo } from "@/components/storefront/Seo";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`, { credentials: "include" })
      .then(response => response.json()).then((data: { valid?: boolean }) => setValid(Boolean(data.valid))).catch(() => setValid(false));
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(null);
    if (password.length < 8) { setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل"); return; }
    if (password !== confirmPassword) { setError("كلمتا المرور غير متطابقتين"); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) { setError(data.error || "تعذر إعادة تعيين كلمة المرور"); return; }
      setDone(true); setTimeout(() => navigate("/login"), 2500);
    } finally { setLoading(false); }
  };

  return <div className="container mx-auto flex min-h-[65vh] items-center justify-center px-4 py-14"><Seo title="تعيين كلمة مرور جديدة | مكتبة دوت كوم" description="تعيين كلمة مرور جديدة لحسابك" /><Card className="w-full max-w-md shadow-lg"><CardHeader className="text-center"><CardTitle className="text-2xl font-black">تعيين كلمة مرور جديدة</CardTitle><CardDescription>اختر كلمة مرور قوية لا تستخدمها في موقع آخر.</CardDescription></CardHeader><CardContent>
    {valid === null ? <p className="text-center text-muted-foreground">جاري التحقق من الرابط...</p> : !valid ? <div className="space-y-4 text-center"><TriangleAlert className="mx-auto h-14 w-14 text-amber-600" /><p>الرابط غير صالح أو انتهت صلاحيته.</p><Button asChild><Link href="/forgot-password">طلب رابط جديد</Link></Button></div> : done ? <div className="space-y-4 text-center"><CircleCheck className="mx-auto h-14 w-14 text-emerald-600" /><p>تم تحديث كلمة المرور وإغلاق الجلسات القديمة. سيتم نقلك لتسجيل الدخول.</p></div> : <form className="space-y-5" onSubmit={submit}><div className="space-y-2"><Label htmlFor="new-password">كلمة المرور الجديدة</Label><Input id="new-password" dir="ltr" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="confirm-password">تأكيد كلمة المرور</Label><Input id="confirm-password" dir="ltr" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button className="w-full" disabled={loading}>{loading ? "جاري الحفظ..." : "حفظ كلمة المرور"}</Button></form>}
  </CardContent></Card></div>;
}
