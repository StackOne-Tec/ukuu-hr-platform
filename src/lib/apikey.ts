import "server-only";
import crypto from "node:crypto";
import { db } from "@/lib/db";

export const API_KEY_PREFIX = "ukuu_live_";
const KEY_BYTES = 24; // 48 hex chars after the prefix
const MASK_DOTS = 24;

/* Generate a new scoped API key: ukuu_live_<48 hex chars>. Only the sha256
   hash is ever persisted — the plaintext is returned once at creation and
   never stored. */
export function generateApiKey(): string {
  return API_KEY_PREFIX + crypto.randomBytes(KEY_BYTES).toString("hex");
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key, "utf8").digest("hex");
}

export function maskApiKey(key: string): string {
  return API_KEY_PREFIX + "•".repeat(MASK_DOTS);
}

export function lastFour(key: string): string {
  return key.slice(-4);
}

/* Default scope set (mirrors the Settings → API Keys card). */
export const DEFAULT_SCOPES =
  "employees:rw,attendance:rw,payroll:rw,leave:rw,devices:rw,full:rw";

export type ApiKeyRecord = {
  id: string;
  name: string;
  prefix: string;
  scopes: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  rotatedAt: Date | null;
};

export const scopeLabels: Record<string, string> = {
  employees: "Employees",
  attendance: "Attendance",
  payroll: "Payroll",
  leave: "LeaveManagement",
  devices: "DeviceManagement",
  full: "FullAccess",
};

export function scopesToLabels(scopes: string): string[] {
  return scopes
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => scopeLabels[s.split(":")[0]] ?? s.split(":")[0]);
}

/* Extract the API key from a request: Authorization: Bearer <key> or
   X-Api-Key: <key>. Returns null when absent. */
export function extractApiKey(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth && /^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, "").trim();
  const header = req.headers.get("x-api-key");
  if (header) return header.trim();
  return null;
}

/* Validate the key presented on a request. On success returns the resolved
   organization id + the key row; on failure returns null (callers decide the
   status code). Also records lastUsedAt so Settings can show usage. */
export async function authenticateApiKey(
  req: Request
): Promise<{ organizationId: string; key: ApiKeyRecord } | null> {
  const token = extractApiKey(req);
  if (!token) return null;
  const hash = hashApiKey(token);
  const row = await db.apiKey.findUnique({ where: { keyHash: hash } });
  if (!row || !row.isActive || !row.organizationId) return null;
  await db.apiKey
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return {
    organizationId: row.organizationId,
    key: {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      scopes: row.scopes,
      isActive: row.isActive,
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
      rotatedAt: row.rotatedAt,
    },
  };
}

/* Scope check used by v1 endpoints. A "full" scope or a matching
   "<resource>" scope grants access. */
export function scopeAllows(scopes: string, resource: string): boolean {
  const parts = scopes.split(",").map((s) => s.trim());
  return parts.some((s) => {
    const [name] = s.split(":");
    return name === "full" || name === resource;
  });
}

/* Friendly user-facing message for an unexpected API failure. Never leak raw
   Prisma/engine internals (stack traces with turbopack paths, connection
   errors, etc.) to callers. */
export function apiErrorMessage(e: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!(e instanceof Error)) return fallback;
  const m = e.message;
  if (/closed the connection|connect .*timed out|ECONNREFUSED|ECONNRESET|ETIMEDOUT|reachable|database/i.test(m)) {
    return "The database is temporarily unreachable. Please try again in a moment.";
  }
  if (/not found/i.test(m)) return "Record not found.";
  return fallback;
}