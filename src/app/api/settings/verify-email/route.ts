import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWebSession } from "@/lib/session";
import { authErrorMessage, FirebaseAuthError, generateEmailVerificationLink } from "@/lib/firebase-auth";
import { sendEmail, verifyEmailHtml } from "@/lib/email";
import { dbErrorMessage, logDbError } from "@/lib/db-error";

export const dynamic = "force-dynamic";

/*
 * POST /api/settings/verify-email
 * (Re)send the Firebase email-verification link to the signed-in user's inbox.
 * The link itself is minted by Firebase Auth; the app delivers it in its own
 * branded email so the sender stays consistent with the rest of the product.
 */
export async function POST(req: Request) {
  const session = await getWebSession();
  if (!session?.userId) {
    return NextResponse.json({ ok: false, error: "Sign in to continue." }, { status: 401 });
  }
  try {
    const user = await db.userAccount.findUnique({ where: { id: session.userId } });
    if (!user) {
      return NextResponse.json({ ok: false, error: "Your account could not be found." }, { status: 404 });
    }
    if (user.emailVerified === true) {
      return NextResponse.json({ ok: true, message: "Your email is already verified." });
    }
    if (!user.firebaseUid) {
      // Legacy account (pre-Firebase) that hasn't been migrated yet — Firebase
      // can't mint a verification link for an email it doesn't own. One more
      // sign-in migrates it (see verifyCredentials), then resending works.
      return NextResponse.json(
        {
          ok: false,
          error:
            "Sign in once more to link your account to Firebase, then resend the verification email.",
        },
        { status: 400 }
      );
    }
    const origin = new URL(req.url).origin;
    const verifyUrl = await generateEmailVerificationLink(user.email, `${origin}/dashboard`);
    const result = await sendEmail(
      user.email,
      "Verify your Ukuu HR email",
      verifyEmailHtml(user.name ?? "", verifyUrl)
    );
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "The verification email could not be sent." },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, message: "Verification email sent — check your inbox." });
  } catch (e) {
    if (e instanceof FirebaseAuthError) {
      return NextResponse.json(
        { ok: false, error: authErrorMessage(e, "The verification email could not be sent. Please try again.") },
        { status: 503 }
      );
    }
    logDbError(e, "settings.verifyEmail");
    return NextResponse.json(
      { ok: false, error: dbErrorMessage(e, "The verification email could not be sent. Please try again.") },
      { status: 503 }
    );
  }
}