import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Archive,
  Check,
  Copy,
  Edit3,
  MapPin,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: Record<string, unknown>,
  ) {
    super(message);
  }
}
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      body?.error || "تعذر الاتصال بالخادم",
      response.status,
      body,
    );
  return body as T;
}
function useResource<T>(url: string, enabled = true) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    if (!enabled || !url) return;
    setLoading(true);
    setError("");
    try {
      setData(await api<T>(url));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }, [enabled, url]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, loading, error, reload };
}
function PageState({
  loading,
  error,
  empty,
  children,
}: {
  loading: boolean;
  error: string;
  empty: boolean;
  children: ReactNode;
}) {
  if (loading)
    return (
      <Card>
        <CardContent className="py-16 text-center">
          جاري تحميل البيانات...
        </CardContent>
      </Card>
    );
  if (error)
    return (
      <Card className="border-destructive/30">
        <CardContent className="py-16 text-center text-destructive">
          {error}
        </CardContent>
      </Card>
    );
  if (empty)
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          لا توجد بيانات مطابقة
        </CardContent>
      </Card>
    );
  return <>{children}</>;
}
function usePermission(permission: string) {
  const { admin } = useAuth();
  return Boolean(
    admin &&
    (admin.role === "owner" ||
      admin.role === "administrator" ||
      admin.permissions?.includes(permission)),
  );
}
function formatDate(value?: string | null) {
  return value
    ? new Date(value).toLocaleString("ar-EG", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
}

type Governorate = {
  id: number;
  nameAr: string;
  nameEn?: string;
  shippingCost: number;
  remoteAreaSurcharge: number;
  freeShippingThreshold: number | null;
  minDeliveryDays: number;
  maxDeliveryDays: number;
  shippingNotes?: string | null;
  deliveryAvailable: boolean;
  isActive: boolean;
  updatedAt: string;
  updatedByName?: string | null;
};
type City = {
  id: number;
  nameAr: string;
  shippingPriceOverride: number | null;
  surcharge: number;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
  notes?: string | null;
  isActive: boolean;
};
export function AdminShipping() {
  const canEdit = usePermission("shipping.edit");
  const resource = useResource<Governorate[]>(
    "/api/admin/shipping/governorates",
  );
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<number, Governorate>>({});
  const [baseline, setBaseline] = useState("");
  const [saving, setSaving] = useState(false);
  const [cityGovernorate, setCityGovernorate] = useState<Governorate | null>(
    null,
  );
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );
  useEffect(() => {
    if (resource.data) {
      const nextDrafts = Object.fromEntries(
        resource.data.map((row) => [row.id, row]),
      );
      setDrafts(nextDrafts);
      setBaseline(JSON.stringify(Object.values(nextDrafts)));
    }
  }, [resource.data]);
  const rows = Object.values(drafts);
  const dirty = Boolean(rows.length && JSON.stringify(rows) !== baseline);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const interceptLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!target || target.target === "_blank") return;
      const next = new URL(target.href, window.location.href);
      if (
        next.origin !== window.location.origin ||
        next.href === window.location.href
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation(next.href);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", interceptLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", interceptLink, true);
    };
  }, [dirty]);
  const errors = useMemo(
    () =>
      Object.fromEntries(
        rows.flatMap((row) => {
          const messages = [];
          if (
            row.shippingCost < 0 ||
            (row.freeShippingThreshold != null && row.freeShippingThreshold < 0)
          )
            messages.push("الأسعار لا يمكن أن تكون سالبة");
          if (row.minDeliveryDays < 0)
            messages.push("الحد الأدنى لا يمكن أن يكون سالبًا");
          if (row.maxDeliveryDays < row.minDeliveryDays)
            messages.push("الحد الأقصى يجب أن يساوي أو يزيد عن الحد الأدنى");
          return messages.length ? [[row.id, messages.join("، ")]] : [];
        }),
      ),
    [rows],
  );
  const update = <K extends keyof Governorate>(
    id: number,
    key: K,
    value: Governorate[K] | null,
  ) =>
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [key]: value as Governorate[K] },
    }));
  const saveAll = async () => {
    if (!canEdit || Object.keys(errors).length) {
      toast({ title: "راجع أخطاء بيانات الشحن", variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      const saved = await api<Governorate[]>(
        "/api/admin/shipping/governorates",
        {
          method: "PATCH",
          body: JSON.stringify(
            rows.map(
              ({
                id,
                shippingCost,
                remoteAreaSurcharge,
                freeShippingThreshold,
                minDeliveryDays,
                maxDeliveryDays,
                shippingNotes,
                deliveryAvailable,
                isActive,
              }) => ({
                id,
                shippingCost,
                remoteAreaSurcharge,
                freeShippingThreshold,
                minDeliveryDays,
                maxDeliveryDays,
                shippingNotes: shippingNotes || null,
                deliveryAvailable,
                isActive,
              }),
            ),
          ),
        },
      );
      setDrafts(Object.fromEntries(saved.map((row) => [row.id, row])));
      setBaseline(JSON.stringify(saved));
      toast({
        title: "تم حفظ إعدادات الشحن",
        description: `تم تحديث ${saved.length} محافظة وتسجيل العملية.`,
        variant: "success",
      });
      await resource.reload();
    } catch (reason) {
      toast({
        title: "تعذر حفظ إعدادات الشحن",
        description: reason instanceof Error ? reason.message : "حاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">الشحن والمحافظات</h1>
          <p className="text-muted-foreground">
            الأسعار ونطاق أيام التوصيل المعروضة للعملاء
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => void saveAll()}
            disabled={!dirty || saving || Boolean(Object.keys(errors).length)}
          >
            <Save className="ml-2 h-4 w-4" />
            {saving
              ? "جاري الحفظ..."
              : dirty
                ? "حفظ كل التغييرات"
                : "لا توجد تغييرات"}
          </Button>
        )}
      </div>
      {dirty && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900">
          لديك تغييرات غير محفوظة.
        </div>
      )}
      <PageState
        loading={resource.loading}
        error={resource.error}
        empty={!rows.length}
      >
        <div className="hidden overflow-x-auto rounded-xl border bg-card xl:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-36">المحافظة</TableHead>
                <TableHead>سعر الشحن</TableHead>
                <TableHead>حد المجاني</TableHead>
                <TableHead>أقل أيام</TableHead>
                <TableHead>أقصى أيام</TableHead>
                <TableHead className="min-w-44">ملاحظات</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="min-w-40">آخر تحديث</TableHead>
                <TableHead>المدن</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={errors[row.id] ? "bg-destructive/5" : ""}
                >
                  <TableCell>
                    <strong>{row.nameAr}</strong>
                    <span className="block text-xs text-muted-foreground">
                      {row.nameEn}
                    </span>
                    {errors[row.id] && (
                      <span className="mt-1 block text-xs text-destructive">
                        {errors[row.id]}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={`سعر شحن ${row.nameAr}`}
                      disabled={!canEdit}
                      type="number"
                      min="0"
                      className="w-24"
                      value={row.shippingCost}
                      onChange={(event) =>
                        update(
                          row.id,
                          "shippingCost",
                          Number(event.target.value),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={`حد الشحن المجاني ${row.nameAr}`}
                      disabled={!canEdit}
                      type="number"
                      min="0"
                      className="w-28"
                      value={row.freeShippingThreshold ?? ""}
                      onChange={(event) =>
                        update(
                          row.id,
                          "freeShippingThreshold",
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={`أقل أيام ${row.nameAr}`}
                      disabled={!canEdit}
                      type="number"
                      min="0"
                      className="w-20"
                      value={row.minDeliveryDays}
                      onChange={(event) =>
                        update(
                          row.id,
                          "minDeliveryDays",
                          Number(event.target.value),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={`أقصى أيام ${row.nameAr}`}
                      disabled={!canEdit}
                      type="number"
                      min="0"
                      className="w-20"
                      value={row.maxDeliveryDays}
                      onChange={(event) =>
                        update(
                          row.id,
                          "maxDeliveryDays",
                          Number(event.target.value),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Textarea
                      disabled={!canEdit}
                      rows={2}
                      className="min-w-44"
                      value={row.shippingNotes || ""}
                      onChange={(event) =>
                        update(row.id, "shippingNotes", event.target.value)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      disabled={!canEdit}
                      checked={row.isActive}
                      onCheckedChange={(value) =>
                        update(row.id, "isActive", value)
                      }
                    />
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatDate(row.updatedAt)}
                    <span className="block text-muted-foreground">
                      {row.updatedByName || "النظام"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCityGovernorate(row)}
                    >
                      <MapPin className="ml-1 h-4 w-4" />
                      المدن
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="grid gap-4 xl:hidden">
          {rows.map((row) => (
            <Card
              key={row.id}
              className={errors[row.id] ? "border-destructive" : ""}
            >
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>{row.nameAr}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {row.updatedByName || "النظام"} •{" "}
                    {formatDate(row.updatedAt)}
                  </p>
                </div>
                <Switch
                  disabled={!canEdit}
                  checked={row.isActive}
                  onCheckedChange={(value) => update(row.id, "isActive", value)}
                />
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <FieldNumber
                  label="سعر الشحن"
                  value={row.shippingCost}
                  disabled={!canEdit}
                  onChange={(value) => update(row.id, "shippingCost", value)}
                />
                <FieldNumber
                  label="حد الشحن المجاني"
                  value={row.freeShippingThreshold}
                  disabled={!canEdit}
                  nullable
                  onChange={(value) =>
                    update(row.id, "freeShippingThreshold", value)
                  }
                />
                <FieldNumber
                  label="الحد الأدنى للأيام"
                  value={row.minDeliveryDays}
                  disabled={!canEdit}
                  onChange={(value) => update(row.id, "minDeliveryDays", value)}
                />
                <FieldNumber
                  label="الحد الأقصى للأيام"
                  value={row.maxDeliveryDays}
                  disabled={!canEdit}
                  onChange={(value) => update(row.id, "maxDeliveryDays", value)}
                />
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm">ملاحظات</span>
                  <Textarea
                    disabled={!canEdit}
                    value={row.shippingNotes || ""}
                    onChange={(event) =>
                      update(row.id, "shippingNotes", event.target.value)
                    }
                  />
                </label>
                {errors[row.id] && (
                  <p className="text-sm text-destructive sm:col-span-2">
                    {errors[row.id]}
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="sm:col-span-2"
                  onClick={() => setCityGovernorate(row)}
                >
                  إدارة المدن
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageState>
      <CityDialog
        governorate={cityGovernorate}
        canEdit={canEdit}
        onClose={() => setCityGovernorate(null)}
      />
      <AlertDialog
        open={Boolean(pendingNavigation)}
        onOpenChange={(open) => {
          if (!open) setPendingNavigation(null);
        }}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>لديك تغييرات غير محفوظة</AlertDialogTitle>
            <AlertDialogDescription>
              إذا غادرت الصفحة الآن ستفقد تعديلات أسعار ونطاقات الشحن التي لم
              تحفظها.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>البقاء ومراجعة التغييرات</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingNavigation) window.location.assign(pendingNavigation);
              }}
            >
              تجاهل التغييرات والمغادرة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
function FieldNumber({
  label,
  value,
  disabled,
  nullable,
  onChange,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  nullable?: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm">{label}</span>
      <Input
        type="number"
        min="0"
        disabled={disabled}
        value={value ?? ""}
        onChange={(event) =>
          onChange(
            nullable && event.target.value === ""
              ? null
              : Number(event.target.value),
          )
        }
      />
    </label>
  );
}
function CityDialog({
  governorate,
  canEdit,
  onClose,
}: {
  governorate: Governorate | null;
  canEdit: boolean;
  onClose: () => void;
}) {
  const resource = useResource<City[]>(
    governorate
      ? `/api/admin/shipping/governorates/${governorate.id}/cities`
      : "",
    Boolean(governorate),
  );
  const [drafts, setDrafts] = useState<Record<number, City>>({});
  const { toast } = useToast();
  useEffect(() => {
    if (resource.data)
      setDrafts(
        Object.fromEntries(resource.data.map((city) => [city.id, city])),
      );
  }, [resource.data]);
  const save = async (city: City) => {
    if (
      (city.minDeliveryDays == null) !== (city.maxDeliveryDays == null) ||
      (city.minDeliveryDays != null &&
        city.maxDeliveryDays != null &&
        city.maxDeliveryDays < city.minDeliveryDays)
    ) {
      toast({ title: "نطاق أيام المدينة غير صحيح", variant: "warning" });
      return;
    }
    try {
      await api(`/api/admin/shipping/cities/${city.id}`, {
        method: "PATCH",
        body: JSON.stringify(city),
      });
      toast({ title: `تم حفظ إعدادات ${city.nameAr}`, variant: "success" });
      await resource.reload();
    } catch (reason) {
      toast({
        title: "تعذر حفظ المدينة",
        description: String(reason),
        variant: "destructive",
      });
    }
  };
  return (
    <Dialog
      open={Boolean(governorate)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent dir="rtl" className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>مدن {governorate?.nameAr}</DialogTitle>
          <DialogDescription>
            يمكن ترك نطاق الأيام فارغًا لاستخدام نطاق المحافظة.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-3 overflow-y-auto">
          {resource.loading ? (
            <p className="py-10 text-center">جاري التحميل...</p>
          ) : (
            Object.values(drafts).map((city) => (
              <div
                key={city.id}
                className="grid items-end gap-3 rounded-xl border p-3 md:grid-cols-[1.4fr_repeat(4,1fr)_auto_auto]"
              >
                <strong>{city.nameAr}</strong>
                <FieldNumber
                  label="سعر بديل"
                  value={city.shippingPriceOverride}
                  nullable
                  disabled={!canEdit}
                  onChange={(value) =>
                    setDrafts((current) => ({
                      ...current,
                      [city.id]: { ...city, shippingPriceOverride: value },
                    }))
                  }
                />
                <FieldNumber
                  label="إضافة"
                  value={city.surcharge}
                  disabled={!canEdit}
                  onChange={(value) =>
                    setDrafts((current) => ({
                      ...current,
                      [city.id]: { ...city, surcharge: value || 0 },
                    }))
                  }
                />
                <FieldNumber
                  label="أقل أيام"
                  value={city.minDeliveryDays}
                  nullable
                  disabled={!canEdit}
                  onChange={(value) =>
                    setDrafts((current) => ({
                      ...current,
                      [city.id]: { ...city, minDeliveryDays: value },
                    }))
                  }
                />
                <FieldNumber
                  label="أقصى أيام"
                  value={city.maxDeliveryDays}
                  nullable
                  disabled={!canEdit}
                  onChange={(value) =>
                    setDrafts((current) => ({
                      ...current,
                      [city.id]: { ...city, maxDeliveryDays: value },
                    }))
                  }
                />
                <Switch
                  disabled={!canEdit}
                  checked={city.isActive}
                  onCheckedChange={(value) =>
                    setDrafts((current) => ({
                      ...current,
                      [city.id]: { ...city, isActive: value },
                    }))
                  }
                />
                {canEdit && (
                  <Button size="sm" onClick={() => void save(city)}>
                    حفظ
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Coupon = {
  id: number;
  code: string;
  type: "percentage" | "fixed" | "free_shipping";
  value: number;
  minOrderAmount: number | null;
  usedCount: number;
  maxUses: number | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  archivedAt?: string | null;
};
type CouponForm = {
  code: string;
  type: Coupon["type"];
  value: number;
  minOrderAmount: number | null;
  maxUses: number | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
};
const blankCoupon: CouponForm = {
  code: "",
  type: "percentage",
  value: 0,
  minOrderAmount: null,
  maxUses: null,
  startDate: "",
  endDate: "",
  isActive: true,
};
export function AdminCoupons() {
  const canManage = usePermission("coupons.manage");
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const resource = useResource<{ items: Coupon[] }>(
    `/api/admin/coupons?limit=100&q=${encodeURIComponent(q)}&status=${status}&type=${type}${validFrom ? `&validFrom=${validFrom}` : ""}${validTo ? `&validTo=${validTo}` : ""}`,
  );
  const [editing, setEditing] = useState<Coupon | null | "new">(null);
  const [form, setForm] = useState(blankCoupon);
  const [deleting, setDeleting] = useState<Coupon | null>(null);
  const open = (coupon?: Coupon) => {
    setEditing(coupon || "new");
    setForm(
      coupon
        ? {
            code: coupon.code,
            type: coupon.type,
            value: coupon.value,
            minOrderAmount: coupon.minOrderAmount,
            maxUses: coupon.maxUses,
            startDate: coupon.startDate || "",
            endDate: coupon.endDate || "",
            isActive: coupon.isActive,
          }
        : blankCoupon,
    );
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const target =
        editing === "new"
          ? "/api/admin/coupons"
          : `/api/admin/coupons/${(editing as Coupon).id}`;
      await api(target, {
        method: editing === "new" ? "POST" : "PATCH",
        body: JSON.stringify({
          ...form,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
        }),
      });
      toast({
        title: editing === "new" ? "تم إنشاء الكوبون" : "تم تحديث الكوبون",
        variant: "success",
      });
      setEditing(null);
      await resource.reload();
    } catch (reason) {
      toast({
        title: "تعذر حفظ الكوبون",
        description: reason instanceof Error ? reason.message : "راجع البيانات",
        variant: "destructive",
      });
    }
  };
  const toggle = async (coupon: Coupon) => {
    await api(`/api/admin/coupons/${coupon.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !coupon.isActive }),
    });
    toast({
      title: coupon.isActive ? "تم إيقاف الكوبون" : "تم تفعيل الكوبون",
      variant: "success",
    });
    await resource.reload();
  };
  const duplicate = async (coupon: Coupon) => {
    try {
      await api(`/api/admin/coupons/${coupon.id}/duplicate`, {
        method: "POST",
        body: "{}",
      });
      toast({
        title: "تم إنشاء نسخة غير مفعلة من الكوبون",
        variant: "success",
      });
      await resource.reload();
    } catch (reason) {
      toast({
        title: "تعذر نسخ الكوبون",
        description: String(reason),
        variant: "destructive",
      });
    }
  };
  const remove = async () => {
    if (!deleting) return;
    try {
      const outcome = await api<{ mode: string }>(
        `/api/admin/coupons/${deleting.id}`,
        { method: "DELETE" },
      );
      toast({
        title:
          outcome.mode === "archived"
            ? "تمت أرشفة الكوبون للحفاظ على سجله"
            : "تم حذف الكوبون",
        variant: "success",
      });
      setDeleting(null);
      await resource.reload();
    } catch (reason) {
      toast({
        title: "تعذر حذف الكوبون",
        description: String(reason),
        variant: "destructive",
      });
    }
  };
  const rows = resource.data?.items || [];
  return (
    <section className="space-y-6" dir="rtl">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">إدارة الكوبونات</h1>
          <p className="text-muted-foreground">
            الكوبونات المستخدمة تُؤرشف ولا تُحذف.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => open()}>
            <Plus className="ml-2 h-4 w-4" />
            كوبون جديد
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-3 xl:grid-cols-5">
          <div className="relative">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pr-9"
              placeholder="بحث بالكود"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="حالة الكوبون">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="inactive">غير نشط</SelectItem>
              <SelectItem value="scheduled">مجدول</SelectItem>
              <SelectItem value="expired">منتهي</SelectItem>
              <SelectItem value="archived">مؤرشف</SelectItem>
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger aria-label="نوع الكوبون">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأنواع</SelectItem>
              <SelectItem value="percentage">نسبة مئوية</SelectItem>
              <SelectItem value="fixed">قيمة ثابتة</SelectItem>
              <SelectItem value="free_shipping">شحن مجاني</SelectItem>
            </SelectContent>
          </Select>
          <FormLabelInput label="صالح من">
            <Input
              aria-label="صالح من"
              type="date"
              value={validFrom}
              onChange={(event) => setValidFrom(event.target.value)}
            />
          </FormLabelInput>
          <FormLabelInput label="صالح حتى">
            <Input
              aria-label="صالح حتى"
              type="date"
              value={validTo}
              onChange={(event) => setValidTo(event.target.value)}
            />
          </FormLabelInput>
        </CardContent>
      </Card>
      <PageState
        loading={resource.loading}
        error={resource.error}
        empty={!rows.length}
      >
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الكود</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>القيمة</TableHead>
                  <TableHead>الحد الأدنى</TableHead>
                  <TableHead>الاستخدام</TableHead>
                  <TableHead>البداية</TableHead>
                  <TableHead>النهاية</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell className="font-mono font-bold">
                      {coupon.code}
                    </TableCell>
                    <TableCell>
                      {coupon.type === "free_shipping"
                        ? "شحن مجاني"
                        : coupon.type === "percentage"
                          ? "نسبة"
                          : "قيمة ثابتة"}
                    </TableCell>
                    <TableCell>
                      {coupon.type === "percentage"
                        ? `${coupon.value}%`
                        : coupon.type === "fixed"
                          ? `${coupon.value} ج.م`
                          : "—"}
                    </TableCell>
                    <TableCell>
                      {coupon.minOrderAmount == null
                        ? "—"
                        : `${coupon.minOrderAmount} ج.م`}
                    </TableCell>
                    <TableCell>
                      {coupon.usedCount} / {coupon.maxUses ?? "∞"}
                    </TableCell>
                    <TableCell>{coupon.startDate || "فورًا"}</TableCell>
                    <TableCell>{coupon.endDate || "مفتوح"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          coupon.archivedAt
                            ? "secondary"
                            : coupon.isActive
                              ? "outline"
                              : "destructive"
                        }
                      >
                        {coupon.archivedAt
                          ? "مؤرشف"
                          : coupon.isActive
                            ? "نشط"
                            : "متوقف"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {canManage && (
                          <>
                            <Button
                              aria-label="تعديل"
                              size="icon"
                              variant="ghost"
                              onClick={() => open(coupon)}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              aria-label={coupon.isActive ? "إيقاف" : "تفعيل"}
                              size="icon"
                              variant="ghost"
                              onClick={() => void toggle(coupon)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              aria-label="نسخ"
                              size="icon"
                              variant="ghost"
                              onClick={() => void duplicate(coupon)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              aria-label="حذف أو أرشفة"
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => setDeleting(coupon)}
                            >
                              {coupon.usedCount ? (
                                <Archive className="h-4 w-4" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </PageState>
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(value) => {
          if (!value) setEditing(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editing === "new" ? "إضافة كوبون" : "تعديل الكوبون"}
            </DialogTitle>
            <DialogDescription>
              كل الحسابات تُعاد على الخادم عند إنشاء الطلب.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <FormLabelInput label="الكود">
              <Input
                value={form.code}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    code: event.target.value.toUpperCase(),
                  }))
                }
                required
              />
            </FormLabelInput>
            <FormLabelInput label="النوع">
              <Select
                value={form.type}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    type: value as Coupon["type"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">نسبة</SelectItem>
                  <SelectItem value="fixed">قيمة ثابتة</SelectItem>
                  <SelectItem value="free_shipping">شحن مجاني</SelectItem>
                </SelectContent>
              </Select>
            </FormLabelInput>
            <FormLabelInput label="القيمة">
              <Input
                type="number"
                min="0"
                max={form.type === "percentage" ? 100 : undefined}
                value={form.value}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    value: Number(event.target.value),
                  }))
                }
              />
            </FormLabelInput>
            <FormLabelInput label="أقل قيمة للطلب">
              <Input
                type="number"
                min="0"
                value={form.minOrderAmount ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    minOrderAmount: event.target.value
                      ? Number(event.target.value)
                      : null,
                  }))
                }
              />
            </FormLabelInput>
            <FormLabelInput label="أقصى استخدام">
              <Input
                type="number"
                min="0"
                value={form.maxUses ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    maxUses: event.target.value
                      ? Number(event.target.value)
                      : null,
                  }))
                }
              />
            </FormLabelInput>
            <FormLabelInput label="تاريخ البداية">
              <Input
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }))
                }
              />
            </FormLabelInput>
            <FormLabelInput label="تاريخ النهاية">
              <Input
                type="date"
                value={form.endDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }))
                }
              />
            </FormLabelInput>
            <label className="flex items-center gap-2 pt-7">
              <Switch
                checked={form.isActive}
                onCheckedChange={(value) =>
                  setForm((current) => ({ ...current, isActive: value }))
                }
              />
              نشط
            </label>
            <DialogFooter className="sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
              >
                إلغاء
              </Button>
              <Button type="submit">حفظ</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(value) => {
          if (!value) setDeleting(null);
        }}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleting?.usedCount ? "أرشفة الكوبون؟" : "حذف الكوبون نهائيًا؟"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.usedCount
                ? `استُخدم الكوبون ${deleting.usedCount} مرة، لذلك سيُعطّل ويُؤرشف مع الحفاظ على سجل الطلبات.`
                : "هذا الكوبون غير مستخدم ويمكن حذفه بأمان. لا يمكن التراجع عن الحذف."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>
              {deleting?.usedCount ? "أرشفة" : "حذف نهائي"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

type Classification = {
  id: number;
  nameAr: string;
  nameEn?: string | null;
  sortOrder: number;
  isActive: boolean;
  relatedProducts: number;
  updatedAt: string;
  stageId?: number | null;
  categoryId?: number | null;
};
const sections = [
  ["stages", "المراحل التعليمية"],
  ["grades", "الصفوف"],
  ["subjects", "المواد"],
  ["publishers", "دور النشر"],
  ["categories", "التصنيفات"],
  ["subcategories", "التصنيفات الفرعية"],
  ["teachers", "المدرسون"],
  ["school-years", "السنوات الدراسية"],
  ["education-types", "أنواع التعليم"],
] as const;
export function AdminClassifications() {
  const canManage = usePermission("classifications.manage");
  const { toast } = useToast();
  const [section, setSection] = useState<string>("stages");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("sort");
  const resource = useResource<Classification[]>(
    `/api/admin/classifications/${section}?q=${encodeURIComponent(q)}&status=${status}&sort=${sort}`,
  );
  const parents = useResource<Classification[]>(
    `/api/admin/classifications/${section === "grades" ? "stages" : "categories"}`,
    section === "grades" || section === "subcategories",
  );
  const [editing, setEditing] = useState<Classification | null | "new">(null);
  const [form, setForm] = useState({
    nameAr: "",
    nameEn: "",
    sortOrder: 0,
    isActive: true,
    parentId: "",
  });
  const [deleting, setDeleting] = useState<Classification | null>(null);
  const [blocked, setBlocked] = useState<Classification | null>(null);
  const [targetId, setTargetId] = useState("");
  const open = (row?: Classification) => {
    setEditing(row || "new");
    setForm(
      row
        ? {
            nameAr: row.nameAr,
            nameEn: row.nameEn || "",
            sortOrder: row.sortOrder || 0,
            isActive: row.isActive,
            parentId: String(
              section === "grades" ? row.stageId || "" : row.categoryId || "",
            ),
          }
        : {
            nameAr: "",
            nameEn: "",
            sortOrder: 0,
            isActive: true,
            parentId: "",
          },
    );
  };
  const payload = () => ({
    nameAr: form.nameAr,
    nameEn: form.nameEn || null,
    sortOrder: form.sortOrder,
    isActive: form.isActive,
    ...(section === "grades"
      ? { stageId: Number(form.parentId) || null }
      : section === "subcategories"
        ? { categoryId: Number(form.parentId) || null }
        : {}),
  });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api(
        editing === "new"
          ? `/api/admin/classifications/${section}`
          : `/api/admin/classifications/${section}/${(editing as Classification).id}`,
        {
          method: editing === "new" ? "POST" : "PATCH",
          body: JSON.stringify(payload()),
        },
      );
      toast({
        title: editing === "new" ? "تمت إضافة التصنيف" : "تم تعديل التصنيف",
        variant: "success",
      });
      setEditing(null);
      await resource.reload();
    } catch (reason) {
      toast({
        title: "تعذر حفظ التصنيف",
        description: reason instanceof Error ? reason.message : "راجع البيانات",
        variant: "destructive",
      });
    }
  };
  const toggle = async (row: Classification) => {
    await api(`/api/admin/classifications/${section}/${row.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    toast({
      title: row.isActive ? "تم تعطيل التصنيف" : "تم تفعيل التصنيف",
      variant: "success",
    });
    await resource.reload();
  };
  const remove = async (mode = "delete") => {
    if (!deleting && !blocked) return;
    const row = deleting || blocked!;
    try {
      await api(
        `/api/admin/classifications/${section}/${row.id}${mode === "deactivate" ? "?mode=deactivate" : ""}`,
        { method: "DELETE" },
      );
      toast({
        title: mode === "deactivate" ? "تم تعطيل التصنيف" : "تم حذف التصنيف",
        variant: "success",
      });
      setDeleting(null);
      setBlocked(null);
      await resource.reload();
    } catch (reason) {
      setDeleting(null);
      if (reason instanceof ApiError && reason.status === 409)
        setBlocked({
          ...row,
          relatedProducts:
            Number(reason.payload?.relatedProducts) || row.relatedProducts,
        });
      else
        toast({
          title: "تعذر حذف التصنيف",
          description:
            reason instanceof Error ? reason.message : "حاول مرة أخرى",
          variant: "destructive",
        });
    }
  };
  const reassign = async () => {
    if (!blocked || !targetId) return;
    try {
      await api(
        `/api/admin/classifications/${section}/${blocked.id}/reassign`,
        {
          method: "POST",
          body: JSON.stringify({ targetId: Number(targetId) }),
        },
      );
      toast({
        title: "تمت إعادة إسناد المنتجات وتعطيل التصنيف",
        variant: "success",
      });
      setBlocked(null);
      setTargetId("");
      await resource.reload();
    } catch (reason) {
      toast({
        title: "تعذر إعادة الإسناد",
        description: String(reason),
        variant: "destructive",
      });
    }
  };
  const rows = resource.data || [];
  return (
    <section className="space-y-6" dir="rtl">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">التصنيفات التعليمية</h1>
          <p className="text-muted-foreground">
            إدارة موحدة مع حماية المنتجات المرتبطة.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => open()}>
            <Plus className="ml-2 h-4 w-4" />
            إضافة
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {sections.map(([value, label]) => (
          <Button
            key={value}
            variant={section === value ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setSection(value);
              setEditing(null);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pr-9"
              placeholder="بحث بالاسم"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="inactive">غير نشط</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sort">ترتيب العرض</SelectItem>
              <SelectItem value="name">الاسم</SelectItem>
              <SelectItem value="updated">آخر تعديل</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <PageState
        loading={resource.loading}
        error={resource.error}
        empty={!rows.length}
      >
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم العربي</TableHead>
                  <TableHead>الاسم الإنجليزي</TableHead>
                  <TableHead>المنتجات المرتبطة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الترتيب</TableHead>
                  <TableHead>آخر تحديث</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-bold">{row.nameAr}</TableCell>
                    <TableCell dir="ltr" className="text-right">
                      {row.nameEn || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {row.relatedProducts || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.isActive ? "outline" : "secondary"}>
                        {row.isActive ? "نشط" : "متوقف"}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.sortOrder || 0}</TableCell>
                    <TableCell>{formatDate(row.updatedAt)}</TableCell>
                    <TableCell>
                      {canManage && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => open(row)}
                          >
                            تعديل
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void toggle(row)}
                          >
                            {row.isActive ? "تعطيل" : "تفعيل"}
                          </Button>
                          <Button
                            aria-label={`حذف ${row.nameAr}`}
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setDeleting(row)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </PageState>
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(value) => {
          if (!value) setEditing(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editing === "new" ? "إضافة تصنيف" : "تعديل التصنيف"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <FormLabelInput label="الاسم العربي">
              <Input
                value={form.nameAr}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    nameAr: event.target.value,
                  }))
                }
                required
              />
            </FormLabelInput>
            <FormLabelInput label="الاسم الإنجليزي">
              <Input
                dir="ltr"
                value={form.nameEn}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    nameEn: event.target.value,
                  }))
                }
              />
            </FormLabelInput>
            {(section === "grades" || section === "subcategories") && (
              <FormLabelInput
                label={
                  section === "grades" ? "المرحلة التابعة" : "التصنيف الرئيسي"
                }
              >
                <Select
                  value={form.parentId}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, parentId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر" />
                  </SelectTrigger>
                  <SelectContent>
                    {parents.data
                      ?.filter((row) => row.isActive)
                      .map((row) => (
                        <SelectItem key={row.id} value={String(row.id)}>
                          {row.nameAr}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </FormLabelInput>
            )}
            <FormLabelInput label="ترتيب العرض">
              <Input
                type="number"
                min="0"
                value={form.sortOrder}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sortOrder: Number(event.target.value),
                  }))
                }
              />
            </FormLabelInput>
            <label className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(value) =>
                  setForm((current) => ({ ...current, isActive: value }))
                }
              />
              نشط
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
              >
                إلغاء
              </Button>
              <Button type="submit">حفظ</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(value) => {
          if (!value) setDeleting(null);
        }}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف «{deleting?.nameAr}»</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم الحذف النهائي فقط إذا لم توجد منتجات مرتبطة. لن تُحذف أي
              منتجات.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>
              متابعة الحذف الآمن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={Boolean(blocked)}
        onOpenChange={(value) => {
          if (!value) setBlocked(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              التصنيف مستخدم بواسطة {blocked?.relatedProducts} منتج
            </DialogTitle>
            <DialogDescription>
              لا يمكن حذفه نهائيًا. يمكنك تعطيله أو نقل المنتجات إلى تصنيف بديل.
            </DialogDescription>
          </DialogHeader>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger>
              <SelectValue placeholder="اختر تصنيفًا بديلًا (اختياري)" />
            </SelectTrigger>
            <SelectContent>
              {rows
                .filter((row) => row.id !== blocked?.id && row.isActive)
                .map((row) => (
                  <SelectItem key={row.id} value={String(row.id)}>
                    {row.nameAr}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlocked(null)}>
              إلغاء
            </Button>
            <Button
              variant="secondary"
              onClick={() => void remove("deactivate")}
            >
              تعطيل فقط
            </Button>
            <Button disabled={!targetId} onClick={() => void reassign()}>
              إعادة الإسناد والتعطيل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
function FormLabelInput({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2">
      <Label className="block">{label}</Label>
      {children}
    </label>
  );
}
