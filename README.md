# Peak Performance

Nutrition/performance tracking app implementing the v4 spec patch (Decisions #5-#10).

**Read `ASSUMPTIONS.md` before trusting any target number this app produces.** It was built from the
v4 patch alone, without the v3 base spec it's layered on top of — every gap that filled is listed
there, not buried in comments.

## What's implemented

- **Decision #5** — TDEE confidence bands (±15/25/30% by source) shown on every TDEE-derived target.
- **Decision #6** — Katch-McArdle only fires for DEXA/BodPod/3-site-clinical-caliper BF%; everything
  else (including a present-but-untrusted BF% number) falls back to Mifflin-St Jeor.
- **Decision #7** — 7-day rolling weight trend + carb-variance contamination flag. High-variance weeks
  are flagged, not silently excluded, and delay automatic adjustments by one week.
- **Decision #8** — Required `seasonStartDate` on the athlete profile; a persistent dashboard banner
  fires at ≤14 days out and stays until explicitly acknowledged.
- **Decision #9** — Password-gate middleware, fails closed on Vercel if `APP_PASSWORD` isn't set.
- **Decision #10** — Review Decision #1 backtest: weekly_net simulated allocation vs strict_daily
  actuals, gated at 14 days minimum, flags low-confidence below 30 days.

## Setup

1. Create a Supabase project (or use an existing one).
2. Get both connection strings: Project Settings -> Database -> Connection string -> URI tab.
   You need the **pooled** (port 6543) string for `DATABASE_URL` and the **direct** (port 5432)
   string for `DIRECT_URL`. See `.env.example` for the exact format.
3. Run:

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL, DIRECT_URL, APP_PASSWORD
npx prisma migrate dev --name init
npm run dev
```

`prisma migrate` uses `DIRECT_URL` automatically (it's wired in `prisma/schema.prisma`); the app
itself uses the pooled `DATABASE_URL` at runtime. This requires network access to
`binaries.prisma.sh` for the Prisma CLI to fetch engine binaries — this could not be verified in the
sandbox this was built in (see "What's verified" below).

### Why not just one connection string?
Supabase's pooler (Supavisor/PgBouncer) runs in transaction pooling mode by default, which doesn't
support prepared statements — `prisma migrate` needs those. Runtime queries from `@prisma/client`
work fine through the pooler, so the app uses `DATABASE_URL` (pooled) day-to-day and only reaches for
`DIRECT_URL` during migrations.

## What's verified vs. not

- **Verified**: all calculation logic (`lib/tdee.ts`, `lib/nutrition.ts`, `lib/trend.ts`,
  `lib/backtest.ts`) — run `npx tsx scripts/sanity-check.ts`, 25 assertions, all passing. This covers
  the Katch-McArdle gate, confidence bands, cap-bit logic, carb-variance flagging, and the backtest's
  14-day gate and 30-day confidence threshold. Unaffected by the database migration.
- **Verified**: `npx tsc --noEmit` compiles cleanly except for fields on Prisma model types — expected,
  since the Prisma client couldn't be generated in this sandbox (see below), not a logic error.
  Schema field names were manually cross-checked against every query in the API routes.
- **NOT verified**: a full `next build` / `next dev` run, or a real `prisma migrate dev` against a
  live Supabase database. This sandbox's network allowlist doesn't include `binaries.prisma.sh`, so
  `prisma generate`/`validate`/`migrate` all fail here (403) regardless of which datasource provider
  is configured — this was true for SQLite and is equally true for Postgres. Run it yourself against
  your Supabase project; if something's broken at that layer (including whether `DIRECT_URL` is wired
  correctly for your specific Supabase pooling setup), it hasn't been caught yet.
- **On enums**: Postgres supports the four enums (`BFMethod`, `FuelingPhilosophy`, `TdeeSource`,
  `SessionType`) natively — this migration was the fix for that, not a workaround. No application code
  changed; only `prisma/schema.prisma`'s datasource block and the env vars did.

## Project structure

- `lib/tdee.ts`, `lib/nutrition.ts`, `lib/trend.ts`, `lib/backtest.ts` — pure calculation engines
- `prisma/schema.prisma` — data model
- `middleware.ts`, `lib/auth.ts` — Decision #9 auth gate
- `app/` — Next.js App Router pages + API routes
- `scripts/sanity-check.ts` — standalone test script for the calc engines
