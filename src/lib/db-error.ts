import "server-only";

/* ═══════════════════════════════════════════════════════════════════════════
   Database error helpers.

   Every API route that touches the database catches errors and degrades to a
   safe response. These helpers make that degradation useful:
     - dbErrorMessage()  → a descriptive, user-facing message that says WHAT
                           happened and WHY, without ever leaking credentials,
                           connection strings, or driver internals.
     - logDbError()      → the real underlying cause, written to the server
                           log with route context, the failing model/operation
                           (when tagged by the data layer), and the gRPC /
                           Firestore error code + any index-creation link.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Order matters — more specific signatures first. Messages stay generic enough
   to be safe for end users but specific enough to be actionable. */
const DB_ERROR_MESSAGES: Array<[RegExp, string]> = [
  // ── Firestore / Admin SDK (gRPC-style) signatures ────────────────────────
  [
    /requires an index|create_composite/i,
    "The database is missing an index required for this query — an administrator needs to create it (the server log includes the exact link).",
  ],
  [
    /permission_denied|missing or insufficient permissions/i,
    "The database denied access — check the service account permissions and Firestore security rules.",
  ],
  [
    /unauthenticated|invalid credential|invalid_grant/i,
    "The database rejected the server credentials — check the service account key and its expiry.",
  ],
  [
    /unavailable|temporarily unavailable|service unavailable/i,
    "The database service is temporarily unavailable — please try again in a moment.",
  ],
  [
    /deadline_exceeded|deadline exceeded|deadline-exceeded/i,
    "The database took too long to respond — please try again in a moment.",
  ],
  [
    /resource_exhausted|quota|exceeded.*limit/i,
    "The database quota or limit has been reached — please try again later.",
  ],
  [
    /invalid_argument|invalid argument/i,
    "The database rejected the request as invalid — check the data being saved.",
  ],
  [
    /internal\b|data_loss/i,
    "The database encountered an internal error — please try again.",
  ],
  [
    /already_exists|already exists/i,
    "That record already exists in the database.",
  ],
  [
    /project .* does not match|project id.*mismatch|different project/i,
    "The database project configuration does not match the server credentials — check the service account and project id.",
  ],

  // ── Legacy driver signatures (kept for safety) ───────────────────────────
  [
    /no sni information found/i,
    "The database rejected the secure connection because it was missing the database hostname — check that the app connects using the full database URL.",
  ],
  [
    /connection terminated unexpectedly|terminating connection|connection was reset by peer|econnreset/i,
    "The database closed the connection before finishing the handshake. It may be paused, restarting, or overloaded — please try again in a moment.",
  ],
  [
    /connect etimedout|etimedout|connection timed out|timeout expired/i,
    "The database did not respond in time. It may be down or unreachable from this network — please try again in a moment.",
  ],
  [
    /econnrefused|connection refused/i,
    "The database refused the connection. It may be offline, or the database host or port may be incorrect.",
  ],
  [
    /getaddrinfo enotfound|enotfound|enodata/i,
    "The database host could not be found — check the database connection settings.",
  ],
  [
    /ssl.*not allowed|ssl.*required|no pg_hba|sslmode/i,
    "The database rejected the secure connection — check the database TLS settings.",
  ],
  [
    /password authentication failed|authentication failed/i,
    "The database rejected the stored credentials — check the database user and password.",
  ],
  [
    /role .* does not exist/i,
    "The database user does not exist — check the database connection settings.",
  ],
  [
    /database .* does not exist/i,
    "The database could not be found — check the database name in the connection settings.",
  ],
  [
    /too many connections|connection limit exceeded|remaining connection slots/i,
    "The database has reached its connection limit — please try again shortly.",
  ],
  [
    /no pg_hba\.conf entry/i,
    "The database rejected this connection's address — check the database's access rules.",
  ],
  [
    /relation .* does not exist|undefined_table|missing.*table/i,
    "The database is missing expected tables — run the database migrations and seed.",
  ],
  [
    /could not connect|connect to server .* failed|socket hang up/i,
    "The database could not be reached — it may be offline, or the connection settings may be wrong.",
  ],
  [
    /not[_ ]?found|no entity to update|document .* does not exist/i,
    "The requested record could not be found.",
  ],
];

/** Descriptive, user-facing message for a database failure. Never contains the
    raw driver error — those can embed hosts, users, and connection details. */
export function dbErrorMessage(
  e: unknown,
  fallback = "Something went wrong while reaching the database. Please try again."
): string {
  if (!(e instanceof Error)) return fallback;
  const message = e.message;
  for (const [pattern, text] of DB_ERROR_MESSAGES) {
    if (pattern.test(message)) return text;
  }
  return fallback;
}

/** True when the error matches a known database-failure signature. Lets callers
    distinguish a real database outage (503) from an ordinary conflict such as
    a duplicate or missing record (409 / 404). */
export function isKnownDbError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return DB_ERROR_MESSAGES.some(([pattern]) => pattern.test(e.message));
}

/* ─── gRPC / Firestore code extraction ───────────────────────────────────── */

const GRPC_CODES: Record<string, string> = {
  "1": "CANCELLED",
  "2": "UNKNOWN",
  "3": "INVALID_ARGUMENT",
  "4": "DEADLINE_EXCEEDED",
  "5": "NOT_FOUND",
  "6": "ALREADY_EXISTS",
  "7": "PERMISSION_DENIED",
  "8": "RESOURCE_EXHAUSTED",
  "9": "FAILED_PRECONDITION",
  "10": "ABORTED",
  "11": "OUT_OF_RANGE",
  "12": "UNIMPLEMENTED",
  "13": "INTERNAL",
  "14": "UNAVAILABLE",
  "15": "DATA_LOSS",
  "16": "UNAUTHENTICATED",
};

/** Pull "9 FAILED_PRECONDITION" style codes out of a driver error message. */
function extractGrpcCode(message: string): { code: string; name: string } {
  const named = message.match(/\b(\d{1,2})\s+([A-Z][A-Z_]{2,})\b/);
  if (named && GRPC_CODES[named[1]] === named[2]) {
    return { code: named[1], name: named[2] };
  }
  const bare = message.match(/\b(1[0-6]|[1-9])\s+(UNAVAILABLE|NOT_FOUND|INTERNAL|PERMISSION_DENIED|INVALID_ARGUMENT|FAILED_PRECONDITION|DEADLINE_EXCEEDED|RESOURCE_EXHAUSTED|UNAUTHENTICATED|ALREADY_EXISTS|ABORTED|OUT_OF_RANGE|UNIMPLEMENTED|DATA_LOSS|CANCELLED|UNKNOWN)\b/);
  if (bare) return { code: bare[1], name: bare[2] };
  const numeric = message.match(/\bcode[=: ]+(\d{1,2})\b/);
  if (numeric && GRPC_CODES[numeric[1]]) return { code: numeric[1], name: GRPC_CODES[numeric[1]] };
  return { code: "", name: "" };
}

function extractIndexUrl(message: string): string {
  const match = message.match(/https:\/\/console\.firebase\.google\.com\/[^\s"'`]+/);
  return match ? match[0] : "";
}

function extractDetails(e: unknown): string {
  if (!(e instanceof Error)) return "";
  const details = (e as { details?: unknown }).details;
  if (typeof details === "string" && details) return details;
  const code = (e as { code?: unknown }).code;
  if (typeof code === "string" && code && !/^\d+$/.test(code)) return code;
  return "";
}

/** Strip credentials that occasionally appear inside driver error text
    (e.g. a echoed connection string) before anything touches the logs. */
function sanitizeForLog(text: string): string {
  return text
    .replace(/(postgres(?:ql)?:\/\/)([^@\s/]+)@/gi, "$1***@")
    .replace(/(password\s*[=:]\s*)[^\s,;]+/gi, "$1***")
    .trim();
}

/**
 * Log the real underlying cause with everything that makes it diagnosable:
 * route context, failing model.operation (tagged by the data layer), gRPC
 * code + name, Firestore index-creation link, and the sanitized message.
 */
export function logDbError(e: unknown, context: string): void {
  const message = e instanceof Error ? e.message : String(e);
  const { code, name } = extractGrpcCode(message);
  const indexUrl = extractIndexUrl(message);
  const details = extractDetails(e);
  const op =
    e instanceof Error && "dbContext" in e && typeof (e as { dbContext?: unknown }).dbContext === "string"
      ? (e as { dbContext: string }).dbContext
      : "";

  const parts: string[] = [];
  if (code) parts.push(`code=${code}`);
  if (name) parts.push(`(${name})`);
  if (indexUrl) parts.push(`index=${indexUrl}`);
  if (details) parts.push(`details="${details}"`);

  console.error(
    `[db:${context}${op ? ` ${op}` : ""}] ${parts.length ? parts.join(" ") + " " : ""}${sanitizeForLog(message)}`
  );
}