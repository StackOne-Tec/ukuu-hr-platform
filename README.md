# UKUU HR Platform

A modern HR management SaaS application built with Next.js, featuring a marketing landing page, authentication flow, and an HR admin dashboard.

## Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS + [shadcn/ui](https://ui.shadcn.com/) components
- **Data layer**: Cloud Firestore via the [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
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

# set up Firebase (Cloud Firestore)
# Firebase Console → Project settings → Service accounts → Generate new private key,
# then either paste the JSON inline in .env:
#   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
# or set GOOGLE_APPLICATION_CREDENTIALS to the downloaded file path.
cp .env.example .env

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

Authentication is tied to **Firebase Authentication**: credentials are verified
by Firebase (Identity Toolkit REST for sign-in, Admin SDK for account creation)
and passwords are never stored in our database — legacy plaintext accounts are
migrated into Firebase automatically on their next successful sign-in, after
which the stored plaintext is removed. Sessions keep the existing server-side
web-session model (httpOnly cookies backed by hashed session rows). Google
OAuth signs in existing Ukuu HR accounts by verified email and mints the Google
identity into Firebase Auth; users must create their workspace through the
normal signup form first. Enable the **Email/Password** sign-in method (and
Google, for Google sign-in) under Firebase Console → Authentication → Sign-in
method.


## Deployment (Render)

The app is deployed on [Render](https://render.com) as a Node web service backed by Cloud Firestore.

- **Build command**: `npm install && npm run build` (installs dependencies and produces the standalone Next.js server)
- **Start command**: `node .next/standalone/server.js`
- **Environment**: `FIREBASE_SERVICE_ACCOUNT` (or `GOOGLE_APPLICATION_CREDENTIALS`), `FIREBASE_WEB_API_KEY` (required for sign-in), `NODE_VERSION`, `HOSTNAME=0.0.0.0`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and optionally `GOOGLE_REDIRECT_URI`
- **Health check**: `/api/health`

> Firestore note: queries that combine a `where` filter with an `orderBy` need a
> composite index. The first time such a query runs, Firestore returns a link in
> the error to create it in the console — click through, or deploy
> `firestore.indexes.json` with `firebase deploy --only firestore:indexes` if you
> have the Firebase CLI configured.

For Google OAuth, register these exact authorized redirect URIs in Google Cloud Console:

- `https://www.ukuuhr.com/api/auth/google/callback`
- `https://portal.ukuuhr.com/api/auth/google/callback`
- `http://localhost:3000/api/auth/google/callback` (local development)

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Render; keep the client secret out of `public/` and source control. Rotate the client secret if it has previously been exposed.

The service auto-deploys from `main` on every push to [StackOne-Tec/ukuu-hr-platform](https://github.com/StackOne-Tec/ukuu-hr-platform).
