import type { Request, Response, NextFunction } from "express";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(options: { windowMs: number; max: number; namespace: string }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    if (buckets.size > 10_000) for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
    const key = `${options.namespace}:${req.ip}`;
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + options.windowMs } : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    res.setHeader("RateLimit-Limit", String(options.max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, options.max - bucket.count)));
    if (bucket.count > options.max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ error: "محاولات كثيرة، حاول مرة أخرى لاحقًا" });
      return;
    }
    next();
  };
}
