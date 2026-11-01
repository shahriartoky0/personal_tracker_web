# Taka Tracker — personal finance tracker

Mobile-first web app to plan daily spending, record income/expenses, and review reports.
Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn/ui (Radix) · Recharts · Supabase (Postgres, Auth, RLS).
Default currency BDT (৳), timezone Asia/Dhaka — both configurable in Settings.

## Quick start

```bash
npm install
cp .env.example .env.local        # then fill in the two values (see below)
npm run dev                       # http://localhost:3000
```

Environment variables (`.env.local`, never committed):

| Variable | Where it is used |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-id>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **publishable** key (`sb_publishable_…`) |
| `NEXT_PUBLIC_SITE_URL` | optional; public origin used in email links (default `http://localhost:3000`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **optional, server-only**; enables "Delete my account". Never prefix with `NEXT_PUBLIC_` |

## Database: migrate and seed

Schema, RLS policies, the signup trigger and the private `receipts` bucket live in
`supabase/migrations/20261101000000_initial_schema.sql`. Apply it **one** way (don't mix with Table Editor edits):

- **Dashboard:** SQL Editor → New query → paste the file → Run.
- **CLI:** `npx supabase login && npx supabase link --project-ref <project-id> && npx supabase db push`

There is no global seed. On signup the `handle_new_user()` trigger creates the profile (BDT / Asia/Dhaka),
default categories, a Cash account and reminder preferences for that user (`supabase/seed.sql` explains this).
Money is stored as integer minor units (poisha) in `bigint` columns.

Auth URL configuration (Supabase → Authentication → URL Configuration): Site URL = your app origin, and add
`http://localhost:3000/auth/callback` plus `https://<production-domain>/auth/callback` to Redirect URLs.

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Unit tests (domain + use cases with in-memory repositories; no Supabase/Next needed) |
| `npm run test:rls` | Two-user RLS isolation tests against your Supabase project (see below) |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint |
| `node scripts/responsive-check.mjs <baseUrl> [paths]` | Screenshots at 8 viewports, overflow + axe WCAG checks (uses local Chrome) |

### RLS integration test

`src/tests/integration/rls.test.ts` signs in two real users and asserts that A cannot read, update, delete or
reference B's rows, and that anonymous requests see nothing. It is skipped unless these are set:
`TEST_USER_A_EMAIL`, `TEST_USER_A_PASSWORD`, `TEST_USER_B_EMAIL`, `TEST_USER_B_PASSWORD` (two confirmed users
created in a **test** project or with email confirmation temporarily disabled).

## Architecture (Clean Architecture, feature-first)

```
src/
  app/                    routes only: thin pages, layouts, loading/error boundaries
  components/             shared UI (ui/ = shadcn), layout shell, charts
  features/<feature>/
    domain/               entities, repository ports, pure services, use cases   (no Next/Supabase imports)
    data/                 dto, mappers, Supabase datasources, repository implementations
    presentation/         components, forms (Zod), server actions
  shared/
    domain/               money (integer minor units), dates/timezones, Result/errors
    application/          GetDashboardSummary (cross-feature orchestration)
    infrastructure/       Supabase client factories, error translation, composition root (container.ts)
    demo/                 in-memory repositories + sample data for /demo
  tests/unit, tests/integration
supabase/migrations, supabase/seed.sql
```

Request flow (add expense):
`TransactionForm → saveTransactionAction (auth + Zod) → CreateExpense → TransactionRepository (port) →
SupabaseTransactionRepository → TransactionDatasource → Postgres (RLS)`.

Rules enforced: domain never imports Next/Supabase; UI never queries Supabase; every calculation has one
implementation in domain (`budget-calculator`, `transaction-calculator`, `period-report`, `balance`) reused by
dashboard, reports and tests; DB rows are mapped to domain types in `data/mappers`; Supabase errors are translated
to typed domain errors; authorization is enforced by the server session **and** RLS.

**Where to add things:** a new business rule → `features/<x>/domain/services` (+ unit test); a new action →
use case in `domain/use-cases`, wire it in `shared/infrastructure/container.ts`, expose via a server action in
`presentation/actions.ts`; a new table → new migration file + datasource/mapper/repository in the feature's `data/`.

## Key behaviours

- **Left for today** = daily limit − actual expenses (can be negative → "Over budget"). Allocations are plans, never spending.
- Editing a plan keeps `original_limit` / `original_amount` for variance reporting.
- Transfers are two linked rows (`transfer_group_id`) created atomically by `create_transfer()`; excluded from income/expense everywhere; deleting one leg removes both.
- A transaction's day = its instant in the profile timezone. Wall-clock form input is converted using that timezone.
- CSV export is formula-injection safe, UTF-8 with BOM (opens correctly in Excel).
- `/demo` shows sample data from in-memory repositories; it is never written to the database or mixed with real records.

## Design system

shadcn/ui (Radix) + Tailwind, Lucide icons, Recharts, React Hook Form + Zod. Tokens in `src/app/globals.css`
(semantic colours incl. success/warning/destructive/chart-1…8, radius, focus ring; light + dark).
Fonts: **Inter** (400/500/600/700) with **Noto Sans Bengali** fallback via `next/font`; tabular numerals for money (`.num`).
Breakpoints: 640 / 768 / 1024 / 1280 (Tailwind defaults). Phone: bottom nav + floating Add Expense + bottom-sheet forms,
card lists; ≥1024px: sidebar + tables. Full details in `docs/DESIGN.md`.

## Deployment (Vercel)

1. Push the repo, import it in Vercel.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (and optionally `SUPABASE_SERVICE_ROLE_KEY`) in Project → Environment Variables.
3. After the domain exists, add it to Supabase Site URL and Redirect URLs.
4. For real users configure custom SMTP in Supabase (the default mailer is heavily rate-limited).

## Backup, restore, deletion, key rotation

- **Export:** Settings → Data & security → Export all transactions (CSV).
- **Backups:** depend on your Supabase plan (Dashboard → Database → Backups). Free projects do not include automated restore; take a manual `pg_dump` before major changes. Don't assume point-in-time recovery unless your plan lists it.
- **Delete data:** Settings → Delete all transactions & plans. **Delete account:** requires `SUPABASE_SERVICE_ROLE_KEY` on the server; otherwise delete the user in Dashboard → Authentication → Users (all rows cascade).
- **Rotate keys:** Dashboard → Project Settings → API Keys → regenerate, update env vars in Vercel and `.env.local`, redeploy.

## Known limitations

- Receipt photos: the private `receipts` bucket, policies and `receipt_path` column exist, but the upload UI is not built yet.
- Reminders: preferences are stored and the budget-threshold alert drives the dashboard status; push/email delivery of time-based reminders is not implemented.
- Plan saving (budget + allocations) is several sequential statements, not one DB transaction.
- Authenticated screens were verified through build/type/lint/unit tests and the public routes through browser checks; end-to-end tests of signed-in flows need a confirmed test account (see RLS section).
