import "server-only";
import { db } from "@/lib/db";
import { getWebSession } from "@/lib/session";
import { IS_ADMIN_PLATFORM } from "@/lib/platform";
import { sendEmail, accessCodeRedeemedEmailHtml } from "@/lib/email";

/**
 * Subscription gating for the workspace console.
 *
 * A workspace (organization) is unlocked while it holds an active LicenseCode
 * (status "Active" and not expired). LicenseCodes are provisioned by redeeming
 * an access code — a Coupon issued from the admin portal — so the flow is:
 *
 *   admin portal issues Coupon (access code)  →  user redeems it on the
 *   activation screen  →  LicenseCode bound to their organization  →  access.
 *
 * Access codes are single-use: the first successful redemption atomically
 * marks the code as claimed, so it can never unlock a second workspace.
 *
 * Rules:
 *  - The admin portal itself is never gated (it issues the codes).
 *  - Anonymous browsing (no session) is not gated — a user must be signed in
 *    to "access their account".
 *  - If the database is unreachable we fail open so the app keeps degrading
 *    gracefully like every other query in the codebase.
 */

export type AccessStatus = {
  enforce: boolean;
  locked: boolean;
  plan: string | null;
  expiresAt: string | null;
  code: string | null;
};

const UNLOCKED: AccessStatus = { enforce: false, locked: false, plan: null, expiresAt: null, code: null };

export function isLicenseActive(license: { status: string; expiresAt: Date | null } | null): boolean {
  if (!license) return false;
  if (license.status !== "Active") return false;
  if (license.expiresAt && license.expiresAt.getTime() < Date.now()) return false;
  return true;
}

/** Current access status for the signed-in user's workspace. */
export async function getAccessStatus(): Promise<AccessStatus> {
  if (IS_ADMIN_PLATFORM) return UNLOCKED;
  try {
    const session = await getWebSession();
    if (!session?.organizationId) return UNLOCKED;
    const license = await db.licenseCode.findFirst({ where: { organizationId: session.organizationId } });
    const active = isLicenseActive(license);
    return {
      enforce: true,
      locked: !active,
      plan: license?.plan ?? null,
      expiresAt: license?.expiresAt ? license.expiresAt.toISOString() : null,
      code: license?.code ?? null,
    };
  } catch {
    return UNLOCKED;
  }
}

export type RedeemResult = {
  ok: boolean;
  error?: string;
  plan?: string;
  expiresAt?: string | null;
};

/** Validate an access code against the Coupon table and bind a license to the org. */
export async function redeemAccessCode(rawCode: string): Promise<RedeemResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter your access code." };

  const session = await getWebSession();
  if (!session?.organizationId) {
    return { ok: false, error: "Please sign in to activate your workspace." };
  }

  try {
    const coupon = await db.coupon.findUnique({ where: { code } });
    if (!coupon) {
      return { ok: false, error: "That access code isn't valid. Double-check it and try again." };
    }
    if (coupon.status !== "Active") {
      return { ok: false, error: "This access code has been disabled." };
    }
    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
      return { ok: false, error: "This access code has expired. Ask your administrator for a current one." };
    }
    if (coupon.redeemedAt) {
      return { ok: false, error: "This access code has already been used." };
    }

    const plan = coupon.plan ?? "Professional";
    const now = new Date();
    const org = await db.organization.findUnique({ where: { id: session.organizationId } });

    /* Single-use: claim the code atomically (only succeeds if it is still
       unredeemed) so two workspaces redeeming the same code at the same time
       can't both succeed. */
    const claim = await db.coupon.updateMany({
      where: { id: coupon.id, redeemedAt: null },
      data: {
        redeemedAt: now,
        redeemedByOrgId: session.organizationId,
        redeemedByOrgName: org?.name ?? "Unknown workspace",
      },
    });
    if (claim.count === 0) {
      return { ok: false, error: "This access code has already been used." };
    }

    const existing = await db.licenseCode.findFirst({ where: { organizationId: session.organizationId } });
    if (existing) {
      // Renewal — a new code replaces (and extends) the current license.
      await db.licenseCode.update({
        where: { id: existing.id },
        data: { code, plan, status: "Active", activatedAt: now, expiresAt: coupon.expiresAt },
      });
    } else {
      await db.licenseCode.create({
        data: {
          organizationId: session.organizationId,
          code,
          plan,
          status: "Active",
          issuedAt: now,
          activatedAt: now,
          expiresAt: coupon.expiresAt,
        },
      });
    }

    // Notify the platform admin (fire-and-forget — never fail a redemption
    // because email delivery failed). Configured via ADMIN_NOTIFY_EMAIL.
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
    if (adminEmail) {
      void sendEmail(
        adminEmail,
        `Access code ${code} redeemed by ${org?.name ?? "a workspace"}`,
        accessCodeRedeemedEmailHtml({
          code,
          orgName: org?.name ?? "Unknown workspace",
          plan,
          expiresAt: coupon.expiresAt,
          redeemedAt: now,
        })
      );
    }

    return { ok: true, plan, expiresAt: coupon.expiresAt ? coupon.expiresAt.toISOString() : null };
  } catch {
    return { ok: false, error: "We couldn't activate your workspace right now. Please try again in a moment." };
  }
}