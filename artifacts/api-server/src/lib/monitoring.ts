import * as Sentry from "@sentry/node";
import { config } from "./config";

if (config.SENTRY_DSN) {
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    release: config.BUILD_VERSION,
    sendDefaultPii: false,
    tracesSampleRate: 0.05,
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!config.SENTRY_DSN) return;
  Sentry.withScope(scope => {
    if (context) scope.setContext("request", context);
    Sentry.captureException(error);
  });
}
