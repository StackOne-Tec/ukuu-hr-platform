/**
 * Next.js server bootstrap hook — runs once when the server starts (dev,
 * `next start`, and the standalone production server).
 *
 * Purpose: apply idempotent database migrations so every deployment (Render,
 * local, container) always has the tables the current code expects. In
 * particular this covers the PasswordResetToken / EmailLog tables that back
 * the real password-recovery flow, plus small additive drift patches —
 * deployments that already applied them are untouched.
 *
 * Safety rules:
 * - Every statement is CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
 *   / ADD COLUMN IF NOT EXISTS, so running on every boot is harmless.
 * - Statements that fail (e.g. an optional drift patch on a database that
 *   lacks the base table) are logged and skipped, never fatal.
 * - A database that is unreachable at boot logs a warning and gives up for
 *   this boot; it must NOT take the web server down with it.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const globalKey = "__ukuuhr_db_migrated__";
  const g = globalThis as unknown as Record<string, unknown>;
  if (g[globalKey]) return; // avoid double-run during dev HMR re-imports
  g[globalKey] = true;

  const { Pool } = await import("pg");
  const { normalizeDatabaseUrl } = await import("./lib/db-url");

  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.warn("[db-migrate] DATABASE_URL is not set — skipping auto-migration.");
    return;
  }

  const connectionString = normalizeDatabaseUrl(raw);
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

  const statements: { sql: string; note: string }[] = [
    {
      note: "password-reset tokens",
      sql: `CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
            "id" TEXT NOT NULL,
            "email" TEXT NOT NULL,
            "tokenHash" TEXT NOT NULL,
            "expiresAt" TIMESTAMP(3) NOT NULL,
            "usedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
        );`,
    },
    {
      note: "password-reset token hash index",
      sql: `CREATE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_idx" ON "PasswordResetToken"("tokenHash");`,
    },
    {
      note: "password-reset email index",
      sql: `CREATE INDEX IF NOT EXISTS "PasswordResetToken_email_idx" ON "PasswordResetToken"("email");`,
    },
    {
      note: "email outbox / audit log",
      sql: `CREATE TABLE IF NOT EXISTS "EmailLog" (
            "id" TEXT NOT NULL,
            "toEmail" TEXT NOT NULL,
            "subject" TEXT NOT NULL,
            "html" TEXT NOT NULL,
            "provider" TEXT NOT NULL DEFAULT 'outbox',
            "status" TEXT NOT NULL DEFAULT 'captured',
            "error" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
        );`,
    },
    {
      note: "email log created-at index",
      sql: `CREATE INDEX IF NOT EXISTS "EmailLog_createdAt_idx" ON "EmailLog"("createdAt" DESC);`,
    },
    {
      note: "coupon redemption drift patch (redeemedAt)",
      sql: `ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "redeemedAt" TIMESTAMP(3);`,
    },
    {
      note: "coupon redemption drift patch (redeemedByOrgId)",
      sql: `ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "redeemedByOrgId" TEXT;`,
    },
    {
      note: "coupon redemption drift patch (redeemedByOrgName)",
      sql: `ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "redeemedByOrgName" TEXT;`,
    },
  ];

  try {
    const client = await pool.connect();
    try {
      let applied = 0;
      for (const stmt of statements) {
        try {
          await client.query(stmt.sql);
          applied += 1;
        } catch (err) {
          console.warn(
            `[db-migrate] skipped "${stmt.note}":`,
            err instanceof Error ? err.message : err
          );
        }
      }
      console.log(`[db-migrate] schema verified (${applied}/${statements.length} statements applied or already present).`);
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn(
      "[db-migrate] database unreachable at boot — migrations skipped for this start:",
      err instanceof Error ? err.message : err
    );
  } finally {
    await pool.end().catch(() => {});
  }
}
