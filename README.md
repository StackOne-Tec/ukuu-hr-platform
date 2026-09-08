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
- **Authentication** (`/login`, `/signup`) — split-screen brand panel + form experience with sign-in / sign-up / forgot-password modes, password strength meter, show/hide toggle, remember-me, light/dark theme, and Google OAuth sign-in
- **Dashboard** (`/dashboard`) — HR admin overview with stats, charts, tables, and module navigation
- **Auth API** (`/api/auth/*`) — login / register / forgot endpoints returning session tokens, plus Google OAuth start and callback routes
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

Authentication uses the existing server-side web-session model. Google OAuth signs in existing Ukuu HR accounts by verified email; users must create their workspace through the normal signup form first.


## Deployment (Render)

The app is deployed on [Render](https://render.com) as a Node web service backed by a managed PostgreSQL instance (`ukuuhr-db`, region `oregon`).

- **Build command**: `npm install && npm run build` (installs dependencies and produces the standalone Next.js server)
- **Start command**: `node .next/standalone/server.js`
- **Environment**: `DATABASE_URL`, `NODE_VERSION`, `HOSTNAME=0.0.0.0`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and optionally `GOOGLE_REDIRECT_URI`
- **Health check**: `/api/health`

For Google OAuth, register these exact authorized redirect URIs in Google Cloud Console:

- `https://www.ukuuhr.com/api/auth/google/callback`
- `https://portal.ukuuhr.com/api/auth/google/callback`
- `http://localhost:3000/api/auth/google/callback` (local development)

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Render; keep the client secret out of `public/` and source control. Rotate the client secret if it has previously been exposed.

The service auto-deploys from `main` on every push to [StackOne-Tec/ukuu-hr-platform](https://github.com/StackOne-Tec/ukuu-hr-platform).
