import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentOrg, requireVerifiedEmail } from "@/lib/session";
import { sendEmail, inviteEmailHtml } from "@/lib/email";
import { dbErrorMessage, logDbError } from "@/lib/db-error";
import {
  authErrorMessage,
  createFirebaseUser,
  deleteFirebaseUser,
  FirebaseAuthError,
} from "@/lib/firebase-auth";

export const dynamic = "force-dynamic";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const INVITE_ROLES = ["Admin", "Manager", "Employee"] as const;

/*
 * POST /api/settings/users
 * Invite a new member into the current workspace. Creates the account on the
 * same tenant the inviter is signed into. The temporary password is stored by
 * Firebase Auth (never in our database), a best-effort email carries it to the
 * invitee, and it is returned exactly once so the inviter can share it if the
 * email doesn't arrive.
 */
export async function POST(req: Request) {
  let org: Awaited<ReturnType<typeof currentOrg>>;
  try {
    org = await currentOrg();
  } catch (e) {
    logDbError(e, "settings.users.invite");
    return NextResponse.json({ ok: false, error: dbErrorMessage(e), dbDown: true }, { status: 503 });
  }
  if (!org) {
    return NextResponse.json({ ok: false, error: "Organization not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    email?: unknown;
    role?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body?.role === "string" ? body.role : "Employee";

  if (!name) {
    return NextResponse.json({ ok: false, error: "Enter the invitee's full name." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }
  if (!(INVITE_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json(
      { ok: false, error: "Choose a role: Admin, Manager or Employee." },
      { status: 400 }
    );
  }

  const gate = await requireVerifiedEmail();
  if (!gate.verified) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }

  try {
    const existing = await db.userAccount.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          error:
            existing.organizationId === org.id
              ? `${email} is already a member of this workspace.`
              : `${email} already has a Ukuu HR account.`,
        },
        { status: 400 }
      );
    }

    // Human-friendly temporary password. Firebase Auth stores it securely — we
    // keep only the Firebase uid; the plaintext is never written to our DB.
    const tempPassword = `Uk${crypto.randomBytes(5).toString("hex")}`;
    const fbUser = await createFirebaseUser(email, tempPassword);
    let created;
    try {
      created = await db.userAccount.create({
        data: {
          organizationId: org.id,
          name,
          email,
          role,
          firebaseUid: fbUser.uid,
        },
      });
    } catch (e) {
      // Roll back the Firebase user so a failed invite leaves no orphan identity.
      await deleteFirebaseUser(fbUser.uid).catch(() => {});
      throw e;
    }

    // Best-effort audit trail — never fails the invite.
    await db.auditLog
      .create({
        data: {
          organizationId: org.id,
          userName: "Administrator",
          action: "User.Invite",
          entityType: "UserAccount",
          entityId: created.id,
          details: `Invited ${email} as ${role}`,
        },
      })
      .catch(() => {});

    // Fire-and-forget, mirroring registration — the UI also shows the
    // temporary password once so an invitation never depends on email delivery.
    void sendEmail(
      email,
      `You're invited to ${org.name} 🎉`,
      inviteEmailHtml({ name, email, workspace: org.name, role, tempPassword })
    );

    return NextResponse.json({
      ok: true,
      user: { id: created.id, name, email, role, isActive: true, lastLoginAt: null },
      tempPassword,
    });
  } catch (e) {
    if (e instanceof FirebaseAuthError) {
      return NextResponse.json(
        { ok: false, error: authErrorMessage(e, "The invitation could not be created. Please try again.") },
        { status: e.code === "EMAIL_EXISTS" ? 400 : 503 }
      );
    }
    logDbError(e, "settings.users.invite");
    return NextResponse.json({ ok: false, error: dbErrorMessage(e), dbDown: true }, { status: 503 });
  }
}
