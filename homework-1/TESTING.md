# Testing Guide

## Overview

The project has three test layers, each catching a different class of bug:

| Layer | Tool | Files | Tests | What it catches |
|---|---|---|---|---|
| Unit | Vitest | 7 | 104 | Business logic, validation rules, CSV serialisation |
| Integration | Vitest + Supertest | 4 | 41 | HTTP contract, routing, error shapes, status codes |
| E2E | Newman / Postman | 1 collection | 51 assertions | Full request lifecycle against a running server |

---

## 1. Unit + Integration tests

```bash
npm test
```

Runs all 145 tests with v8 coverage. Output includes a per-file coverage table and enforces the thresholds below.

### Watch mode (during development)

```bash
npm run test:watch
```

Re-runs affected tests on every file save. No coverage collected — faster feedback loop.

### Coverage thresholds

Configured in `vitest.config.ts`. The run fails if any threshold is not met:

| Metric | Threshold |
|---|---|
| Statements | ≥ 80% |
| Branches | ≥ 80% |
| Functions | ≥ 80% |
| Lines | ≥ 80% |

Current numbers comfortably exceed these:

| Metric | Actual |
|---|---|
| Statements | 95.96% |
| Branches | 92.68% |
| Functions | 97.77% |
| Lines | 95.96% |

### HTML coverage report

After `npm test`, open the interactive report:

```bash
open coverage/index.html
```

Click any file to see line-by-line coverage highlighting (green = covered, red = uncovered, yellow = partial branch).

---

## 2. Test file map

```
src/validators/
  common.schemas.test.ts      — accountId, currency, date, pagination schemas (25 tests)
  transaction.schemas.test.ts — CreateTransactionSchema, type/amount/currency combos (22 tests)

src/repository/
  transaction.repository.test.ts — create, list filters, byAccount index, bulkLoad (16 tests)

src/services/
  transactions.service.test.ts  — deposit/withdrawal/transfer settlement, INSUFFICIENT_FUNDS (13 tests)
  accounts.service.test.ts      — balance aggregation, summary per-currency, lastAt (11 tests)
  export.service.test.ts        — CSV header, quoting, RFC 4180 escaping, filter pass-through (9 tests)

src/utils/
  money.test.ts                 — add/subtract/compare, rounding, negative guard (14 tests)

tests/integration/
  transactions.test.ts  — POST /api/transactions, GET list + filters, GET by ID (16 tests)
  accounts.test.ts      — GET balance, GET summary, invalid accountId → 400 (8 tests)
  export.test.ts        — GET /export CSV shape, Content-Disposition, filtered export (6 tests)
  error-handling.test.ts — 404 on unknown route, malformed JSON → 400, x-request-id header (5 tests)
```

---

## 3. E2E tests (Newman)

The E2E suite runs 17 real HTTP requests against a live server and asserts 51 conditions.

### Start the server first

```bash
# With seed data (recommended — some assertions check exact account balances)
npm run seed &

# Verify the server is up
curl http://localhost:3000/health
```

### Run the suite

```bash
npm run test:e2e
```

### What is tested

| Group | Requests | Key assertions |
|---|---|---|
| System | 1 | `GET /health` → 200, `status: ok`, uptime present |
| Transactions | 10 | deposit 201 + completed status; failed withdrawal returns 201 with `failureReason: INSUFFICIENT_FUNDS`; three validation 400s; list + filter; get by ID; get 404; export CSV |
| Accounts | 6 | balance empty account; balance funded (USD=1000); invalid accountId → 400; summary structure |

### Postman collection

The collection is at `demo/postman-collection.json`. It can be imported into the Postman desktop app for manual exploration. The Postman workspace is also published — see `docs/AI-USAGE.md` Phase 3.

### Important: test isolation

The balance assertions (`USD balance is 1000`) assume a **fresh server** with only the seed data loaded. If the server has accumulated extra transactions from a prior run, restart it before running e2e:

```bash
# Kill any running server on port 3000, then restart with seed
kill $(lsof -ti :3000) 2>/dev/null; npm run seed &
sleep 2 && npm run test:e2e
```

---

## 4. Type-checking (not tests, but catches another class of bug)

```bash
npm run typecheck
```

Runs `tsc --noEmit` on both the server and frontend TypeScript configs. Catches type errors that tests don't exercise.

---

## 5. Running everything

To run the full validation pipeline in order:

```bash
# 1. Type-check
npm run typecheck

# 2. Unit + integration tests + coverage
npm test

# 3. E2E (requires a fresh server)
npm run seed &
sleep 2
npm run test:e2e
kill $(lsof -ti :3000)
```

---

## 6. Screenshots

Test result screenshots are in [`docs/screenshots/`](docs/screenshots/):

| File | Contents |
|---|---|
| `unit_test_result.png` | Vitest terminal output (145/145, per-file coverage table) |
| `e2e_tests_result.png` | Newman summary table (17 requests, 51 assertions, 0 failed) |
| `coverage-report.png` | Istanbul HTML report — all layers |
| `test-results.png` | Combined dashboard (unit + e2e side by side) |
| `newman-results.png` | Full Newman run with per-request assertion list |
