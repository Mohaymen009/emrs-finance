# EMRS Finance Management Platform

A secure, web-only financial ledger platform for a UAE medical services company
with two strictly separated divisions: **Ambulance Services** and **Home
Healthcare Services**. Built with Next.js (App Router), PostgreSQL, and
Drizzle ORM.

## Tech stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS v4) — single full-stack app
- **PostgreSQL** — relational store
- **Drizzle ORM** — type-safe schema, migrations via `drizzle-kit`
- **bcryptjs** — password hashing
- Server-side DB-backed sessions (httpOnly cookie + `sessions` table) — revocable, auditable
- **exceljs** — Excel (.xlsx) report exports
- **zod** — input validation
- **Docker + Caddy** — production deployment with automatic HTTPS (see `DEPLOY.md`)

> Note: the system was originally scoped for Prisma. Prisma's engine-binary
> CDN was unreachable from the sandbox used to build/verify this project, so
> the ORM was switched to Drizzle (no native binary download required). The
> relational schema is otherwise identical to what was designed for Prisma.

## Accounts: no self sign-up

There is no registration page or endpoint anywhere in this system. The only
way to get an account is:

1. Log in as the **master admin** (seeded once, see below), or
2. Have an existing Admin create your account from the **Users** page.

**Usernames and passwords are both case-insensitive.** `Noshaad`, `noshaad`,
and `NOSHAAD` are the same account; `Noshaad123`, `noshaad123`, and
`NOSHAAD123` are the same password. This trades off some password entropy
for convenience — see "Security features" below for what compensates for it.

The seeded master admin is `Noshaad` / `Noshaad123` (change this immediately
after first login, from the Users page — see `.env.example` /
`SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` to seed different credentials
instead).

## Getting started (local development)

```bash
cp .env.example .env      # then edit DB credentials / seed admin password
docker compose up -d postgres   # Postgres only, for local dev
npm install
npm run db:push           # creates all tables/enums/indexes from src/db/schema.ts
npm run db:seed           # creates the two divisions + the master admin
npm run dev                # http://localhost:3000
```

**For production deployment on your own VPS, see `DEPLOY.md`** — it covers
installing Docker, DNS, HTTPS via Caddy, running migrations, backups, and
updates, step by step.

## What's implemented

- **Auth**: username/password login, both compared case-insensitively,
  bcrypt-hashed passwords (case-normalized before hashing), server-side
  revocable sessions (opaque random token in a `sessions` table — not a
  signed JWT, so there's no secret key whose leakage could forge a session).
- **No self-registration**: accounts exist only via the seeded master admin
  or accounts an Admin creates from the Users page.
- **RBAC**: Admin vs Viewer, enforced on every API route server-side (not
  just hidden in the UI). Viewers cannot create/edit/delete records, cannot
  manage users, and cannot see audit/login/export logs.
- **User management** (`/admin/users`, Admin-only): create accounts
  (username, password, full name, role, division access), view every
  account's role/division access/active status/last login, reset a user's
  password, deactivate/reactivate accounts. A safeguard blocks the last
  remaining active Admin from demoting or deactivating themselves (so you
  can't accidentally lock everyone out).
- **Division separation**: every user is granted access to one or both
  divisions; every income/expense record belongs to exactly one division;
  every API route filters and validates against the caller's granted
  divisions server-side, including when a division is requested explicitly
  via a query parameter.
- **Income ledger**: free-text title, division, date, amount, VAT
  toggle+amount, optional client details (name/phone/email/company/TRN),
  notes, optional invoice upload. Payment rules: Paid requires payment date
  + method; Complimentary (as a status or a payment method) always zeroes
  the amount but the record stays in reports; payments are append-only/
  immutable (a second payment attempt on the same record is rejected 409).
- **Expense ledger**: free-text description, division, amount, date,
  supplier, VAT toggle+amount, notes, and a **mandatory** receipt upload —
  the API rejects the request outright if no valid file is attached.
  Every expense carries a **category** (preset list in
  `src/lib/expenseCategories.ts` with an "Other" free-text fallback), shown
  in the table/detail/export and filterable on the Expenses page.
- **Clients (CRM)**: a Clients page listing every client with record count,
  total billed, outstanding balance and last activity (searchable, sortable,
  filterable to clients with outstanding balances), plus a per-client detail
  page with contact details (incl. address + internal notes), lifetime
  totals, and the client's full income history. Income create/edit reuse an
  existing client row when the exact same details are entered instead of
  inserting a duplicate per record, the income form offers to reuse a
  matching client's saved details as you type, and the seed step merges
  duplicate client rows that already exist. Admins can create/edit clients
  directly; all reads stay division-scoped.
- **Private file storage**: invoices/receipts are written outside `public/`
  (path-traversal-safe) and can only be retrieved through an authenticated,
  division-scoped API route — there is no public URL for any file.
- **Dashboards**: per-division totals (income, expenses, VAT collected,
  outstanding receivables, entry count) plus a combined company-wide
  dashboard visible only to Admins, and an **Analytics** section: 12-month
  income-vs-expenses trend chart, receivables aging buckets
  (0–30/31–60/61–90/90+ days), collections by payment method, expenses by
  category, and top clients by revenue — all server-rendered with no
  charting dependency, division-scoped, and (except the fixed 12-month
  trend) respecting the dashboard date filter.
- **Reporting**: Excel (.xlsx) export for Income and Expense (VAT/Profit
  export types combine both), filterable by division/date range/payment
  status/VAT; every export is logged.
- **Audit trail**: every create/update/delete of income/expense, every
  payment recorded, every file upload/download, every export, and every
  user-management action is written to an append-only `audit_logs` table
  with user, action, record, division, and metadata. Login/logout — success,
  failure, and even attempts against usernames that don't exist — are
  logged separately in `login_logs`, all visible to Admins on the
  **System Logs** page, filterable by user/division/action/date.

### Security features

- **Case-insensitive credentials reduce password entropy**, so the login
  endpoint is rate-limited: 5 failed attempts (per IP+username) triggers a
  15-minute lockout — including against the *correct* password, so a locked
  account can't be brute-forced through during the cooldown either.
- **CSRF defense in depth**: session cookies are `httpOnly` + `SameSite=Lax`
  (the primary defense — browsers won't attach them to cross-site
  POST/PUT/PATCH/DELETE requests), plus middleware that rejects any
  mutating `/api/*` request whose `Origin` header doesn't match the app's
  own origin.
- **Security response headers** (`X-Content-Type-Options`, `X-Frame-Options:
  DENY`, `Referrer-Policy`, `Permissions-Policy`) set on every response, plus
  HSTS at the Caddy layer in production.
- File uploads are validated by MIME type and size (15MB cap) before being
  written to private storage with restrictive file permissions.
- Every mutating action requires an authenticated session AND the correct
  role AND access to the relevant division — checked server-side on every
  request, never inferred from the UI.
- In production, Postgres and the app itself are never exposed to the
  public internet — only the Caddy reverse proxy is (see `DEPLOY.md`).

### Deferred / natural next steps

- Edit UI for existing income/expense records (the API supports
  `PATCH`/soft-delete today; only the create flow has a form).
- Per-viewer export permission flag (currently all authenticated users can
  export within their divisions).
- Invoice upload UI on the income list (the API route exists:
  `POST /api/income/:id/invoice`).
- Forced password change on first login.
- Pagination/server-side filtering on the income/expense tables.
- Optional 2FA for Admin accounts.

## Project layout

```
src/db/schema.ts          Drizzle schema — all relational models
src/db/index.ts           DB client (node-postgres pool)
src/db/seed.ts            Seeds divisions + the master admin
src/lib/auth.ts           Session creation/validation, case-insensitive password hashing, RBAC helpers
src/lib/rate-limit.ts     Login attempt rate limiting + lockout
src/lib/audit.ts          Append-only audit/login/export log writers
src/lib/storage.ts        Private file storage (save/read/delete, path-traversal guarded)
src/lib/validation.ts     Zod schemas encoding the business rules and account policy
src/lib/stats.ts          Division dashboard aggregation + analytics (trend, aging, breakdowns)
src/lib/clients.ts        Client dedupe (findOrCreateClient) + CRM list/detail queries
src/lib/expenseCategories.ts   Preset expense categories offered by the form
src/components/charts.tsx Server-rendered SVG chart primitives for the dashboard
src/middleware.ts         CSRF Origin-check guard for mutating API requests
src/app/api/**            All backend routes (auth, income, expense, files, dashboard, reports, admin users/logs)
src/app/(app)/**          Authenticated UI (dashboard, income, expenses, admin users, admin logs)
Dockerfile, docker-compose.yml, Caddyfile   Production deployment (see DEPLOY.md)
```

## Verification performed

The full flow was exercised end-to-end against a real PostgreSQL instance:
case-insensitive login (multiple casing variants), CSRF rejection of
cross-origin requests, absence of any registration endpoint, RBAC on every
mutating endpoint, user creation/listing/deactivation via the Users API,
the self-demotion/deactivation safeguard for the last Admin, division
separation for a Viewer scoped to one division only, Complimentary-forces-
zero, Paid-requires-date-and-method, immutable payment history, mandatory-
receipt enforcement, authenticated-only file retrieval, dashboard math,
Excel export, login-rate-limit lockout (and that it also blocks the correct
password during cooldown), and presence of every required audit/login log
entry (including failed attempts against non-existent usernames) —
**41/41 automated checks passed**. `npm run build` (production build) and
`tsc --noEmit` (strict mode) both complete cleanly.
