# UKUU HR Platform

A modern HR management SaaS application built with Next.js, featuring a marketing landing page, authentication flow, and an HR admin dashboard.

## Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS + [shadcn/ui](https://ui.shadcn.com/) components
- **Data layer**: Prisma ORM with SQLite
- **Server state**: TanStack Query
- **Font**: Plus Jakarta Sans

## Features

- **Landing page** (`/`) — hero, feature overview, pricing tiers, and CTA sections
- **Authentication** (`/login`, `/signup`) — split-screen brand panel + form experience with sign-in / sign-up / forgot-password modes, password strength meter, show/hide toggle, remember-me, light/dark theme, and mock Google SSO
- **Dashboard** (`/dashboard`) — HR admin overview with stats, charts, tables, and module navigation
- **Mock auth API** (`/api/auth/*`) — login / register / forgot endpoints returning session tokens, with safe internal redirect support (`?ReturnUrl=`)

## Getting started

```bash
# install dependencies
bun install

# set up the database (SQLite)
cp .env.example .env   # or create .env with DATABASE_URL
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
prisma/          # database schema
```

## Notes

Authentication endpoints are mock implementations intended for frontend development — replace them with a real identity provider before production use.
