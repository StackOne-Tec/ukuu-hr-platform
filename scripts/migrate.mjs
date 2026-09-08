#!/usr/bin/env node
/**
 * Apply scripts/schema.sql to the database in DATABASE_URL.
 *
 * Idempotent: every statement is CREATE ... IF NOT EXISTS, so it is safe to
 * re-run on every deploy. Use it to bootstrap a fresh PostgreSQL instance
 * (Render, local, container) or to bring an existing one up to date.
 *
 *   DATABASE_URL=postgres://...  node scripts/migrate.mjs
 *
 * On Render this runs automatically at server boot via src/instrumentation.ts
 * (additive drift patches); running this script additionally guarantees the
 * FULL schema (all 39 tables) exists, e.g. for a brand-new database.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, "schema.sql");

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("DATABASE_URL is not set. Export it first, e.g.");
  console.error("  DATABASE_URL=postgresql://user:pass@host:5432/db node scripts/migrate.mjs");
  process.exit(1);
}

function normalize(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return value;
    if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "5");
    const host = url.hostname.toLowerCase();
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(host);
    if (!isLocal && !url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "require");
    return url.toString();
  } catch {
    return value;
  }
}

const connectionString = normalize(raw);
const parsed = (() => {
  try {
    return new URL(connectionString);
  } catch {
    return null;
  }
})();
const isLocal = parsed ? ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) : false;

const client = new pg.Client({
  connectionString,
  ssl: parsed && !isLocal ? { rejectUnauthorized: false } : undefined,
});

const sql = readFileSync(schemaPath, "utf8");

try {
  await client.connect();
  console.log("[migrate] connected — applying scripts/schema.sql (idempotent)...");
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  }
  const { rows } = await client.query(
    "SELECT COUNT(*)::int AS tables FROM pg_tables WHERE schemaname = 'public'"
  );
  console.log(`[migrate] done — schema is up to date (${rows[0].tables} tables in public schema).`);
} catch (err) {
  console.error("[migrate] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
