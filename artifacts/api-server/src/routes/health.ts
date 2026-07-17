import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { config } from "../lib/config";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/readyz", async (_req, res): Promise<void> => {
  try {
    await pool.query("select 1 as ready");
    res.json({ status: "ready", database: "connected" });
  } catch {
    res.status(503).json({ status: "not_ready", database: "unavailable" });
  }
});

router.get("/version", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ version: config.BUILD_VERSION, environment: config.NODE_ENV });
});

export default router;
