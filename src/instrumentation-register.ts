/**
 * Node-runtime database bootstrap — loaded by src/instrumentation.ts via
 * `await import()` ONLY when NEXT_RUNTIME === "nodejs" (never in Edge, where
 * node: modules are unavailable).
 *
 * Three jobs, all designed to make deployments self-healing:
 *
 * 1. RENDER HOSTNAME SELF-HEAL — if DATABASE_URL points at an
 *    `*.internal.render.com` host that does not resolve (classic symptom:
 *    web service and PostgreSQL in different Render regions), transparently
 *    fall back to the external `*.render.com` hostname, which works from
 *    anywhere with TLS. The rewritten URL replaces process.env.DATABASE_URL
 *    before the app's db pool is created, so every query uses it.
 *
 * 2. SCHEMA MIGRATIONS — applies the full idempotent DDL
 *    (src/lib/schema-ddl.ts, generated from scripts/schema.sql): CREATE TABLE
 *    IF NOT EXISTS for all tables, guarded DO blocks for constraints. Existing
 *    databases are untouched; brand-new databases are bootstrapped completely.
 *
 * 3. FRESH-DEPLOYMENT BOOTSTRAP — if the database is completely empty (no
 *    organizations), provisions the public trial access codes so the first
 *    signup can activate a workspace. No user accounts or demo data are ever
 *    created automatically.
 *
 * Safety rules:
 * - Every statement is idempotent; running on every boot is harmless.
 * - Failures are logged (with a classified reason) and never fatal: a database
 *   that is unreachable at boot must not take the web server down with it.
 */
export async function bootstrapDatabase() {
  const globalKey = "__ukuuhr_db_bootstrapped__";
  const g = globalThis as unknown as Record<string, unknown>;
  if (g[globalKey]) return; // avoid double-run during dev HMR re-imports
  g[globalKey] = true;

  const { Pool } = await import("pg");
  const { SCHEMA_DDL } = await import("./lib/schema-ddl");
  const { normalizeDatabaseUrl } = await import("./lib/db-url");
  const { lookup } = await import("node:dns/promises");

  /* ── 1. Render internal-hostname fallback ─────────────────────────── */
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.warn("[boot] DATABASE_URL is not set — skipping database bootstrap.");
    return;
  }

  let workingUrl = raw;
  try {
    const u = new URL(normalizeDatabaseUrl(raw) ?? raw);
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (host.endsWith(".internal.render.com")) {
      try {
        await lookup(host);
      } catch {
        const external = host.replace(".internal.render.com", ".render.com");
        try {
          await lookup(external);
          u.hostname = external;
          workingUrl = u.toString();
          process.env.DATABASE_URL = workingUrl; // app pool will use the fallback
          console.warn(
            `[boot] internal Render host "${host}" does not resolve (web service and database are likely in different regions) — falling back to external host "${external}". Prefer colocating them in one region.`
          );
        } catch {
          console.error(
            `[boot] neither internal ("${host}") nor external ("${external}") Render host resolves — the database may be deleted or suspended. Check the Render dashboard.`
          );
        }
      }
    }
  } catch {
    // malformed URL — let pg report it with its normal error below
  }

  /* ── 2. schema migrations + 3. fresh-deployment bootstrap ─────────── */
  const connectionString = normalizeDatabaseUrl(workingUrl);
  let parsed: URL | null = null;
  try {
    parsed = new URL(connectionString ?? "");
  } catch {
    parsed = null;
  }
  const isLocal = parsed
    ? ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)
    : false;

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
    ssl: parsed && !isLocal ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const client = await pool.connect();
    try {
      // full idempotent schema (all tables) — no-ops on existing databases,
      // bootstraps brand-new ones completely
      await client.query(SCHEMA_DDL);

      // fresh-deployment bootstrap: public trial codes so first signup can
      // activate. Only runs when the database has no organizations at all.
      // Codes are single-use by design (same shape as the demo seed).
      const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM "Organization"');
      if ((rows[0]?.n ?? 0) === 0) {
        await client.query(
          `INSERT INTO "Coupon" ("id", "code", "discountPercent", "plan", "status", "expiresAt", "description", "createdAt")
           VALUES (gen_random_uuid()::text, 'UKUU-TRIAL-2026-PRO', 0, 'Professional', 'Active', now() + interval '364 days', 'Demo access code - activates Professional plan', now()),
                  (gen_random_uuid()::text, 'UKUU-TRIAL-2026-ENT', 0, 'Enterprise', 'Active', now() + interval '364 days', 'Demo access code - activates Enterprise plan', now())
           ON CONFLICT ("code") DO NOTHING`
        );
        console.log(
          "[boot] fresh database detected — seeded public trial codes UKUU-TRIAL-2026-PRO / UKUU-TRIAL-2026-ENT (single-use; create the first workspace via /signup)."
        );
      }

      console.log("[boot] database schema verified and up to date.");
    } finally {
      client.release();
    }
  } catch (err) {
    const reason = classifyError(err);
    console.error(
      `[boot] database bootstrap failed (${reason.label}):`,
      err instanceof Error ? err.message : err
    );
  } finally {
    await pool.end().catch(() => {});
  }
}

function classifyError(err: unknown): { label: string } {
  const e = err as { code?: string; message?: string };
  const msg = e?.message ?? "";
  const code = e?.code ?? "";
  if (code === "ENOTFOUND" || /getaddrinfo|ENOTFOUND/i.test(msg)) return { label: "dns-unresolvable-host" };
  if (code === "EAI_AGAIN") return { label: "dns-temporary-failure" };
  if (code === "ECONNREFUSED") return { label: "connection-refused" };
  if (code === "ETIMEDOUT" || /timeout/i.test(msg)) return { label: "connection-timeout" };
  if (code === "ECONNRESET") return { label: "connection-reset" };
  if (code === "28P01" || /password authentication failed/i.test(msg)) return { label: "authentication-failed" };
  if (code === "28000" || /no pg_hba/i.test(msg)) return { label: "server-rejected-connection" };
  if (/database .* does not exist/i.test(msg)) return { label: "database-missing" };
  if (/too many connections/i.test(msg)) return { label: "connection-limit-reached" };
  return { label: "unknown" };
}
