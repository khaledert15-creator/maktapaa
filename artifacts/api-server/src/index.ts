import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { config } from "./lib/config";

const port = config.PORT;
pool.on("error", error => logger.error({ err: error }, "Unexpected PostgreSQL pool error"));

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Graceful shutdown started");
  const hardStop = setTimeout(() => { logger.fatal("Graceful shutdown timed out"); process.exit(1); }, 15_000).unref();
  server.close(async error => {
    if (error) logger.error({ err: error }, "HTTP server close failed");
    await pool.end().catch(poolError => logger.error({ err: poolError }, "Database pool close failed"));
    clearTimeout(hardStop);
    process.exit(error ? 1 : 0);
  });
  server.closeIdleConnections();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", error => { logger.error({ err: error }, "Unhandled promise rejection"); });
process.on("uncaughtException", error => { logger.fatal({ err: error }, "Uncaught exception"); void shutdown("uncaughtException"); });
