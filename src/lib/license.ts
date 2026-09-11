import "server-only";
import { db, newId } from "@/lib/db";
import { firebaseConfigured } from "@/lib/firebase";
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

/** Starter access code auto-provisioned on deployments without Firebase
    (where no admin portal exists to issue codes). Override with
    UKUU_STARTER_ACCESS_CODE. No-op when Firestore is configured. */
const STARTER_ACCESS_CODE = (process.env.UKUU_STARTER_ACCESS_CODE ?? "UKUU-DEMO-2026").toUpperCase();

async function ensureStarterCoupon(): Promise<void> {
  if (firebaseConfigured()) return;
  try {
    await db.coupon.upsert({
      where: { code: STARTER_ACCESS_CODE },
      update: {},
      create: {
        code: STARTER_ACCESS_CODE,
        status: "Active",
        plan: "Professional",
        note: "Starter access code auto-provisioned on this deployment",
      },
    });
  } catch {
    // Seeding is best-effort — redemption reports its own errors.
  }
}

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
    await ensureStarterCoupon();
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
    await ensureStarterCoupon();
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
    const existing = await db.licenseCode.findFirst({ where: { organizationId: session.organizationId } });

    /* Single-use, all-or-nothing: claim the code AND bind the license inside
       one Firestore transaction. The coupon doc is read then marked redeemed
       atomically — two workspaces redeeming the same code concurrently can't
       both succeed. If the license write fails for any reason the whole
       transaction aborts, so a code is never burned without an unlock. */
    const claimed = await db.$transaction(async (tx) => {
      /* Firestore transactions require every read before the first write, so
         fetch the coupon AND the existing license up front (the license read
         also gives it conflict protection against concurrent renewals). */
      const [doc, license] = await Promise.all([
        tx.getDoc("coupon", coupon.id),
        existing ? tx.getDoc("licenseCode", existing.id) : Promise.resolve(null),
      ]);
      if (!doc.exists || doc.data.redeemedAt) return false;
      await tx.updateDoc("coupon", coupon.id, {
        redeemedAt: now,
        redeemedByOrgId: session.organizationId,
        redeemedByOrgName: org?.name ?? "Unknown workspace",
      });
      if (license?.exists) {
        // Renewal — a new code replaces (and extends) the current license.
        await tx.updateDoc("licenseCode", existing!.id, {
          code,
          plan,
          status: "Active",
          activatedAt: now,
          expiresAt: coupon.expiresAt,
        });
      } else {
        await tx.createDoc("licenseCode", newId(), {
          organizationId: session.organizationId,
          code,
          plan,
          status: "Active",
          issuedAt: now,
          activatedAt: now,
          expiresAt: coupon.expiresAt,
        });
      }
      return true;
    });
    if (!claimed) {
      return { ok: false, error: "This access code has already been used." };
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