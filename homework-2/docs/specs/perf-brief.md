# Performance Brief — Customer Support API

Brief for Phase 9 (autocannon benchmarks).

---

## Objective

Measure throughput and latency of the three most performance-sensitive endpoints under realistic concurrent load. Capture raw JSON results, then extract a summary table for `TESTING_GUIDE.md`.

---

## Benchmark scripts

```bash
npm run perf:list      # GET /api/tickets   — c=20, d=30s
npm run perf:create    # POST /api/tickets  — c=20, d=30s
npm run perf:classify  # POST /:id/auto-classify — c=10, d=10s
npm run perf:bench     # all three sequentially
```

Raw outputs written to `docs/perf-results/<endpoint>-<timestamp>.json`.

---

## Setup before benchmarking

1. Server running locally: `npm run dev` (port 3000)
2. DB seeded with ≥ 50 tickets: `npm run db:seed`
3. `$ID` set to an existing ticket UUID for the classify benchmark:
   ```bash
   export ID=$(curl -s http://localhost:3000/api/tickets | jq -r '.data[0].id')
   ```
4. No other load on the machine during the run

---

## Test conditions

| Benchmark | Method | URL | Connections | Duration | Notes |
|---|---|---|---|---|---|
| List tickets | GET | `/api/tickets?limit=50` | 20 | 30s | Tests read throughput + Neon latency |
| Create ticket | POST | `/api/tickets` | 20 | 30s | Tests write throughput + optimistic lock |
| Auto-classify | POST | `/api/tickets/$ID/auto-classify` | 10 | 10s | Tests transaction throughput; `If-Match` required |

---

## Minimum acceptable targets (local dev, no Neon cold start)

| Endpoint | Target RPS | Target p99 latency |
|---|---|---|
| GET /tickets | ≥ 50 req/s | ≤ 800ms |
| POST /tickets | ≥ 20 req/s | ≤ 1200ms |
| POST /auto-classify | ≥ 10 req/s | ≤ 1500ms |

These are conservative targets for a single-node Neon connection over the internet. Production with connection pooling and closer region will be faster.

---

## Concurrency correctness tests (Vitest Layer 4a)

Run as part of `npm test`. These are correctness tests, not benchmarks.

| Test | What it verifies |
|---|---|
| 20 concurrent PUTs, same ticket, same `If-Match` | Exactly 1 wins (200), 19 get 412; version = 2 |
| 20 concurrent POSTs, different customer_id | All 20 return 201; no contention |
| PUT + auto-classify race on same ticket | Only one wins; other gets 412 |

File: `tests/integration/concurrency.test.ts`

---

## Output format

Each `docs/perf-results/<name>-<ts>.json` has the raw autocannon JSON:
```json
{
  "url": "http://localhost:3000/api/tickets",
  "connections": 20,
  "duration": 30,
  "requests": { "total": 1523, "average": 50.77, "mean": 50.77 },
  "latency": { "average": 391, "mean": 391, "stddev": 120, "max": 1893, "p50": 340, "p75": 420, "p99": 801 },
  "throughput": { "total": 2104329, "average": 70144 }
}
```

Summary table for `TESTING_GUIDE.md`:
```markdown
| Endpoint          | RPS  | p50  | p99   | Connections |
|---|---|---|---|---|
| GET /tickets      | 50.8 | 340ms | 801ms | 20 |
| POST /tickets     | 21.3 | 490ms | 1120ms | 20 |
| POST /auto-classify | 11.2 | 650ms | 1380ms | 10 |
```

---

## Measurement environment

Record in `TESTING_GUIDE.md` alongside results:
- OS + CPU model
- Node.js version
- Neon region (check console: Settings → Compute endpoint)
- Network: local wifi / ethernet / VPN

This ensures results are reproducible and comparable across re-runs.
