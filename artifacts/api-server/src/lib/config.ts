import { z } from "@workspace/api-zod";

const positiveInteger = (fallback: number) => z.coerce.number().int().positive().default(fallback);
const optionalUrl = z.string().url().optional().or(z.literal(""));

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: positiveInteger(5001),
  DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//, "DATABASE_URL must be a PostgreSQL URL"),
  SESSION_SECRET: z.string().min(16),
  CORS_ORIGIN: z.string().min(1),
  PUBLIC_SITE_URL: z.string().url(),
  API_URL: z.string().url(),
  COOKIE_DOMAIN: z.string().optional(),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  DB_POOL_MAX: positiveInteger(20),
  DB_IDLE_TIMEOUT_MS: positiveInteger(30_000),
  DB_CONNECTION_TIMEOUT_MS: positiveInteger(5_000),
  DB_STATEMENT_TIMEOUT_MS: positiveInteger(15_000),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  ALLOW_LOCAL_STORAGE_IN_PRODUCTION: z.enum(["true", "false"]).default("false"),
  STORAGE_LOCAL_DIR: z.string().optional(),
  S3_ENDPOINT: optionalUrl,
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: optionalUrl,
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("false"),
  EMAIL_PROVIDER: z.enum(["log", "resend", "disabled"]).default("log"),
  EMAIL_FROM: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SENTRY_DSN: optionalUrl,
  BUILD_VERSION: z.string().max(100).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  SLOW_REQUEST_MS: positiveInteger(1_000),
}).superRefine((value, context) => {
  const production = value.NODE_ENV === "production";
  if (production && value.SESSION_SECRET.length < 32) {
    context.addIssue({ code: "custom", path: ["SESSION_SECRET"], message: "must contain at least 32 characters in production" });
  }

  const origins = value.CORS_ORIGIN.split(",").map(origin => origin.trim()).filter(Boolean);
  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      if (production && (parsed.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(parsed.hostname) || parsed.hostname.endsWith(".replit.dev"))) {
        context.addIssue({ code: "custom", path: ["CORS_ORIGIN"], message: `production origin is not allowed: ${origin}` });
      }
    } catch {
      context.addIssue({ code: "custom", path: ["CORS_ORIGIN"], message: `invalid origin: ${origin}` });
    }
  }

  if (production && (!value.COOKIE_DOMAIN || !value.COOKIE_DOMAIN.includes("."))) {
    context.addIssue({ code: "custom", path: ["COOKIE_DOMAIN"], message: "is required in production" });
  }
  if (production && value.TRUST_PROXY < 1) {
    context.addIssue({ code: "custom", path: ["TRUST_PROXY"], message: "must be configured behind the production reverse proxy" });
  }
  if (production && value.STORAGE_PROVIDER === "local" && value.ALLOW_LOCAL_STORAGE_IN_PRODUCTION !== "true") {
    context.addIssue({ code: "custom", path: ["STORAGE_PROVIDER"], message: "local storage is disabled in production; configure S3/R2" });
  }
  if (value.STORAGE_PROVIDER === "s3") {
    for (const key of ["S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_PUBLIC_BASE_URL"] as const) {
      if (!value[key]) context.addIssue({ code: "custom", path: [key], message: "is required for S3/R2 storage" });
    }
  }
  if (production && value.EMAIL_PROVIDER !== "resend") {
    context.addIssue({ code: "custom", path: ["EMAIL_PROVIDER"], message: "a production email provider is required" });
  }
  if (value.EMAIL_PROVIDER === "resend") {
    if (!value.EMAIL_FROM) context.addIssue({ code: "custom", path: ["EMAIL_FROM"], message: "is required for Resend" });
    if (!value.RESEND_API_KEY) context.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "is required for Resend" });
  }
});

const localDefaults = {
  DATABASE_URL: "postgresql://postgres@127.0.0.1:55432/maktaba_dev",
  SESSION_SECRET: "maktaba-local-development-only",
  CORS_ORIGIN: "http://localhost:5173",
  PUBLIC_SITE_URL: "http://localhost:5173",
  API_URL: "http://localhost:5001",
};

const parsed = environmentSchema.safeParse({
  ...(process.env.NODE_ENV === "production" ? {} : localDefaults),
  ...process.env,
});

if (!parsed.success) {
  const details = parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid production environment: ${details}`);
}

export const config = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === "production",
  allowedOrigins: parsed.data.CORS_ORIGIN.split(",").map(origin => origin.trim()).filter(Boolean),
  allowLocalStorageInProduction: parsed.data.ALLOW_LOCAL_STORAGE_IN_PRODUCTION === "true",
  s3ForcePathStyle: parsed.data.S3_FORCE_PATH_STYLE === "true",
};

export type RuntimeConfig = typeof config;
