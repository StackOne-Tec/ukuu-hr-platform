# UKUU HR Platform

A modern HR management SaaS application built with Next.js, featuring a marketing landing page, authentication flow, and an HR admin dashboard.

## Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS + [shadcn/ui](https://ui.shadcn.com/) components
- **Data layer**: direct PostgreSQL access via `pg` ([Render PostgreSQL](https://render.com/docs/databases))
- **Server state**: TanStack Query
- **Font**: Plus Jakarta Sans

## Features

- **Landing page** (`/`) — hero, feature overview, pricing tiers, and CTA sections
- **Authentication** (`/login`, `/signup`) — split-screen brand panel + form experience with sign-in / sign-up / forgot-password modes, password strength meter, show/hide toggle, remember-me, light/dark theme, and mock Google SSO
- **Dashboard** (`/dashboard`) — HR admin overview with stats, charts, tables, and module navigation
- **Mock auth API** (`/api/auth/*`) — login / register / forgot endpoints returning session tokens, with safe internal redirect support (`?ReturnUrl=`)
- **Health check** (`/api/health`) — reports app status and database connectivity

## Getting started

```bash
# install dependencies
bun install

# set up the database
# .env -> DATABASE_URL=postgresql://user:password@host:5432/dbname
# (locally you can use any Postgres instance; on Render this is set automatically)
cp .env.example .env
bun run db:push

# start the dev server
bun run dev
```

The app runs at `http://localhost:3000`.

## Project structure

```
src/
  app/           # routes: landing, login, signup, dashboard, API handlers
  components/
    landing/     # marketing page sections
    auth/        # authentication experience components
    dashboard/   # dashboard layout and modules
    ui/          # shadcn/ui primitives
  lib/           # utilities
src/lib/         # database and server utilities
```

## Notes

Authentication endpoints are mock implementations intended for frontend development — replace them with a real identity provider before production use.

## Deployment (Render)

The app is deployed on [Render](https://render.com) as a Node web service backed by a managed PostgreSQL instance (`ukuuhr-db`, region `oregon`).

- **Build command**: `npm install && npm run build` (installs dependencies and produces the standalone Next.js server)
- **Start command**: `node .next/standalone/server.js`
- **Environment**: `DATABASE_URL` (internal connection string of the Render PostgreSQL instance), `NODE_VERSION`, `HOSTNAME=0.0.0.0`
- **Health check**: `/api/health`

The service auto-deploys from `main` on every push to [StackOne-Tec/ukuu-hr-platform](https://github.com/StackOne-Tec/ukuu-hr-platform).

### Database migrations (automatic)

Schema migrations are applied automatically when the server boots (`src/instrumentation.ts`): the additive patches the current code expects — the `PasswordResetToken` and `EmailLog` tables that back the password-recovery flow, plus coupon-redemption columns — are created with `IF NOT EXISTS` statements, so re-running on every deploy is safe and existing data is untouched.

For a brand-new PostgreSQL instance, the full schema (all 39 tables) can be applied manually against any `DATABASE_URL`:

```bash
DATABASE_URL=postgresql://... npm run db:migrate
```

The complete idempotent DDL lives in `scripts/schema.sql`; it is safe to re-run at any time.

### Transactional email (password reset, invites, notifications)

Email is delivered through [Resend](https://resend.com). Set `RESEND_API_KEY` in the Render dashboard (Environment tab) to enable real delivery:

1. Create a free Resend account (100 emails/day on the free tier).
2. Copy the API key into `RESEND_API_KEY` on the Render web service.
3. Optionally verify a sending domain at resend.com/domains and set `EMAIL_FROM` (until then Resend only delivers to the account owner's address, using the shared `onboarding@resend.dev` sender).

When `RESEND_API_KEY` is unset the app still records every message in the `EmailLog` table (audit trail), and in development the Dev Mailbox at `/dev/mailbox` shows them so email flows can be tested end-to-end. In production the Dev Mailbox is disabled by design — captured messages contain live password-reset links and must never be publicly readable (`DEV_MAILBOX_ENABLED` overrides for private staging boxes only).

### Keeping the free instance awake

Render's free web services spin down after ~15 minutes without inbound traffic, which makes the first request after idling slow (cold start). To keep the instance (and therefore the connected database sessions) always active, ping the health check from an external monitor on a schedule tighter than the spin-down window — e.g. [UptimeRobot](https://uptimerobot.com) (free, 5-minute interval) or [cron-job.org](https://cron-job.org) (free, 1-minute interval) pointed at `https://<your-service>.onrender.com/api/health`.
