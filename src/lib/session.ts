import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { ensureDemoOrg } from "@/lib/org";

/**
 * Server-side web sessions for the console app. Every signed-in user gets an
 * httpOnly cookie (ukuu_session) whose value is a random token; only its
 * sha256 hash is persisted (mirrors BridgeSession). The organization attached
 * to the session is the tenant all queries and mutations are scoped to, which
 * is what makes company data isolation possible.
 */

export const SESSION_COOKIE = "ukuu_session";
export const SESSION_DAYS = 30;

function generateToken(): string {
  return `ukuu_ws_${crypto.randomBytes(24).toString("hex")}`;
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

/* Create a session row and return the plaintext token (persisted only as a hash). */
export async function createWebSession(opts: {
  userId: string;
  organizationId: string;
  remember: boolean;
}): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.webSession.create({
    data: {
      tokenHash: hashToken(token),
      userId: opts.userId,
      organizationId: opts.organizationId,
      expiresAt: opts.remember ? expiresAt : new Date(Date.now() + 12 * 3600000),
    },
  });
  return token;
}

export type WebSessionCtx = {
  userId: string | null;
  organizationId: string | null;
};

/* Resolve the current session from the request cookie. Returns null when
   absent or expired. */
export async function getWebSession(): Promise<WebSessionCtx | null> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const row = await db.webSession.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || (row.expiresAt && row.expiresAt.getTime() < Date.now())) return null;
    await db.webSession
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
    return { userId: row.userId ?? null, organizationId: row.organizationId ?? null };
  } catch {
    return null;
  }
}

/* Delete the current session row (called at sign-out). */
export async function destroyWebSession(): Promise<void> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) await db.webSession.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => {});
    store.delete(SESSION_COOKIE);
  } catch {
    /* cookie store unavailable — nothing to do */
  }
}

export type CurrentOrg = {
  id: string;
  name: string;
  slug: string | null;
  email: string | null;
  country: string;
  currency: string;
  plan: string;
} | null;

/**
 * The tenant for the current request. Uses the signed-in user's organization
 * when a session exists, otherwise falls back to the demo organization (the
 * shared demo tenant) so anonymous/demo access keeps working. This is the
 * single source of truth for org scoping in queries and route handlers.
 */
export async function currentOrg(): Promise<CurrentOrg> {
  try {
    const session = await getWebSession();
    if (session?.organizationId) {
      const org = await db.organization.findUnique({ where: { id: session.organizationId } });
      if (org) return pickOrg(org);
    }
    const demo = await ensureDemoOrg();
    if (demo) return pickOrg(demo);
    return null;
  } catch {
    return null;
  }
}

function pickOrg(org: {
  id: string;
  name: string;
  slug: string | null;
  email: string | null;
  country: string;
  currency: string;
  plan: string;
}): CurrentOrg {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    email: org.email,
    country: org.country,
    currency: org.currency,
    plan: org.plan,
  };
}