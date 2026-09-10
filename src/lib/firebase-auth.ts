import "server-only";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseApp } from "@/lib/firebase";
import { db } from "@/lib/db";

/* ═══════════════════════════════════════════════════════════════════════════
   Firebase Authentication — server-side credential verification.

   All identity now lives in Firebase Auth (never in our Firestore):
     - sign-in  → Identity Toolkit REST (accounts:signInWithPassword) with the
                  public web API key; Firebase validates the credentials.
     - sign-up  → Admin SDK createUser; Firebase stores the password securely.
     - Google   → the Google id_token is exchanged through signInWithIdp so the
                  Google identity is minted into Firebase Auth.
     - reset    → Admin SDK generatePasswordResetLink.

   Legacy accounts (created before this migration, stored with a plaintext
   passwordHash) are verified locally once and automatically migrated into
   Firebase on their next successful sign-in — the plaintext is then removed.
   ═══════════════════════════════════════════════════════════════════════════ */

const IDENTITY_TOOLKIT = "https://identitytoolkit.googleapis.com/v1";

/** Typed auth failure. `code` is a stable, normalized token (e.g. INVALID_PASSWORD,
    EMAIL_EXISTS, TOO_MANY_ATTEMPTS_TRY_LATER) that routes can switch on. */
export class FirebaseAuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "FirebaseAuthError";
    this.code = code;
  }
}

function webApiKey(): string {
  // Render and other hosts sometimes expose the Firebase web key under the
  // conventional FIREBASE_API_KEY/NEXT_PUBLIC_FIREBASE_API_KEY name. Accept
  // those aliases as a compatibility fallback, while keeping the documented
  // server-side name first. The key is a Firebase web identifier, not a secret.
  const key = [
    process.env.FIREBASE_WEB_API_KEY,
    process.env.FIREBASE_API_KEY,
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  ]
    .map((value) => value?.trim())
    .find(Boolean);
  if (!key) {
    throw new FirebaseAuthError(
      "MISSING_CONFIG",
      "Firebase sign-in is not configured (set FIREBASE_WEB_API_KEY on the deployment)."
    );
  }
  return key;
}

/** Normalize Admin-SDK codes (auth/email-already-exists) and Identity Toolkit
    REST codes (EMAIL_EXISTS) to one stable token. */
function normalizeCode(raw: string): string {
  const adminMap: Record<string, string> = {
    "auth/email-already-exists": "EMAIL_EXISTS",
    "auth/user-not-found": "EMAIL_NOT_FOUND",
    "auth/wrong-password": "INVALID_PASSWORD",
    "auth/invalid-password": "INVALID_PASSWORD",
    "auth/invalid-email": "INVALID_EMAIL",
    "auth/user-disabled": "USER_DISABLED",
    "auth/too-many-requests": "TOO_MANY_ATTEMPTS_TRY_LATER",
    "auth/operation-not-allowed": "OPERATION_NOT_ALLOWED",
    "auth/weak-password": "WEAK_PASSWORD",
    "auth/id-token-expired": "INVALID_ID_TOKEN",
    "auth/invalid-id-token": "INVALID_ID_TOKEN",
    "auth/argument-error": "INVALID_ARGUMENT",
  };
  if (adminMap[raw]) return adminMap[raw];
  return raw.replace(/^auth\//, "").replace(/-/g, "_").toUpperCase();
}

/** Call an Identity Toolkit endpoint. Throws FirebaseAuthError on failure. */
async function idToolkit(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const attempt = async () => {
    const res = await fetch(`${IDENTITY_TOOLKIT}/${endpoint}?key=${webApiKey()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true, ...payload }),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !body) {
      const raw = (body?.error as { message?: string } | undefined)?.message ?? "UNKNOWN";
      throw new FirebaseAuthError(normalizeCode(raw), raw);
    }
    return body;
  };
  try {
    return await attempt();
  } catch (e) {
    // First request right after boot can hit a connect timeout on slow links
    // (undici UND_ERR_CONNECT_TIMEOUT). One retry makes cold-start sign-ins
    // reliable; FirebaseAuthError responses (wrong password etc.) are never
    // retried because they are authoritative API answers, not transport faults.
    const cause = (e as { cause?: { code?: string } }).cause;
    const retryable =
      cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
      cause?.code === "ECONNRESET" ||
      cause?.code === "ETIMEDOUT" ||
      cause?.code === "ENOTFOUND";
    if (retryable) {
      await new Promise((r) => setTimeout(r, 1500));
      return attempt();
    }
    throw e;
  }
}

export type VerifiedIdentity = {
  uid: string;
  email: string;
  emailVerified: boolean;
};

/** Verify email + password against Firebase Auth. Throws FirebaseAuthError. */
export async function signInWithPassword(
  email: string,
  password: string
): Promise<VerifiedIdentity> {
  const body = await idToolkit("accounts:signInWithPassword", { email, password });
  const uid = typeof body.localId === "string" ? body.localId : "";
  if (!uid) throw new FirebaseAuthError("UNKNOWN", "Firebase did not return a user id.");
  // The sign-in REST response does NOT include the verified flag, so read the
  // authoritative status from the Admin SDK instead (one extra call per login).
  let emailVerified = false;
  try {
    const record = await getAuth(getFirebaseApp()).getUser(uid);
    emailVerified = record.emailVerified === true;
  } catch {
    emailVerified = body.emailVerified === true;
  }
  return {
    uid,
    email: typeof body.email === "string" ? body.email.toLowerCase() : email,
    emailVerified,
  };
}

/** Create a Firebase Auth user (password stored securely by Firebase). */
export async function createFirebaseUser(
  email: string,
  password: string
): Promise<{ uid: string }> {
  try {
    const record = await getAuth(getFirebaseApp()).createUser({ email, password });
    return { uid: record.uid };
  } catch (e) {
    if (e instanceof Error) {
      const code = normalizeCode(String((e as { code?: unknown }).code ?? ""));
      if (code !== "UNKNOWN") throw new FirebaseAuthError(code, e.message);
    }
    throw e;
  }
}

/** Mint (or return) the Firebase Auth account behind a Google id_token. */
export async function signInWithGoogleIdToken(
  googleIdToken: string
): Promise<VerifiedIdentity & { isNewUser: boolean }> {
  const body = await idToolkit("accounts:signInWithIdp", {
    postBody: `providerId=google.com&id_token=${encodeURIComponent(googleIdToken)}`,
    requestUri: "http://localhost",
    returnIdpCredential: false,
  });
  const uid = typeof body.localId === "string" ? body.localId : "";
  if (!uid) throw new FirebaseAuthError("UNKNOWN", "Firebase did not return a user id.");
  return {
    uid,
    email: typeof body.email === "string" ? body.email.toLowerCase() : "",
    emailVerified: body.emailVerified === true,
    isNewUser: body.isNewUser === true,
  };
}

/** Firebase-managed password reset link (the app emails it in its own template). */
export async function generatePasswordResetLink(
  email: string,
  continueUrl: string
): Promise<string> {
  try {
    return await getAuth(getFirebaseApp()).generatePasswordResetLink(email, { url: continueUrl });
  } catch (e) {
    throw linkError(e, continueUrl);
  }
}

/** Firebase-managed email verification link (the app emails it in its own template). */
export async function generateEmailVerificationLink(
  email: string,
  continueUrl: string
): Promise<string> {
  try {
    return await getAuth(getFirebaseApp()).generateEmailVerificationLink(email, { url: continueUrl });
  } catch (e) {
    throw linkError(e, continueUrl);
  }
}

/** Map Firebase link-generation failures (almost always an unauthorized
    continue URI) to a stable, actionable code instead of a raw Admin SDK error. */
function linkError(e: unknown, continueUrl: string): FirebaseAuthError {
  if (e instanceof Error) {
    const code = String((e as { code?: unknown }).code ?? "");
    if (code === "auth/unauthorized-continue-uri" || code === "auth/internal-error") {
      const host = (() => {
        try {
          return new URL(continueUrl).host;
        } catch {
          return continueUrl;
        }
      })();
      return new FirebaseAuthError(
        "UNAUTHORIZED_CONTINUE_URI",
        `"${host}" is not an authorized domain in Firebase Authentication — add it under Console → Authentication → Settings → Authorized domains.`
      );
    }
  }
  return new FirebaseAuthError(
    e instanceof Error && (e as { code?: unknown }).code
      ? String((e as unknown as { code: unknown }).code)
      : "UNKNOWN",
    e instanceof Error ? e.message : "Failed to generate the email link."
  );
}

/** Remove a Firebase Auth user (used to roll back failed registrations). */
export async function deleteFirebaseUser(uid: string): Promise<void> {
  await getAuth(getFirebaseApp()).deleteUser(uid);
}

/* ─── friendly messages ──────────────────────────────────────────────────── */

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_PASSWORD: "Incorrect email or password.",
  EMAIL_NOT_FOUND: "Incorrect email or password.",
  INVALID_EMAIL: "Enter a valid email address.",
  USER_DISABLED: "This account has been disabled. Contact your administrator.",
  TOO_MANY_ATTEMPTS_TRY_LATER:
    "Too many sign-in attempts. Please wait a moment and try again.",
  EMAIL_EXISTS: "An account with this email already exists.",
  WEAK_PASSWORD: "That password is too weak — choose a longer one.",
  OPERATION_NOT_ALLOWED:
    "Email/password sign-in is not enabled for this project — enable it in the Firebase console (Authentication → Sign-in method).",
  PROVIDER_DISABLED:
    "Google sign-in is not enabled for this project — enable it in the Firebase console (Authentication → Sign-in method).",
  MISSING_CONFIG: "Sign-in is not fully configured on this deployment.",
  UNAUTHORIZED_CONTINUE_URI:
    "The email link couldn't be created — add your app domain to Firebase Console → Authentication → Settings → Authorized domains.",
  RESET_REQUIRED:
    "This account's password needs to be reset before you can sign in — use the \"Forgot password\" link to continue.",
};

/** Safe, user-facing message for a Firebase auth failure. */
export function authErrorMessage(
  e: unknown,
  fallback = "Sign-in failed. Please try again."
): string {
  if (e instanceof FirebaseAuthError) {
    return AUTH_ERROR_MESSAGES[e.code] ?? fallback;
  }
  return fallback;
}

/* ─── shared verification + legacy migration ─────────────────────────────── */

/**
 * Verify credentials against Firebase Auth, transparently migrating legacy
 * plaintext accounts (pre-Firebase) on their next successful sign-in.
 *
 * Returns the Firebase uid. Throws FirebaseAuthError for credential failures
 * (callers pick the HTTP status from `code`); any other error (e.g. the
 * database being unreachable) propagates untouched so routes keep treating
 * it as a database failure.
 */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<{ uid: string; email: string; migrated: boolean; emailVerified: boolean }> {
  try {
    const identity = await signInWithPassword(email, password);
    return {
      uid: identity.uid,
      email: identity.email,
      migrated: false,
      emailVerified: identity.emailVerified,
    };
  } catch (e) {
    const code = e instanceof FirebaseAuthError ? e.code : "UNKNOWN";
    // Only "no such Firebase user" may fall back to the legacy check — any
    // other failure (wrong password, disabled account, rate limit) is
    // authoritative because a Firebase account owns that email.
    if (code !== "EMAIL_NOT_FOUND") throw e;

    // Legacy plaintext account? Verify locally, then migrate it into Firebase.
    const account = await db.userAccount.findUnique({ where: { email } });
    if (!account || !account.passwordHash || account.passwordHash !== password) throw e;

    let uid: string;
    try {
      uid = (await createFirebaseUser(email, password)).uid;
    } catch (migrateErr) {
      if (migrateErr instanceof FirebaseAuthError && migrateErr.code === "EMAIL_EXISTS") {
        // A Firebase account now owns this email with a different password —
        // the legacy password is no longer authoritative; a reset is needed.
        throw new FirebaseAuthError("RESET_REQUIRED", "Password reset required.");
      }
      throw migrateErr;
    }

    // Migration complete — the plaintext is removed from our database.
    await db.userAccount
      .update({ where: { email }, data: { firebaseUid: uid, passwordHash: null } })
      .catch(() => {});
    // A freshly migrated account is unverified until the owner clicks a
    // verification link.
    return { uid, email, migrated: true, emailVerified: false };
  }
}