import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import router from "./routes";
import seoRouter from "./routes/seo";
import { logger } from "./lib/logger";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./lib/config";
import { captureException } from "./lib/monitoring";

const app: Express = express();
const isProduction = config.isProduction;
app.disable("x-powered-by");
if (config.TRUST_PROXY > 0) app.set("trust proxy", config.TRUST_PROXY);

const PgSession = ConnectPgSimple(session);

app.use(
  pinoHttp({
    logger,
    genReqId(req, res) {
      const incoming = req.headers["x-request-id"];
      const id = typeof incoming === "string" && /^[a-zA-Z0-9._-]{1,100}$/.test(incoming) ? incoming : randomUUID();
      res.setHeader("X-Request-ID", id);
      return id;
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use((req, res, next) => {
  const startedAt = performance.now();
  res.once("finish", () => {
    const responseTime = performance.now() - startedAt;
    if (responseTime >= config.SLOW_REQUEST_MS) logger.warn({ requestId: req.id, method: req.method, path: req.path, statusCode: res.statusCode, responseTime: Math.round(responseTime) }, "Slow request");
  });
  next();
});

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("X-Frame-Options", "DENY");
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' https://*.sentry.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  }
  next();
});

const allowedOrigins = config.allowedOrigins;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const developmentOrigin = !isProduction && (() => {
        try {
          const url = new URL(origin);
          return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname.endsWith(".replit.dev");
        } catch { return false; }
      })();
      if (allowedOrigins.includes(origin) || developmentOrigin) {
        return callback(null, true);
      }
      callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
if (!isProduction || config.allowLocalStorageInProduction) app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads"), { maxAge: "7d", immutable: true }));

app.use(
  session({
    store: new PgSession({
      conString: config.DATABASE_URL,
      createTableIfMissing: false,
      tableName: "user_sessions",
    }),
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: "lax",
      domain: config.COOKIE_DOMAIN || undefined,
    },
    name: "maktaba.sid",
  }),
);

app.use("/api", router);
app.use(seoRouter);

app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  const corsDenied = error.message === "Origin is not allowed by CORS";
  const status = "status" in error && typeof error.status === "number" ? error.status : corsDenied ? 403 : 500;
  const context = { err: error, requestId: req.id, method: req.method, path: req.path, statusCode: status };
  if (status >= 500) {
    logger.error(context, "Unhandled request error");
    captureException(error, { requestId: req.id, method: req.method, path: req.path });
  } else {
    logger.warn(context, corsDenied ? "CORS request rejected" : "Request rejected");
  }
  if (res.headersSent) return;
  res.status(status).json({ error: corsDenied ? "Origin is not allowed" : status === 413 ? "حجم الطلب أكبر من الحد المسموح" : "حدث خطأ داخلي. حاول مرة أخرى لاحقًا.", requestId: req.id });
});

export default app;
