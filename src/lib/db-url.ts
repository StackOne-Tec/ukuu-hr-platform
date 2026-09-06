const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Add conservative connection settings without exposing or rebuilding the
 * credential portion of DATABASE_URL. Explicit settings supplied by the
 * deployment always win.
 */
export function normalizeDatabaseUrl(value: string | undefined): string | undefined {
  if (!value) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    // Let the PostgreSQL driver report malformed URLs with its normal, actionable error.
    return value;
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    return value;
  }

  // Prevent one stalled request from consuming the entire web process while
  // the database is down. These can all be overridden in DATABASE_URL.
  if (!url.searchParams.has("connect_timeout")) {
    url.searchParams.set("connect_timeout", "5");
  }
  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", "10");
  }
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", "5");
  }

  // Render and other hosted PostgreSQL providers require TLS. Do not force it
  // for local PostgreSQL, where SSL is commonly disabled.
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!LOOPBACK_HOSTS.has(host) && !url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", "require");
  }

  return url.toString();
}
