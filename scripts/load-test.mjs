import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const baseUrl = (process.env.LOAD_TEST_BASE_URL || "http://127.0.0.1:5001").replace(/\/$/, "");
const durationMs = Number(process.env.LOAD_TEST_DURATION_MS || 5000);
const concurrencies = (process.env.LOAD_TEST_CONCURRENCY || "20,50,100").split(",").map(Number);

async function json(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const data = await response.json().catch(() => null);
  return { response, data };
}

const [{ data: catalog }, { data: governorates }] = await Promise.all([json("/api/products?limit=1"), json("/api/governorates")]);
const product = catalog?.items?.[0];
const governorate = governorates?.[0];
if (!product || !governorate) throw new Error("Seeded product and governorate data are required for load testing");

const login = await json("/api/auth/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: process.env.LOAD_TEST_ADMIN_EMAIL || "admin@maktaba.com", password: process.env.LOAD_TEST_ADMIN_PASSWORD || "Admin@2025" }) });
const adminCookie = login.response.headers.get("set-cookie")?.split(";")[0] || "";
const orderList = adminCookie ? await json("/api/admin/orders?limit=1", { headers: { cookie: adminCookie } }) : { data: null };
const trackedOrder = orderList.data?.items?.[0];

const scenarios = [
  { name: "homepage", run: () => fetch(`${baseUrl}/api/content/homepage`) },
  { name: "catalog", run: () => fetch(`${baseUrl}/api/products?limit=24&sortBy=newest`) },
  { name: "product_detail", run: () => fetch(`${baseUrl}/api/products/${encodeURIComponent(product.slug)}`) },
  { name: "cart_preview", run: () => fetch(`${baseUrl}/api/cart`) },
  { name: "checkout_quote", run: () => fetch(`${baseUrl}/api/shipping/quote`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ governorateId: governorate.id, items: [{ productId: product.id, quantity: 1 }] }) }) },
  ...(trackedOrder ? [{ name: "order_tracking", run: () => fetch(`${baseUrl}/api/orders/track?orderNumber=${encodeURIComponent(trackedOrder.orderNumber)}&mobile=${encodeURIComponent(trackedOrder.mobile)}`) }] : []),
  ...(adminCookie ? [{ name: "admin_order_list", run: () => fetch(`${baseUrl}/api/admin/orders?limit=20`, { headers: { cookie: adminCookie } }) }] : []),
];

async function runPhase(concurrency) {
  const results = new Map(scenarios.map(scenario => [scenario.name, { durations: [], requests: 0, errors: 0 }]));
  const deadline = performance.now() + durationMs;
  const poolSamples = [];
  let sampling = Boolean(adminCookie);
  const sampler = (async () => {
    while (sampling) {
      const sample = (await json("/api/admin/diagnostics/pool", { headers: { cookie: adminCookie } })).data;
      if (sample && typeof sample.total === "number") poolSamples.push(sample);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  })();
  let sequence = 0;
  async function worker() {
    while (performance.now() < deadline) {
      const scenario = scenarios[sequence++ % scenarios.length];
      const metric = results.get(scenario.name);
      const started = performance.now();
      try {
        const response = await scenario.run();
        metric.requests += 1;
        if (!response.ok) metric.errors += 1;
      } catch { metric.requests += 1; metric.errors += 1; }
      metric.durations.push(performance.now() - started);
    }
  }
  const phaseStarted = performance.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  sampling = false;
  await sampler;
  const elapsedSeconds = (performance.now() - phaseStarted) / 1000;
  const pool = poolSamples.length ? {
    maxTotal: Math.max(...poolSamples.map(sample => sample.total)),
    minIdle: Math.min(...poolSamples.map(sample => sample.idle)),
    maxWaiting: Math.max(...poolSamples.map(sample => sample.waiting)),
    samples: poolSamples.length,
  } : null;
  return {
    concurrency,
    durationSeconds: Number(elapsedSeconds.toFixed(2)),
    databasePool: pool,
    endpoints: [...results].map(([name, metric]) => {
      const sorted = metric.durations.sort((a, b) => a - b);
      const total = sorted.reduce((sum, value) => sum + value, 0);
      return { name, requests: metric.requests, requestsPerSecond: Number((metric.requests / elapsedSeconds).toFixed(2)), averageMs: Number((total / Math.max(1, sorted.length)).toFixed(2)), p95Ms: Number((sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] || 0).toFixed(2)), errorRate: Number((metric.errors / Math.max(1, metric.requests) * 100).toFixed(2)) };
    }).sort((a, b) => b.p95Ms - a.p95Ms),
  };
}

const phases = [];
for (const concurrency of concurrencies) phases.push(await runPhase(concurrency));
const report = { generatedAt: new Date().toISOString(), baseUrl, durationMs, productId: product.id, phases };
await writeFile(process.env.LOAD_TEST_REPORT || "load-test-report.json", JSON.stringify(report, null, 2));
for (const phase of phases) {
  process.stdout.write(`\nConcurrency ${phase.concurrency} (${phase.durationSeconds}s), pool=${JSON.stringify(phase.databasePool)}\n`);
  console.table(phase.endpoints);
}
