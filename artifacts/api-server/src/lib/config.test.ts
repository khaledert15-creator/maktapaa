import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../../..");
const evaluate = "await import('./artifacts/api-server/src/lib/config.ts')";

function validate(overrides: Record<string, string>) {
  return spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", evaluate], {
    cwd: root,
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", NODE_ENV: "production", ...overrides },
  });
}

test("production environment validation rejects unsafe defaults and accepts complete secure configuration", () => {
  const missing = validate({ DATABASE_URL: "postgresql://postgres@db/maktaba" });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /Invalid production environment/);

  const unsafe = validate({
    DATABASE_URL: "postgresql://postgres@db/maktaba", SESSION_SECRET: "x".repeat(40), CORS_ORIGIN: "http://localhost:5173",
    PUBLIC_SITE_URL: "https://maktabaa.com", API_URL: "https://maktabaa.com/api", COOKIE_DOMAIN: ".maktabaa.com", TRUST_PROXY: "1",
  });
  assert.notEqual(unsafe.status, 0);
  assert.match(unsafe.stderr, /production origin is not allowed|local storage is disabled/);

  const valid = validate({
    DATABASE_URL: "postgresql://postgres@db/maktaba", SESSION_SECRET: "x".repeat(40), CORS_ORIGIN: "https://maktabaa.com,https://www.maktabaa.com",
    PUBLIC_SITE_URL: "https://maktabaa.com", API_URL: "https://maktabaa.com/api", COOKIE_DOMAIN: ".maktabaa.com", TRUST_PROXY: "1",
    STORAGE_PROVIDER: "s3", S3_ENDPOINT: "https://example.r2.cloudflarestorage.com", S3_REGION: "auto", S3_BUCKET: "bucket", S3_ACCESS_KEY_ID: "key", S3_SECRET_ACCESS_KEY: "secret", S3_PUBLIC_BASE_URL: "https://cdn.maktabaa.com",
    EMAIL_PROVIDER: "resend", EMAIL_FROM: "no-reply@maktabaa.com", RESEND_API_KEY: "secret",
  });
  assert.equal(valid.status, 0, valid.stderr);
});
