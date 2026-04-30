# How to Run

## Prerequisites

- Node.js ≥ 20
- npm ≥ 10

---

## 1. Install dependencies

```bash
cd homework-1
npm install
```

---

## 2. Start the development server

```bash
npm run dev
```

This runs the API server (`tsx watch`) and the esbuild frontend bundler in watch mode concurrently.

Open **http://localhost:3000** for the docs/landing page.  
Open **http://localhost:3000/dashboard** for the operator dashboard.

---

## 3. Start with seed data

```bash
npm run seed
```

Loads 10 pre-built transactions across three accounts (`ACC-AAAAA`, `ACC-BBBBB`, `ACC-CCCCC`) so the dashboard is populated immediately.

---

## 4. Run the test suite

```bash
npm test
```

Runs all 145 unit + integration tests with coverage. Coverage thresholds are enforced:  
- ≥ 80% overall statements/branches/functions  
- Effective ≥ 85% on `src/services/` and `src/validators/`

---

## 5. Run end-to-end tests (Newman / Postman)

Start the server first (with seed data recommended):

```bash
npm run seed &
npm run test:e2e
```

Runs the 17-request Postman collection (`demo/postman-collection.json`) with 51 assertions against `http://localhost:3000`.

---

## 6. Regenerate OpenAPI spec

```bash
npm run openapi
```

Writes `docs/openapi.yaml` from the Zod schemas via `@asteasolutions/zod-to-openapi`.

---

## 7. Build for production

```bash
npm run build
```

Compiles TypeScript (`tsc`), bundles frontend JS (`esbuild`), and builds minified CSS (`tailwindcss`). Output: `dist/` (server), `public/css/tailwind.css`, `public/js/*.bundle.js`.

---

## 8. Run the production build

```bash
npm start
```

Requires `npm run build` first. Runs `node dist/index.js`.

---

## 9. Docker

```bash
docker build -t banking-api .
docker run -p 3000:3000 banking-api
```

Or with seed data:

```bash
docker run -e SEED=1 -p 3000:3000 banking-api
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP listen port |
| `NODE_ENV` | `development` | `production` disables pretty logs |
| `SEED` | `` | Set to `1` to load `demo/sample-data.json` on startup |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |
| `LOG_LEVEL` | `info` | Pino log level |

---

## Quick API smoke test

```bash
# Health check
curl http://localhost:3000/health

# Create a deposit
curl -s -X POST http://localhost:3000/api/transactions \
  -H 'Content-Type: application/json' \
  -d '{"fromAccount":"EXTERNAL","toAccount":"ACC-AAAAA","amount":500,"currency":"USD","type":"deposit"}' | jq .

# Check balance
curl http://localhost:3000/api/accounts/ACC-AAAAA/balance | jq .

# List transactions
curl http://localhost:3000/api/transactions | jq '.count'

# Export CSV
curl http://localhost:3000/api/transactions/export -o transactions.csv
```
