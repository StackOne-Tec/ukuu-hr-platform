import "server-only";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { extractApiKey } from "@/lib/apikey";

/* Cloud-side support for the Bridge desktop app (the LAN↔cloud attendance
   sync client). Flow from the product whiteboard:

     1. Sign in with the cloud account details (email + password).
     2. The cloud checks the account and whether the subscription is valid.
     3. The desktop dashboard can then register devices and list the ones
        that are already added.

   Sessions are opaque `ukuu_br_<64 hex>` tokens; only their sha256 hash is
   stored (mirrors the ApiKey module). */

export const BRIDGE_TOKEN_PREFIX = "ukuu_br_";
const SESSION_BYTES = 32; // 64 hex chars after the prefix
export const BRIDGE_SESSION_DAYS = 30;

export type BridgeSessionCtx = {
  sessionId: string;
  organizationId: string;
  userId: string | null;
};

export function generateBridgeToken(): string {
  return BRIDGE_TOKEN_PREFIX + crypto.randomBytes(SESSION_BYTES).toString("hex");
}

export function hashBridgeToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

/* Seed accounts store the plaintext password ("demo") — mock auth, matching
   the rest of the platform. Swap in a real (salted, e.g. bcrypt) check when a
   real identity provider lands. */
export function verifyPassword(provided: string, stored: string | null | undefined): boolean {
  if (!stored || !provided) return false;
  return provided === stored;
}

/* ───────────────────────── subscription ───────────────────────── */

export type SubscriptionInfo = {
  plan: string;
  status: string; // Active | Trial | Expired | Revoked | Inactive
  valid: boolean;
  expiresAt: string | null;
  reason: string | null;
};

type OrgLike = { plan: string | null; trialEndsAt: Date | null };
type LicenseLike = { plan: string | null; status: string | null; expiresAt: Date | null } | null;

/* A license code (when present) is authoritative: it must be Active and not
   expired. Without one, the org plan governs — anything but an ended Trial is
   valid. */
export function subscriptionInfo(org: OrgLike, license: LicenseLike): SubscriptionInfo {
  if (license) {
    const plan = license.plan || org.plan || "Trial";
    const expired = license.expiresAt ? license.expiresAt.getTime() <= Date.now() : false;
    const active = (license.status ?? "Active") === "Active";
    const valid = active && !expired;
    return {
      plan,
      status: valid ? "Active" : active ? "Expired" : license.status || "Inactive",
      valid,
      expiresAt: license.expiresAt ? license.expiresAt.toISOString() : null,
      reason: valid
        ? null
        : active
          ? "Your subscription has expired — renew it to keep the desktop app connected."
          : "Your license is not active — contact your administrator.",
    };
  }
  const plan = org.plan || "Trial";
  const ended = org.trialEndsAt ? org.trialEndsAt.getTime() <= Date.now() : false;
  const valid = plan !== "Trial" || !org.trialEndsAt || !ended;
  return {
    plan,
    status: plan === "Trial" ? (valid ? "Trial" : "Expired") : "Active",
    valid,
    expiresAt: org.trialEndsAt ? org.trialEndsAt.toISOString() : null,
    reason: valid ? null : "Your free trial has ended — choose a plan to continue using the desktop app.",
  };
}

/* ───────────────────────── device quota ───────────────────────── */

/* The Bridge does NOT cap how many attendance devices a workspace may
   register — the per-plan device limitation was removed so workspaces can add
   as many devices as they need. deviceQuota still returns unlimited metadata
   so existing callers (device list, account summary) keep working. */
export function deviceLimitForPlan(_plan: string): number | null {
  return null; // unlimited
}

export type DeviceQuota = {
  plan: string;
  maxDevices: number | null; // null = unlimited
  usedDevices: number;
  remainingDevices: number | null; // null = unlimited
  canAddMore: boolean;
  message: string;
};

export function deviceQuota(plan: string, used: number): DeviceQuota {
  return {
    plan,
    maxDevices: null,
    usedDevices: used,
    remainingDevices: null,
    canAddMore: true,
    message: `${plan} plan — no device limit: register as many devices as you need.`,
  };
}

/* Resolve an organization + its subscription in one defensive pass. Returns
   null when the org is gone. Throws only on DB failures (callers map to 503). */
export async function loadSubscription(organizationId: string): Promise<{
  org: { id: string; name: string; slug: string | null; plan: string | null; trialEndsAt: Date | null };
  subscription: SubscriptionInfo;
} | null> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true, plan: true, trialEndsAt: true },
  });
  if (!org) return null;
  const license = await db.licenseCode.findFirst({ where: { organizationId: org.id } });
  return { org, subscription: subscriptionInfo(org, license) };
}

/* ───────────────────────── session auth ───────────────────────── */

/* Authenticate a Bridge session token from a request (Bearer or X-Api-Key).
   Returns the resolved session context, or null when the token is missing,
   unknown, or expired (expired sessions are cleaned up). */
export async function authenticateBridge(req: Request): Promise<BridgeSessionCtx | null> {
  const token = extractApiKey(req);
  if (!token || !token.startsWith(BRIDGE_TOKEN_PREFIX)) return null;
  const row = await db.bridgeSession.findUnique({ where: { tokenHash: hashBridgeToken(token) } });
  if (!row || !row.organizationId) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    await db.bridgeSession.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }
  await db.bridgeSession
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return { sessionId: row.id, organizationId: row.organizationId, userId: row.userId };
}

/* ───────────────────────── device shape ───────────────────────── */

type DeviceRow = {
  id: string;
  name: string;
  vendor: string;
  model: string | null;
  ipAddress: string | null;
  port: number;
  integrationMode: string;
  status: string;
  isActive: boolean;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: Date | null;
  lastError: string | null;
  createdAt: Date;
};

export function serializeDevice(d: DeviceRow) {
  return {
    id: d.id,
    name: d.name,
    vendor: d.vendor,
    model: d.model,
    ipAddress: d.ipAddress,
    port: d.port,
    integrationMode: d.integrationMode,
    status: d.status,
    isActive: d.isActive,
    autoSyncEnabled: d.autoSyncEnabled,
    syncIntervalMinutes: d.syncIntervalMinutes,
    lastSyncAt: d.lastSyncAt ? d.lastSyncAt.toISOString() : null,
    lastError: d.lastError,
    registeredAt: d.createdAt.toISOString(),
  };
}
