# Load test results

Local PostgreSQL-backed production build, 16 July 2026. The test mixed homepage, catalog, product details, cart preview, checkout shipping quote, order tracking, and authenticated admin order-list traffic. Each endpoint had a 0% HTTP error rate at every phase.

| Concurrent users | Total per-endpoint throughput | Typical p95 | Slowest endpoint | Slowest p95 | Pool peak / wait peak |
| --- | ---: | ---: | --- | ---: | ---: |
| 20 | ~170 req/s | 18–25 ms | Admin order list | 33.64 ms | 20 / 9 |
| 50 | ~180 req/s | 40–58 ms | Admin order list | 78.50 ms | 20 / 72 |
| 100 | ~172 req/s | 95–142 ms | Admin order list | 208.11 ms | 20 / 178 |

Cart preview stayed below 9 ms p95. Batching homepage enrichment, cart product loading, and order/customer aggregates raised measured per-endpoint throughput and reduced pool wait pressure. At 100 concurrent users the PostgreSQL pool still reached its configured limit, but requests remained successful and the slowest p95 remained below 210 ms. This is comfortably above the stated launch traffic, but the waiting-count trend should be monitored before adding API replicas or increasing sustained traffic. Increase `DB_POOL_MAX` only after checking PostgreSQL `max_connections`, memory, and real production query telemetry.

Reproduce with `pnpm run test:load`. Override `LOAD_TEST_BASE_URL`, `LOAD_TEST_DURATION_MS`, `LOAD_TEST_CONCURRENCY`, admin fixture credentials, and `LOAD_TEST_REPORT` as needed.
