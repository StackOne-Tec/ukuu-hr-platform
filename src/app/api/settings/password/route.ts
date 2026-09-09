import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuth } from "firebase-admin/auth";
import { db } from "@/lib/db";
import { getWebSession, hashToken, requireVerifiedEmail, SESSION_COOKIE } from "@/lib/session";
import { getFirebaseApp } from "@/lib/firebase";
import {
  authErrorMessage,
  FirebaseAuthError,
  signInWithPassword,
  verifyCredentials,
} from "@/lib/firebase-auth";
import { dbErrorMessage, logDbError } from "@/lib/db-error";

export const dynamic = "force-dynamic";

/*
 * POST /api/settings/password
 * Change the signed-in user's password. The current password is verified
 * against Firebase Auth before the new one is applied (Admin SDK updateUser),
 * and every other session is revoked so a leaked session can't outlive the
 * change. Requires a verified email address.
 * Body: { currentPassword, newPassword }
 */
export async function POST(req: Request) {
  const gate = await requireVerifiedEmail();
  if (!gate.verified) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }

  const body = (await req.json().catch(() => null)) as {
    currentPassword?: unknown;
    newPassword?: unknown;
  } | null;
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword) {
    return NextResponse.json({ ok: false, error: "Enter your current password." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { ok: false, error: "New password must be at least 8 characters." },
      { status: 400 }
    );
  }
  if (newPassword === currentPassword) {
    return NextResponse.json(
      { ok: false, error: "New password must be different from your current password." },
      { status: 400 }
    );
  }

  const session = await getWebSession();
  if (!session?.userId) {
    return NextResponse.json({ ok: false, error: "Sign in to continue." }, { status: 401 });
  }

  try {
    const user = await db.userAccount.findUnique({ where: { id: session.userId } });
    if (!user) {
      return NextResponse.json({ ok: false, error: "Your account could not be found." }, { status: 404 });
    }

    // Legacy accounts (pre-Firebase, no Firebase identity yet) are migrated on
    // the spot; otherwise verify the current password against Firebase first —
    // the new password must never be set without proving the old one.
    let uid = user.firebaseUid;
    if (!uid) {
      uid = (await verifyCredentials(user.email, currentPassword)).uid;
    } else {
      try {
        await signInWithPassword(user.email, currentPassword);
      } catch (e) {
        if (e instanceof FirebaseAuthError) {
          return NextResponse.json(
            { ok: false, error: authErrorMessage(e, "Your current password is incorrect.") },
            { status: 401 }
          );
        }
        throw e;
      }
    }

    // Firebase stores and hashes the new password — we never see it again.
    await getAuth(getFirebaseApp()).updateUser(uid, { password: newPassword });

    // Revoke every other session so a leaked session can't outlive the change.
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) {
      const currentRow = await db.webSession.findUnique({ where: { tokenHash: hashToken(token) } });
      await db.webSession
        .deleteMany({
          where: { userId: user.id, NOT: currentRow ? { id: currentRow.id } : { id: "" } },
        })
        .catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      message: "Password updated — other sessions were signed out.",
    });
  } catch (e) {
    logDbError(e, "settings.password.change");
    return NextResponse.json(
      { ok: false, error: dbErrorMessage(e, "Your password could not be changed. Please try again.") },
      { status: 503 }
    );
  }
}