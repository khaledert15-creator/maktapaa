import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "@workspace/api-zod";
import { requireAdminAuth, requireAdminPermission } from "../../lib/auth";
import { parseBody } from "../../lib/validation";
import { writeAuditLog } from "../../services/audit";

const router: IRouter = Router();
router.use(requireAdminAuth);

const kindSchema = z.enum(["stages", "grades", "subjects", "publishers", "categories", "subcategories", "teachers", "school-years", "education-types"]);
const querySchema = z.object({ q: z.string().trim().max(200).optional(), status: z.enum(["all", "active", "inactive"]).default("all"), sort: z.enum(["sort", "name", "updated"]).default("sort") });
const classificationSchema = z.object({
  nameAr: z.string().trim().min(2).max(200),
  nameEn: z.string().trim().max(200).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(100_000).default(0),
  isActive: z.boolean().default(true),
  stageId: z.coerce.number().int().positive().nullable().optional(),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  logo: z.string().trim().max(2_000).nullable().optional(),
  slug: z.string().trim().max(250).nullable().optional(),
});
const updateSchema = classificationSchema.partial().refine(value => Object.keys(value).length > 0, "لا توجد تغييرات للحفظ");
const reassignSchema = z.object({ targetId: z.coerce.number().int().positive() });

type Definition = { table: string; productField: string; optionKind?: "teacher" | "school_year" | "education_type"; parent?: "stage_id" | "category_id"; hasLogo?: boolean; hasSlug?: boolean };
const definitions: Record<z.infer<typeof kindSchema>, Definition> = {
  stages: { table: "stages", productField: "stage_id" },
  grades: { table: "grades", productField: "grade_id", parent: "stage_id" },
  subjects: { table: "subjects", productField: "subject_id" },
  publishers: { table: "publishers", productField: "publisher_id", hasLogo: true },
  categories: { table: "categories", productField: "category_id", hasSlug: true },
  subcategories: { table: "subcategories", productField: "subcategory_id", parent: "category_id" },
  teachers: { table: "classification_options", productField: "author", optionKind: "teacher" },
  "school-years": { table: "classification_options", productField: "school_year", optionKind: "school_year" },
  "education-types": { table: "classification_options", productField: "education_type", optionKind: "education_type" },
};

function params(req: Parameters<typeof kindSchema.safeParse>[0]) {
  const parsed = kindSchema.safeParse(req);
  return parsed.success ? parsed.data : null;
}

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/\s+/g, "-").replace(/[^\w\u0600-\u06ff-]/g, "").replace(/-+/g, "-");
  return `${slug || "category"}-${Date.now()}`;
}

function rowQuery(definition: Definition, q = "", status = "all", sort = "sort") {
  const optionFilter = definition.optionKind ? sql`and c.kind = ${definition.optionKind}` : sql``;
  const activeFilter = status === "active" ? sql`and c.is_active = true` : status === "inactive" ? sql`and c.is_active = false` : sql``;
  const searchFilter = q ? sql`and (c.name_ar ilike ${`%${q}%`} or coalesce(c.name_en, '') ilike ${`%${q}%`})` : sql``;
  const join = definition.optionKind
    ? sql`left join products p on p.${sql.raw(definition.productField)} = c.name_ar and p.deleted_at is null`
    : sql`left join products p on p.${sql.raw(definition.productField)} = c.id and p.deleted_at is null`;
  const order = sort === "name" ? sql`c.name_ar asc` : sort === "updated" ? sql`c.updated_at desc` : sql`c.sort_order asc, c.name_ar asc`;
  return sql`
    select c.*, count(p.id)::int as related_products
    from ${sql.raw(definition.table)} c ${join}
    where true ${optionFilter} ${activeFilter} ${searchFilter}
    group by c.id order by ${order}
  `;
}

router.get("/admin/classifications/:kind", requireAdminPermission("classifications.view"), async (req, res): Promise<void> => {
  const kind = params(req.params.kind); if (!kind) { res.status(404).json({ error: "نوع التصنيف غير موجود" }); return; }
  const query = parseBody(querySchema, req.query, res); if (!query) return;
  const result = await db.execute<Record<string, unknown>>(rowQuery(definitions[kind], query.q, query.status, query.sort));
  res.json(result.rows.map(row => ({
    id: row.id, nameAr: row.name_ar, nameEn: row.name_en, sortOrder: row.sort_order,
    isActive: row.is_active, relatedProducts: row.related_products, updatedAt: row.updated_at,
    stageId: row.stage_id, categoryId: row.category_id, logo: row.logo, slug: row.slug,
  })));
});

router.post("/admin/classifications/:kind", requireAdminPermission("classifications.manage"), async (req, res): Promise<void> => {
  const kind = params(req.params.kind); if (!kind) { res.status(404).json({ error: "نوع التصنيف غير موجود" }); return; }
  const input = parseBody(classificationSchema, req.body, res); if (!input) return;
  const definition = definitions[kind];
  if (definition.parent === "stage_id" && !input.stageId) { res.status(400).json({ error: "اختر المرحلة التابعة" }); return; }
  if (definition.parent === "category_id" && !input.categoryId) { res.status(400).json({ error: "اختر التصنيف الرئيسي" }); return; }
  const result = await db.execute<Record<string, unknown>>(sql`
    insert into ${sql.raw(definition.table)}
      (name_ar, name_en, sort_order, is_active, updated_at
      ${definition.optionKind ? sql`, kind` : sql``}
      ${definition.parent ? sql`, ${sql.raw(definition.parent)}` : sql``}
      ${definition.hasLogo ? sql`, logo` : sql``}
      ${definition.hasSlug ? sql`, slug` : sql``})
    values (${input.nameAr}, ${input.nameEn ?? null}, ${input.sortOrder}, ${input.isActive}, now()
      ${definition.optionKind ? sql`, ${definition.optionKind}` : sql``}
      ${definition.parent === "stage_id" ? sql`, ${input.stageId}` : definition.parent === "category_id" ? sql`, ${input.categoryId}` : sql``}
      ${definition.hasLogo ? sql`, ${input.logo ?? null}` : sql``}
      ${definition.hasSlug ? sql`, ${input.slug || slugify(input.nameAr)}` : sql``}) returning *
  `);
  const row = result.rows[0];
  await writeAuditLog(req, { action: "classification.create", entityType: kind, entityId: String(row.id), description: `إضافة التصنيف ${input.nameAr}`, afterData: row });
  res.status(201).json(row);
});

router.patch("/admin/classifications/:kind/:id", requireAdminPermission("classifications.manage"), async (req, res): Promise<void> => {
  const kind = params(req.params.kind); if (!kind) { res.status(404).json({ error: "نوع التصنيف غير موجود" }); return; }
  const id = Number(req.params.id); if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "معرف غير صحيح" }); return; }
  const input = parseBody(updateSchema, req.body, res); if (!input) return;
  const definition = definitions[kind];
  const optionFilter = definition.optionKind ? sql`and kind = ${definition.optionKind}` : sql``;
  const outcome = await db.transaction(async tx => {
    const beforeResult = await tx.execute<Record<string, unknown>>(sql`select * from ${sql.raw(definition.table)} where id = ${id} ${optionFilter} for update`);
    const before = beforeResult.rows[0]; if (!before) return null;
    const sets = [sql`updated_at = now()`];
    if (input.nameAr !== undefined) sets.push(sql`name_ar = ${input.nameAr}`);
    if (input.nameEn !== undefined) sets.push(sql`name_en = ${input.nameEn}`);
    if (input.sortOrder !== undefined) sets.push(sql`sort_order = ${input.sortOrder}`);
    if (input.isActive !== undefined) sets.push(sql`is_active = ${input.isActive}`);
    if (definition.parent === "stage_id" && input.stageId !== undefined) sets.push(sql`stage_id = ${input.stageId}`);
    if (definition.parent === "category_id" && input.categoryId !== undefined) sets.push(sql`category_id = ${input.categoryId}`);
    if (definition.hasLogo && input.logo !== undefined) sets.push(sql`logo = ${input.logo}`);
    if (definition.hasSlug && input.slug !== undefined) sets.push(sql`slug = ${input.slug || slugify(input.nameAr || String(before.name_ar))}`);
    const result = await tx.execute<Record<string, unknown>>(sql`update ${sql.raw(definition.table)} set ${sql.join(sets, sql`, `)} where id = ${id} ${optionFilter} returning *`);
    if (definition.optionKind && input.nameAr !== undefined && input.nameAr !== before.name_ar) {
      await tx.execute(sql`update products set ${sql.raw(definition.productField)} = ${input.nameAr} where ${sql.raw(definition.productField)} = ${String(before.name_ar)} and deleted_at is null`);
    }
    return { before, row: result.rows[0] };
  });
  if (!outcome) { res.status(404).json({ error: "التصنيف غير موجود" }); return; }
  await writeAuditLog(req, { action: input.isActive !== undefined ? "classification.status" : "classification.update", entityType: kind, entityId: id, description: `تعديل التصنيف ${String(outcome.row.name_ar)}`, beforeData: outcome.before, afterData: outcome.row });
  res.json(outcome.row);
});

router.delete("/admin/classifications/:kind/:id", requireAdminPermission("classifications.manage"), async (req, res): Promise<void> => {
  const kind = params(req.params.kind); if (!kind) { res.status(404).json({ error: "نوع التصنيف غير موجود" }); return; }
  const id = Number(req.params.id); if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "معرف غير صحيح" }); return; } const definition = definitions[kind];
  const mode = req.query.mode === "deactivate" ? "deactivate" : "delete";
  const outcome = await db.transaction(async tx => {
    const optionFilter = definition.optionKind ? sql`and kind = ${definition.optionKind}` : sql``;
    const selected = await tx.execute<Record<string, unknown>>(sql`select * from ${sql.raw(definition.table)} where id = ${id} ${optionFilter} for update`);
    const row = selected.rows[0]; if (!row) return { missing: true as const };
    const dependency = definition.optionKind
      ? await tx.execute<{ count: number }>(sql`select count(*)::int count from products where ${sql.raw(definition.productField)} = ${String(row.name_ar)} and deleted_at is null`)
      : await tx.execute<{ count: number }>(sql`select count(*)::int count from products where ${sql.raw(definition.productField)} = ${id} and deleted_at is null`);
    const relatedProducts = dependency.rows[0]?.count ?? 0;
    if (relatedProducts > 0 && mode === "delete") return { blocked: true as const, relatedProducts, row };
    if (relatedProducts > 0 || mode === "deactivate") {
      await tx.execute(sql`update ${sql.raw(definition.table)} set is_active = false, updated_at = now() where id = ${id}`);
      return { mode: "deactivated" as const, relatedProducts, row };
    }
    await tx.execute(sql`delete from ${sql.raw(definition.table)} where id = ${id}`);
    return { mode: "deleted" as const, relatedProducts, row };
  });
  if ("missing" in outcome) { res.status(404).json({ error: "التصنيف غير موجود" }); return; }
  if ("blocked" in outcome) { res.status(409).json({ error: `لا يمكن حذف التصنيف لأنه مرتبط بـ ${outcome.relatedProducts} منتج`, code: "CLASSIFICATION_IN_USE", relatedProducts: outcome.relatedProducts }); return; }
  await writeAuditLog(req, { action: `classification.${outcome.mode}`, entityType: kind, entityId: id, description: `${outcome.mode === "deleted" ? "حذف" : "تعطيل"} التصنيف ${String(outcome.row.name_ar)}`, beforeData: outcome.row });
  res.json({ mode: outcome.mode, relatedProducts: outcome.relatedProducts });
});

router.post("/admin/classifications/:kind/:id/reassign", requireAdminPermission("classifications.manage"), async (req, res): Promise<void> => {
  const kind = params(req.params.kind); if (!kind) { res.status(404).json({ error: "نوع التصنيف غير موجود" }); return; }
  const id = Number(req.params.id); if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "معرف غير صحيح" }); return; } const input = parseBody(reassignSchema, req.body, res); if (!input) return;
  if (id === input.targetId) { res.status(400).json({ error: "اختر تصنيفًا بديلًا مختلفًا" }); return; }
  const definition = definitions[kind];
  const moved = await db.transaction(async tx => {
    const target = await tx.execute<Record<string, unknown>>(sql`select * from ${sql.raw(definition.table)} where id = ${input.targetId} ${definition.optionKind ? sql`and kind = ${definition.optionKind}` : sql``} for update`);
    const source = await tx.execute<Record<string, unknown>>(sql`select * from ${sql.raw(definition.table)} where id = ${id} ${definition.optionKind ? sql`and kind = ${definition.optionKind}` : sql``} for update`);
    if (!source.rows[0] || !target.rows[0]) return null;
    const update = definition.optionKind
      ? await tx.execute<{ id: number }>(sql`update products set ${sql.raw(definition.productField)} = ${String(target.rows[0].name_ar)} where ${sql.raw(definition.productField)} = ${String(source.rows[0].name_ar)} and deleted_at is null returning id`)
      : await tx.execute<{ id: number }>(sql`update products set ${sql.raw(definition.productField)} = ${input.targetId} where ${sql.raw(definition.productField)} = ${id} and deleted_at is null returning id`);
    await tx.execute(sql`update ${sql.raw(definition.table)} set is_active = false, updated_at = now() where id = ${id}`);
    return { count: update.rows.length, source: source.rows[0], target: target.rows[0] };
  });
  if (!moved) { res.status(404).json({ error: "التصنيف المصدر أو البديل غير موجود" }); return; }
  await writeAuditLog(req, { action: "classification.reassign", entityType: kind, entityId: id, description: `إعادة إسناد ${moved.count} منتج وتعطيل التصنيف`, beforeData: moved.source, afterData: moved.target });
  res.json({ reassignedProducts: moved.count });
});

export default router;
