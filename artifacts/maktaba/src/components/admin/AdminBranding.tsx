import { useEffect, useState } from "react";
import { ImagePlus, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type BrandKind = "main" | "dark_background" | "light_background" | "mobile" | "favicon" | "admin" | "social";
type Asset = { id: number; kind: BrandKind; url: string; mimeType: string; width?: number | null; height?: number | null; sizeBytes?: number | null; altTextAr?: string | null };
const definitions: { kind: BrandKind; label: string; description: string }[] = [
  { kind: "main", label: "الشعار الرئيسي", description: "رأس الموقع وصفحات العميل والفاتورة عند عدم وجود بديل." },
  { kind: "dark_background", label: "شعار للخلفية الداكنة", description: "تذييل الموقع والمساحات الداكنة." },
  { kind: "light_background", label: "شعار للخلفية الفاتحة", description: "المساحات البيضاء وصفحات تسجيل دخول العميل." },
  { kind: "mobile", label: "شعار الموبايل", description: "نسخة مختصرة لرأس الموقع على الشاشات الصغيرة." },
  { kind: "favicon", label: "أيقونة المتصفح", description: "Favicon لتبويب المتصفح." },
  { kind: "admin", label: "شعار لوحة الإدارة", description: "الشريط الجانبي وصفحة دخول الموظفين." },
  { kind: "social", label: "صورة المشاركة الاجتماعية", description: "الصورة الافتراضية لـ Open Graph عند اختيارها." },
];

async function api<T>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, { credentials: "include", ...init }); const body = response.status === 204 ? null : await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error || "تعذر الاتصال بالخادم"); return body as T; }

export function AdminBranding({ onSaved }: { onSaved: () => Promise<void> }) {
  const { admin } = useAuth(); const { toast } = useToast();
  const canManage = admin?.role === "owner" || admin?.role === "administrator" || admin?.permissions?.includes("branding.manage");
  const [assets, setAssets] = useState<Asset[]>([]); const [files, setFiles] = useState<Partial<Record<BrandKind, File>>>({}); const [saving, setSaving] = useState<BrandKind | null>(null); const [removeKind, setRemoveKind] = useState<BrandKind | null>(null);
  const load = async () => { try { setAssets(await api<Asset[]>("/api/admin/content/branding")); } catch (error) { toast({ title: "تعذر تحميل الشعارات", description: String(error), variant: "destructive" }); } };
  useEffect(() => { void load(); }, []);
  const upload = async (kind: BrandKind) => { const file = files[kind]; if (!file) return; setSaving(kind); try { const body = new FormData(); body.append("image", file); body.append("altTextAr", definitions.find(item => item.kind === kind)?.label || "شعار مكتبة دوت كوم"); const saved = await api<Asset>(`/api/admin/content/branding/${kind}`, { method: "POST", body }); setAssets(value => [...value.filter(asset => asset.kind !== kind), saved]); setFiles(value => ({ ...value, [kind]: undefined })); await onSaved(); toast({ title: "تم حفظ الشعار", description: "ظهر التغيير في المواضع المرتبطة مباشرة." }); } catch (error) { toast({ title: "تعذر رفع الشعار", description: String(error), variant: "destructive" }); } finally { setSaving(null); } };
  const restore = async () => { if (!removeKind) return; try { await api(`/api/admin/content/branding/${removeKind}`, { method: "DELETE" }); setAssets(value => value.filter(asset => asset.kind !== removeKind)); setRemoveKind(null); await onSaved(); toast({ title: "تمت استعادة الوضع الافتراضي" }); } catch (error) { toast({ title: "تعذر الاستعادة", description: String(error), variant: "destructive" }); } };
  return <div className="space-y-5"><div><h2 className="text-2xl font-black">الهوية والشعارات</h2><p className="mt-1 text-sm text-muted-foreground">WebP وSVG آمن، مع حفظ metadata والتخزين المحلي أو S3 حسب إعداد الخادم.</p></div><div className="grid gap-5 lg:grid-cols-2">{definitions.map(definition => { const asset = assets.find(item => item.kind === definition.kind); const selected = files[definition.kind]; const preview = selected ? URL.createObjectURL(selected) : asset?.url; return <Card key={definition.kind}><CardHeader><CardTitle>{definition.label}</CardTitle><CardDescription>{definition.description}</CardDescription></CardHeader><CardContent className="space-y-4"><div className={`grid h-40 place-items-center overflow-hidden rounded-2xl border border-dashed p-4 ${definition.kind === "dark_background" ? "bg-slate-950" : "bg-slate-50"}`}>{preview ? <img src={preview} alt={definition.label} className="max-h-full max-w-full object-contain" onLoad={() => { if (selected) URL.revokeObjectURL(preview); }} /> : <div className="text-center text-muted-foreground"><ImagePlus className="mx-auto mb-2 h-9 w-9" /><span className="text-sm">الوضع الافتراضي</span></div>}</div>{asset && <p className="text-xs text-muted-foreground">{asset.mimeType} • {asset.width || "—"}×{asset.height || "—"} • {asset.sizeBytes ? `${Math.ceil(asset.sizeBytes / 1024)} KB` : "—"}</p>}{canManage && <><Label htmlFor={`brand-${definition.kind}`}>استبدال الملف</Label><Input id={`brand-${definition.kind}`} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={event => setFiles(value => ({ ...value, [definition.kind]: event.target.files?.[0] }))} /><div className="flex gap-2"><Button disabled={!selected || saving === definition.kind} onClick={() => void upload(definition.kind)}><Upload className="ml-2 h-4 w-4" />{saving === definition.kind ? "جاري الرفع..." : "رفع وحفظ"}</Button>{asset && <Button variant="outline" onClick={() => setRemoveKind(definition.kind)}><RotateCcw className="ml-2 h-4 w-4" /> استعادة الافتراضي</Button>}</div></>}</CardContent></Card>; })}</div><Dialog open={Boolean(removeKind)} onOpenChange={open => { if (!open) setRemoveKind(null); }}><DialogContent><DialogHeader><DialogTitle>استعادة الشعار الافتراضي؟</DialogTitle><DialogDescription>سيُحذف الملف المخصص لهذا الموضع فقط ويستمر باقي الموقع دون تغيير.</DialogDescription></DialogHeader><DialogFooter className="gap-2"><Button variant="outline" onClick={() => setRemoveKind(null)}>تراجع</Button><Button variant="destructive" onClick={() => void restore()}>تأكيد الاستعادة</Button></DialogFooter></DialogContent></Dialog></div>;
}
