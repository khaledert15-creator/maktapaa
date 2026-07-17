import type { Response } from "express";
import type { z } from "@workspace/api-zod";

export function parseBody<T extends z.ZodType>(schema: T, body: unknown, res: Response): z.infer<T> | null {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  res.status(400).json({
    error: "بيانات الطلب غير صحيحة",
    details: result.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })),
  });
  return null;
}
