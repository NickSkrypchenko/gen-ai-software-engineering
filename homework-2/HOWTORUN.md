# How to Run

This is the cold-start runbook for the Customer Support API. Follow these steps to get the project running locally from a fresh clone.

## Prerequisites

- Node.js ≥20
- npm ≥10
- A Neon account (free tier works) for serverless Postgres
- Vercel CLI (optional, only required for deployment)

## Clone & Install

Clone the repository and install dependencies:

```bash
git clone https://github.com/NickSkrypchenko/gen-ai-software-engineering.git
cd gen-ai-software-engineering/homework-2
npm install
```

## Environment Setup

The project requires two separate databases: one for development and one for integration tests.

1. Create a new project in your Neon dashboard.
2. Create two branches in Neon: `main` (for development) and `test` (for testing).
3. Copy the environment templates:

```bash
cp .env.example .env
cp .env.test.example .env.test
```

4. Get your connection strings from the Neon dashboard (Settings → Connection string) for each branch. They will look like this:
   `postgresql://user:pass@host/db?sslmode=require`

5. Update `.env` with your `main` branch connection string:
   `DATABASE_URL=postgresql://...`
   (Leave PORT=3000, NODE_ENV=development, and CORS_ORIGIN=* as default)

6. Update `.env.test` with your `test` branch connection string.

## Database Setup

Apply the Drizzle migrations to your development database:

```bash
npm run db:migrate
```

Seed the development database with 50 sample tickets:

```bash
npm run db:seed
```

To prepare the test database, temporarily swap the `DATABASE_URL` in your terminal to point to the test branch, or run migrations directly against it:

```bash
DATABASE_URL=$(grep DATABASE_URL .env.test | cut -d '=' -f2) npm run db:migrate
```

## Running in Development

Start the development server (auto-restarts on file changes):

```bash
npm run dev
```

- API smoke test: Open `http://localhost:3000/health`
- Frontend dashboard: Open `http://localhost:3000/dashboard.html`

## Running Tests

Run unit tests first (these do not require a database connection):

```bash
npm run test:unit
```

Run the full test suite (requires the `.env.test` database to be migrated):

```bash
npm test
```

To generate a V8 coverage report:

```bash
npm run test:coverage
```

Expected output for the full suite is ~212 passing tests and ~96% coverage.

## Production Build

To run the application as it would execute in production, build the server, frontend, and CSS assets:

```bash
npm run build
npm run build:web
npm run build:css
npm start
```

The server will start on port 3000 using the compiled files in `dist/`.

## Deploying to Vercel

The project includes a `vercel.json` configuration and an `api/index.ts` serverless entrypoint.

1. Build the application:
```bash
npm run build
npm run build:web
```

2. Add your production Neon connection string to Vercel:
```bash
vercel env add DATABASE_URL
```

3. Deploy:
```bash
vercel deploy
```

## Troubleshooting

**Port 3000 already in use**
Kill the existing process or change the `PORT` variable in your `.env` file to an available port (e.g., 3001).

**428 Precondition Required or 412 Version Conflict on API calls**
Mutating endpoints (PUT, POST, DELETE) require optimistic concurrency control. Ensure you are sending the `If-Match: "version_number"` header with your requests.

**Database migration fails**
Verify that your `DATABASE_URL` in `.env` is correct, includes `?sslmode=require`, and that your IP is not blocked by Neon's firewall settings.

**Test database contamination or flaky tests**
Ensure `.env.test` points to a completely separate Neon branch from `.env`. Running tests against the development database will destroy your seeded data and cause test failures.

**Frontend fails to load or 404s on JS files**
The frontend JavaScript is bundled via esbuild. If `public/js/dist/` is missing or outdated, run `npm run build:web` to generate the client bundles.