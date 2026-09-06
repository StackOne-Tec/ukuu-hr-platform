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
