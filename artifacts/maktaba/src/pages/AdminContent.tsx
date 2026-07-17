import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { getGetHomepageContentQueryKey, getGetSiteSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Eye, ImagePlus, Megaphone, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { HeroBanner, type HeroSlide } from "@/components/storefront/HeroBanner";
import { AdminHelpContent } from "@/components/admin/AdminHelpContent";
import { AdminBranding } from "@/components/admin/AdminBranding";

type Announcement = { text: string; isActive: boolean; link: string | null; startAt: string | null; endAt: string | null };
type Setting = { id: number; key: string; value?: string | null };
type AdminBanner = HeroSlide & {
  imageStorageKey?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  imageVariants?: Record<string, { url: string; width: number }> | null;
  startAt?: string | null;
  endAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type BannerDraft = {
  id?: number;
  imageUrl: string;
  titleAr: string;
  subtitleAr: string;
  badgeText: string;
  primaryButtonText: string;
  primaryButtonUrl: string;
  secondaryButtonText: string;
  secondaryButtonUrl: string;
  textAlignment: "right" | "center" | "left";
  sortOrder: number;
  isActive: boolean;
  startAt: string;
  endAt: string;
};

const emptyAnnouncement: Announcement = { text: "", isActive: false, link: null, startAt: null, endAt: null };
const emptyBanner = (sortOrder = 0): BannerDraft => ({ id: undefined, imageUrl: "", titleAr: "", subtitleAr: "", badgeText: "", primaryButtonText: "", primaryButtonUrl: "", secondaryButtonText: "", secondaryButtonUrl: "", textAlignment: "right", sortOrder, isActive: false, startAt: "", endAt: "" });

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const isForm = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(url, { credentials: "include", ...init, headers: { ...(!isForm && init?.body ? { "content-type": "application/json" } : {}), ...init?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string; message?: string } | null;
    throw new Error(body?.error || body?.message || "تعذر الاتصال بالخادم");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function toIso(value: string) { return value ? new Date(value).toISOString() : null; }

function formatSchedule(startAt?: string | null, endAt?: string | null) {
  if (!startAt && !endAt) return "يظهر دائمًا أثناء التفعيل";
  const format = (value: string) => new Date(value).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
  if (startAt && endAt) return `من ${format(startAt)} إلى ${format(endAt)}`;
  return startAt ? `يبدأ ${format(startAt)}` : `ينتهي ${format(endAt!)}`;
}

function isCurrentlyVisible(active: boolean, startAt?: string | null, endAt?: string | null) {
  const now = Date.now();
  return active && (!startAt || new Date(startAt).getTime() <= now) && (!endAt || new Date(endAt).getTime() >= now);
}

export default function AdminContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [announcement, setAnnouncement] = useState<Announcement>(emptyAnnouncement);
  const [banners, setBanners] = useState<AdminBanner[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [announcementPreview, setAnnouncementPreview] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewSlide, setPreviewSlide] = useState<AdminBanner | null>(null);
  const [draft, setDraft] = useState<BannerDraft>(emptyBanner());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [savingBanner, setSavingBanner] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const refreshPublicContent = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetHomepageContentQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetSiteSettingsQueryKey() }),
    ]);
  }, [queryClient]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [announcementData, bannerData, settingsData] = await Promise.all([
        api<Announcement>("/api/admin/content/announcement"),
        api<AdminBanner[]>("/api/admin/content/banners"),
        api<Setting[]>("/api/admin/content/settings"),
      ]);
      setAnnouncement({ ...announcementData, startAt: toDateTimeLocal(announcementData.startAt), endAt: toDateTimeLocal(announcementData.endAt) }); setBanners(bannerData); setSettings(settingsData);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "تعذر تحميل المحتوى"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveAnnouncement = async (event: FormEvent) => {
    event.preventDefault(); setAnnouncementSaving(true);
    try {
      const saved = await api<Announcement>("/api/admin/content/announcement", { method: "PUT", body: JSON.stringify({ ...announcement, link: announcement.link || null, startAt: announcement.startAt ? toIso(announcement.startAt) : null, endAt: announcement.endAt ? toIso(announcement.endAt) : null }) });
      setAnnouncement({ ...saved, startAt: saved.startAt ? toDateTimeLocal(saved.startAt) : null, endAt: saved.endAt ? toDateTimeLocal(saved.endAt) : null });
      await refreshPublicContent();
      toast({ title: "تم حفظ شريط الإعلان", description: "أصبح التغيير متاحًا للمتجر مباشرة." });
    } catch (reason) { toast({ title: "تعذر حفظ شريط الإعلان", description: reason instanceof Error ? reason.message : String(reason), variant: "destructive" }); }
    finally { setAnnouncementSaving(false); }
  };

  const openNewBanner = () => { setDraft(emptyBanner((banners.at(-1)?.sortOrder || 0) + 1)); setImageFile(null); setEditorOpen(true); };
  const openBanner = (banner: AdminBanner) => {
    setDraft({ id: banner.id, imageUrl: banner.imageUrl, titleAr: banner.titleAr || "", subtitleAr: banner.subtitleAr || "", badgeText: banner.badgeText || "", primaryButtonText: banner.primaryButtonText || "", primaryButtonUrl: banner.primaryButtonUrl || banner.linkUrl || "", secondaryButtonText: banner.secondaryButtonText || "", secondaryButtonUrl: banner.secondaryButtonUrl || "", textAlignment: banner.textAlignment || "right", sortOrder: banner.sortOrder, isActive: banner.isActive, startAt: toDateTimeLocal(banner.startAt), endAt: toDateTimeLocal(banner.endAt) });
    setImageFile(null); setEditorOpen(true);
  };

  const imagePreviewUrl = useMemo(() => imageFile ? URL.createObjectURL(imageFile) : null, [imageFile]);
  useEffect(() => () => { if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl); }, [imagePreviewUrl]);
  const previewDraft = useMemo<AdminBanner>(() => ({
    id: draft.id || -1,
    imageUrl: imagePreviewUrl || draft.imageUrl,
    titleAr: draft.titleAr,
    subtitleAr: draft.subtitleAr || null,
    badgeText: draft.badgeText || null,
    primaryButtonText: draft.primaryButtonText || null,
    primaryButtonUrl: draft.primaryButtonUrl || null,
    secondaryButtonText: draft.secondaryButtonText || null,
    secondaryButtonUrl: draft.secondaryButtonUrl || null,
    textAlignment: draft.textAlignment,
    sortOrder: draft.sortOrder,
    isActive: draft.isActive,
  }), [draft, imagePreviewUrl]);

  const uploadNewImage = async (file: File) => {
    const body = new FormData(); body.append("image", file);
    return api<Pick<AdminBanner, "imageUrl" | "imageStorageKey" | "imageWidth" | "imageHeight" | "imageVariants">>("/api/admin/content/banners/upload", { method: "POST", body });
  };

  const saveBanner = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.imageUrl && !imageFile) { toast({ title: "صورة البانر مطلوبة", variant: "destructive" }); return; }
    setSavingBanner(true);
    try {
      let image = { imageUrl: draft.imageUrl } as Partial<AdminBanner>;
      if (!draft.id && imageFile) image = await uploadNewImage(imageFile);
      const payload = {
        imageUrl: image.imageUrl,
        ...(!draft.id ? image : {}),
        titleAr: draft.titleAr,
        subtitleAr: draft.subtitleAr || null,
        badgeText: draft.badgeText || null,
        primaryButtonText: draft.primaryButtonText || null,
        primaryButtonUrl: draft.primaryButtonUrl || null,
        secondaryButtonText: draft.secondaryButtonText || null,
        secondaryButtonUrl: draft.secondaryButtonUrl || null,
        textAlignment: draft.textAlignment,
        sortOrder: Number(draft.sortOrder),
        isActive: draft.isActive,
        startAt: toIso(draft.startAt),
        endAt: toIso(draft.endAt),
      };
      let saved = draft.id
        ? await api<AdminBanner>(`/api/admin/content/banners/${draft.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await api<AdminBanner>("/api/admin/content/banners", { method: "POST", body: JSON.stringify(payload) });
      if (draft.id && imageFile) {
        const body = new FormData(); body.append("image", imageFile);
        saved = await api<AdminBanner>(`/api/admin/content/banners/${draft.id}/image`, { method: "PUT", body });
      }
      setBanners(rows => [...rows.filter(row => row.id !== saved.id), saved].sort((a, b) => a.sortOrder - b.sortOrder));
      setEditorOpen(false); setImageFile(null); await refreshPublicContent();
      toast({ title: draft.id ? "تم تحديث شريحة البانر" : "تم إنشاء شريحة البانر", description: saved.isActive ? "تظهر وفق جدول النشر المحدد." : "محفوظة كمسودة غير نشطة." });
    } catch (reason) { toast({ title: "تعذر حفظ البانر", description: reason instanceof Error ? reason.message : String(reason), variant: "destructive" }); }
    finally { setSavingBanner(false); }
  };

  const toggleBanner = async (banner: AdminBanner) => {
    try {
      const saved = await api<AdminBanner>(`/api/admin/content/banners/${banner.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !banner.isActive }) });
      setBanners(rows => rows.map(row => row.id === saved.id ? saved : row)); await refreshPublicContent();
      toast({ title: saved.isActive ? "تم تفعيل الشريحة" : "تم إيقاف الشريحة" });
    } catch (reason) { toast({ title: "تعذر تغيير الحالة", description: reason instanceof Error ? reason.message : String(reason), variant: "destructive" }); }
  };

  const deleteBanner = async () => {
    if (!deletingId) return;
    try {
      await api(`/api/admin/content/banners/${deletingId}`, { method: "DELETE" });
      setBanners(rows => rows.filter(row => row.id !== deletingId)); setDeletingId(null); await refreshPublicContent();
      toast({ title: "تم حذف شريحة البانر" });
    } catch (reason) { toast({ title: "تعذر حذف البانر", description: reason instanceof Error ? reason.message : String(reason), variant: "destructive" }); }
  };

  if (loading) return <Card><CardContent className="py-24 text-center text-muted-foreground">جاري تحميل محتوى الصفحة الرئيسية...</CardContent></Card>;
  if (error) return <Card className="border-destructive/30"><CardContent className="py-20 text-center"><p className="font-bold text-destructive">تعذر تحميل إدارة المحتوى</p><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button className="mt-5" onClick={() => void load()}>إعادة المحاولة</Button></CardContent></Card>;

  return (
    <section dir="rtl" className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div><h1 className="text-3xl font-black">إدارة المحتوى</h1><p className="mt-1 text-muted-foreground">تحكم مباشر في واجهة المتجر مع جدولة ومعاينة قبل النشر.</p></div>
        <Badge variant="outline" className="w-fit gap-2 px-3 py-2"><Save className="h-4 w-4" /> محفوظ في PostgreSQL</Badge>
      </div>

      <Tabs defaultValue="homepage" dir="rtl">
        <TabsList className="grid h-auto w-full max-w-3xl grid-cols-2 sm:grid-cols-4"><TabsTrigger value="homepage">الصفحة الرئيسية</TabsTrigger><TabsTrigger value="help">المساعدة</TabsTrigger><TabsTrigger value="branding">الشعارات</TabsTrigger><TabsTrigger value="general">الإعدادات العامة</TabsTrigger></TabsList>
        <TabsContent value="homepage" className="mt-6 space-y-6">
          <Card>
            <CardHeader><div className="flex items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-sky-600" /> شريط الإعلان</CardTitle><CardDescription className="mt-2">النص أعلى الموقع، مع رابط اختياري وجدولة زمنية مستقلة.</CardDescription></div><Badge variant={isCurrentlyVisible(announcement.isActive, announcement.startAt ? toIso(announcement.startAt) : null, announcement.endAt ? toIso(announcement.endAt) : null) ? "default" : "secondary"}>{isCurrentlyVisible(announcement.isActive, announcement.startAt ? toIso(announcement.startAt) : null, announcement.endAt ? toIso(announcement.endAt) : null) ? "ظاهر الآن" : "غير ظاهر"}</Badge></div></CardHeader>
            <CardContent><form onSubmit={saveAnnouncement} className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2"><Label htmlFor="announcement-text">نص الإعلان</Label><Textarea id="announcement-text" required maxLength={500} value={announcement.text} onChange={event => setAnnouncement(value => ({ ...value, text: event.target.value }))} placeholder="اكتب الإعلان الذي سيظهر للزوار" /></div>
              <div className="space-y-2 md:col-span-2"><Label htmlFor="announcement-link">رابط الإعلان (اختياري)</Label><Input id="announcement-link" dir="ltr" className="text-right" value={announcement.link || ""} onChange={event => setAnnouncement(value => ({ ...value, link: event.target.value }))} placeholder="/offers أو https://..." /></div>
              <DateFields start={announcement.startAt || ""} end={announcement.endAt || ""} onStart={startAt => setAnnouncement(value => ({ ...value, startAt }))} onEnd={endAt => setAnnouncement(value => ({ ...value, endAt }))} prefix="announcement" />
              <div className="flex items-center justify-between rounded-xl border p-4 md:col-span-2"><div><Label htmlFor="announcement-active">تفعيل الإعلان</Label><p className="mt-1 text-xs text-muted-foreground">لن يظهر خارج المدة المحددة حتى لو كان مفعّلًا.</p></div><Switch id="announcement-active" checked={announcement.isActive} onCheckedChange={isActive => setAnnouncement(value => ({ ...value, isActive }))} /></div>
              <div className="flex flex-wrap gap-3 md:col-span-2"><Button type="button" variant="outline" onClick={() => setAnnouncementPreview(true)}><Eye className="ml-2 h-4 w-4" /> معاينة</Button><Button type="submit" disabled={announcementSaving}>{announcementSaving ? "جاري الحفظ..." : <><Save className="ml-2 h-4 w-4" /> حفظ الإعلان</>}</Button></div>
            </form></CardContent>
          </Card>

          <div className="flex items-center justify-between gap-4"><div><h2 className="text-2xl font-black">شرائح البانر الرئيسي</h2><p className="mt-1 text-sm text-muted-foreground">يدعم عدة شرائح مرتبة مع حالة وجدول نشر مستقل لكل شريحة.</p></div><Button onClick={openNewBanner}><Plus className="ml-2 h-4 w-4" /> شريحة جديدة</Button></div>
          {!banners.length ? <Card><CardContent className="py-20 text-center"><ImagePlus className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" /><p className="font-bold">لا توجد شرائح بانر</p><p className="mt-1 text-sm text-muted-foreground">أضف أول شريحة ثم عاينها قبل تفعيلها.</p></CardContent></Card> : <div className="grid gap-5 xl:grid-cols-2">{banners.map(banner => <BannerCard key={banner.id} banner={banner} onEdit={() => openBanner(banner)} onPreview={() => setPreviewSlide(banner)} onToggle={() => void toggleBanner(banner)} onDelete={() => setDeletingId(banner.id)} />)}</div>}
        </TabsContent>
        <TabsContent value="help" className="mt-6"><AdminHelpContent onSaved={refreshPublicContent} /></TabsContent>
        <TabsContent value="branding" className="mt-6"><AdminBranding onSaved={refreshPublicContent} /></TabsContent>
        <TabsContent value="general" className="mt-6"><GeneralSettings settings={settings} onSettingsChange={setSettings} onSaved={refreshPublicContent} /></TabsContent>
      </Tabs>

      <Dialog open={announcementPreview} onOpenChange={setAnnouncementPreview}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>معاينة شريط الإعلان</DialogTitle><DialogDescription>هذه المعاينة لا تنشر أي تغيير قبل الضغط على حفظ.</DialogDescription></DialogHeader><div className="overflow-hidden rounded-xl border"><div className="bg-primary px-4 py-3 text-center text-sm font-bold text-primary-foreground">{announcement.text || " "}</div><div className="h-28 bg-slate-50" /></div></DialogContent></Dialog>
      <Dialog open={Boolean(previewSlide)} onOpenChange={open => { if (!open) setPreviewSlide(null); }}><DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto p-0"><DialogHeader className="px-6 pt-6"><DialogTitle>معاينة شريحة البانر</DialogTitle><DialogDescription>المعاينة تستخدم نفس تصميم الصفحة الرئيسية.</DialogDescription></DialogHeader>{previewSlide && <HeroBanner slide={previewSlide} preview className="rounded-b-lg" />}</DialogContent></Dialog>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}><DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>{draft.id ? "تعديل شريحة البانر" : "إضافة شريحة بانر"}</DialogTitle><DialogDescription>أدخل المحتوى، عاينه، ثم فعّله عندما يصبح جاهزًا للنشر.</DialogDescription></DialogHeader><form onSubmit={saveBanner} className="space-y-6">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="العنوان الرئيسي" htmlFor="hero-title"><Input id="hero-title" required maxLength={300} value={draft.titleAr} onChange={event => setDraft(value => ({ ...value, titleAr: event.target.value }))} /></Field>
          <Field label="نص الشارة" htmlFor="hero-badge"><Input id="hero-badge" maxLength={120} value={draft.badgeText} onChange={event => setDraft(value => ({ ...value, badgeText: event.target.value }))} /></Field>
          <div className="space-y-2 md:col-span-2"><Label htmlFor="hero-subtitle">الوصف</Label><Textarea id="hero-subtitle" maxLength={600} value={draft.subtitleAr} onChange={event => setDraft(value => ({ ...value, subtitleAr: event.target.value }))} /></div>
          <Field label="نص الزر الأساسي" htmlFor="hero-primary-text"><Input id="hero-primary-text" maxLength={120} value={draft.primaryButtonText} onChange={event => setDraft(value => ({ ...value, primaryButtonText: event.target.value }))} /></Field>
          <Field label="رابط الزر الأساسي" htmlFor="hero-primary-link"><Input id="hero-primary-link" dir="ltr" className="text-right" value={draft.primaryButtonUrl} onChange={event => setDraft(value => ({ ...value, primaryButtonUrl: event.target.value }))} placeholder="/catalog" /></Field>
          <Field label="نص الزر الثانوي" htmlFor="hero-secondary-text"><Input id="hero-secondary-text" maxLength={120} value={draft.secondaryButtonText} onChange={event => setDraft(value => ({ ...value, secondaryButtonText: event.target.value }))} /></Field>
          <Field label="رابط الزر الثانوي" htmlFor="hero-secondary-link"><Input id="hero-secondary-link" dir="ltr" className="text-right" value={draft.secondaryButtonUrl} onChange={event => setDraft(value => ({ ...value, secondaryButtonUrl: event.target.value }))} placeholder="/offers" /></Field>
          <Field label="محاذاة النص" htmlFor="hero-alignment"><Select value={draft.textAlignment} onValueChange={(textAlignment: BannerDraft["textAlignment"]) => setDraft(value => ({ ...value, textAlignment }))}><SelectTrigger id="hero-alignment"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="right">يمين</SelectItem><SelectItem value="center">وسط</SelectItem><SelectItem value="left">يسار</SelectItem></SelectContent></Select></Field>
          <Field label="ترتيب العرض" htmlFor="hero-order"><Input id="hero-order" type="number" min={0} max={10000} value={draft.sortOrder} onChange={event => setDraft(value => ({ ...value, sortOrder: Number(event.target.value) }))} /></Field>
          <div className="space-y-2 md:col-span-2"><Label htmlFor="hero-image">صورة خلفية البانر</Label><Input id="hero-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setImageFile(event.target.files?.[0] || null)} /><p className="text-xs text-muted-foreground">JPG أو PNG أو WebP، بحد أقصى 10 ميجابايت. اتركه فارغًا للاحتفاظ بالصورة الحالية.</p></div>
          <DateFields start={draft.startAt} end={draft.endAt} onStart={startAt => setDraft(value => ({ ...value, startAt }))} onEnd={endAt => setDraft(value => ({ ...value, endAt }))} prefix="hero" />
          <div className="flex items-center justify-between rounded-xl border p-4 md:col-span-2"><div><Label htmlFor="hero-active">نشر الشريحة</Label><p className="mt-1 text-xs text-muted-foreground">يمكن حفظها غير نشطة كمسودة.</p></div><Switch id="hero-active" checked={draft.isActive} onCheckedChange={isActive => setDraft(value => ({ ...value, isActive }))} /></div>
        </div>
        <div className="space-y-3"><div className="flex items-center gap-2 font-bold"><Eye className="h-4 w-4" /> المعاينة قبل النشر</div><HeroBanner slide={previewDraft} preview className="rounded-2xl border" /></div>
        <DialogFooter className="gap-2"><Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>إلغاء</Button><Button type="submit" disabled={savingBanner}>{savingBanner ? "جاري الحفظ..." : <><Save className="ml-2 h-4 w-4" /> حفظ الشريحة</>}</Button></DialogFooter>
      </form></DialogContent></Dialog>

      <Dialog open={Boolean(deletingId)} onOpenChange={open => { if (!open) setDeletingId(null); }}><DialogContent><DialogHeader><DialogTitle>حذف شريحة البانر؟</DialogTitle><DialogDescription>سيُحذف المحتوى والصورة المرفوعة نهائيًا، وسيُسجل الإجراء في سجل التدقيق.</DialogDescription></DialogHeader><DialogFooter className="gap-2"><Button variant="outline" onClick={() => setDeletingId(null)}>تراجع</Button><Button variant="destructive" onClick={() => void deleteBanner()}><Trash2 className="ml-2 h-4 w-4" /> حذف نهائي</Button></DialogFooter></DialogContent></Dialog>
    </section>
  );
}

function DateFields({ start, end, onStart, onEnd, prefix }: { start: string; end: string; onStart: (value: string) => void; onEnd: (value: string) => void; prefix: string }) {
  return <><Field label="تاريخ ووقت البداية (اختياري)" htmlFor={`${prefix}-start`}><Input id={`${prefix}-start`} type="datetime-local" value={start} onChange={event => onStart(event.target.value)} /></Field><Field label="تاريخ ووقت النهاية (اختياري)" htmlFor={`${prefix}-end`}><Input id={`${prefix}-end`} type="datetime-local" min={start || undefined} value={end} onChange={event => onEnd(event.target.value)} /></Field></>;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) { return <div className="space-y-2"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>; }

function BannerCard({ banner, onEdit, onPreview, onToggle, onDelete }: { banner: AdminBanner; onEdit: () => void; onPreview: () => void; onToggle: () => void; onDelete: () => void }) {
  const visible = isCurrentlyVisible(banner.isActive, banner.startAt, banner.endAt);
  return <Card className="overflow-hidden"><div className="relative aspect-[16/6] overflow-hidden bg-slate-950"><img src={banner.imageUrl} alt={banner.titleAr || ""} className="h-full w-full object-cover opacity-70" /><div className="absolute inset-0 bg-gradient-to-l from-slate-950/80 to-transparent" /><div className="absolute inset-x-4 bottom-4 text-white"><div className="mb-2 flex gap-2"><Badge className="bg-white/90 text-slate-950">ترتيب {banner.sortOrder}</Badge><Badge variant={visible ? "default" : "secondary"}>{visible ? "ظاهر الآن" : banner.isActive ? "مجدول" : "مسودة"}</Badge></div><h3 className="line-clamp-1 text-xl font-black">{banner.titleAr}</h3><p className="mt-1 line-clamp-1 text-sm text-slate-200">{banner.subtitleAr}</p></div></div><CardContent className="space-y-4 p-4"><div className="flex items-start gap-2 text-xs text-muted-foreground"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0" /><span>{formatSchedule(banner.startAt, banner.endAt)}</span></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={onPreview}><Eye className="ml-1 h-4 w-4" /> معاينة</Button><Button size="sm" onClick={onEdit}><Pencil className="ml-1 h-4 w-4" /> تعديل</Button><Button size="sm" variant="secondary" onClick={onToggle}>{banner.isActive ? "إيقاف" : "تفعيل"}</Button><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="ml-1 h-4 w-4" /> حذف</Button></div></CardContent></Card>;
}

const managedAnnouncementKeys = new Set(["announcementBar", "announcementEnabled", "announcementLink", "announcementStartAt", "announcementEndAt"]);
const settingLabels: Record<string, string> = { storeNameAr: "اسم المتجر بالعربية", storeName: "اسم المتجر بالإنجليزية", whatsappNumber: "رقم واتساب", phoneNumber: "رقم الهاتف", email: "البريد الإلكتروني", address: "العنوان", facebookUrl: "رابط فيسبوك", instagramUrl: "رابط إنستغرام", tiktokUrl: "رابط تيك توك", telegramUrl: "رابط تيليغرام", seoTitle: "عنوان SEO", seoDescription: "وصف SEO", logoUrl: "رابط الشعار", shipping_policy: "سياسة الشحن", return_policy: "سياسة الاسترجاع" };

function GeneralSettings({ settings, onSettingsChange, onSaved }: { settings: Setting[]; onSettingsChange: (settings: Setting[]) => void; onSaved: () => Promise<void> }) {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(settings.map(row => [row.key, row.value || ""])));
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const rows = settings.filter(row => !managedAnnouncementKeys.has(row.key) && row.key !== "logoUrl");
  const save = async (key: string) => { setSavingKey(key); try { const saved = await api<Setting>(`/api/admin/content/settings/${encodeURIComponent(key)}`, { method: "PUT", body: JSON.stringify({ value: drafts[key] || "" }) }); onSettingsChange(settings.map(row => row.key === key ? saved : row)); await onSaved(); toast({ title: "تم حفظ الإعداد" }); } catch (reason) { toast({ title: "تعذر الحفظ", description: reason instanceof Error ? reason.message : String(reason), variant: "destructive" }); } finally { setSavingKey(null); } };
  return <div className="grid gap-4 md:grid-cols-2">{rows.map(row => <Card key={row.key}><CardHeader><CardTitle className="text-base">{settingLabels[row.key] || row.key}</CardTitle><CardDescription dir="ltr" className="text-right">{row.key}</CardDescription></CardHeader><CardContent className="space-y-3"><Textarea value={drafts[row.key] || ""} onChange={event => setDrafts(value => ({ ...value, [row.key]: event.target.value }))} /><Button size="sm" disabled={savingKey === row.key} onClick={() => void save(row.key)}>{savingKey === row.key ? "جاري الحفظ..." : "حفظ"}</Button></CardContent></Card>)}</div>;
}
