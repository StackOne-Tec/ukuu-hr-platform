import "server-only";
import { getAuth } from "firebase-admin/auth";
import {
  getFirebaseApp,
  firebaseConfigured,
  firebaseAuthConfigured,
} from "@/lib/firebase";
import { db } from "@/lib/db";
import {
  localCredentialGet,
  localCredentialUpsert,
  localCredentialDeleteByUid,
  hashPassword,
  verifyPassword,
} from "@/lib/local-store";

/* ═══════════════════════════════════════════════════════════════════════════
   Firebase Authentication — server-side credential verification.

   All identity now lives in Firebase Auth (never in our Firestore). The
   module has three capability tiers, chosen automatically per deployment:

     1. Admin SDK   — FIREBASE_SERVICE_ACCOUNT configured. Full capabilities
                      (createUser, password reset links, verification links,
                      user deletion, password updates).
     2. Web key     — only the public web API key (FIREBASE_WEB_API_KEY or an
                      alias). Everything still runs against the REAL Firebase
                      project through Google's Identity Toolkit REST API:
                        - sign-in  → accounts:signInWithPassword
                        - sign-up  → accounts:signUp
                        - Google   → accounts:signInWithIdp
                        - reset    → accounts:sendOobCode (PASSWORD_RESET)
                        - verify   → accounts:sendOobCode (VERIFY_EMAIL,
                                     needs the user's idToken from sign-up)
                        - delete   → accounts:update { delete: true }
                        - profile  → accounts:lookup (emailVerified)
                      The web key is a public identifier, not a secret.
     3. Local       — neither configured: scrypt-hashed credentials in the
                      local file-backed store (same error contract).

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

/** Verify email + password against Firebase Auth. Throws FirebaseAuthError.
    Without any Firebase configuration, verifies against the local credential
    store (scrypt hashes) instead — same error contract. */
export async function signInWithPassword(
  email: string,
  password: string
): Promise<VerifiedIdentity> {
  if (!firebaseAuthConfigured()) {
    const cred = await localCredentialGet(email);
    if (!cred) throw new FirebaseAuthError("EMAIL_NOT_FOUND", "EMAIL_NOT_FOUND");
    if (!verifyPassword(password, cred.passwordHash)) {
      throw new FirebaseAuthError("INVALID_PASSWORD", "INVALID_PASSWORD");
    }
    return { uid: cred.uid, email: cred.email, emailVerified: cred.emailVerified === true };
  }
  const body = await idToolkit("accounts:signInWithPassword", { email, password });
  const uid = typeof body.localId === "string" ? body.localId : "";
  if (!uid) throw new FirebaseAuthError("UNKNOWN", "Firebase did not return a user id.");
  // The sign-in REST response does NOT include the verified flag, so read the
  // authoritative status: Admin SDK when available, otherwise one extra
  // accounts:lookup call keyed by the idToken the sign-in just returned.
  let emailVerified = false;
  if (firebaseConfigured()) {
    try {
      const record = await getAuth(getFirebaseApp()).getUser(uid);
      emailVerified = record.emailVerified === true;
    } catch {
      emailVerified = body.emailVerified === true;
    }
  } else if (typeof body.idToken === "string" && body.idToken) {
    try {
      const lookup = await idToolkit("accounts:lookup", { idToken: body.idToken });
      const users = lookup.users as Array<{ emailVerified?: boolean }> | undefined;
      emailVerified = users?.[0]?.emailVerified === true;
    } catch {
      emailVerified = body.emailVerified === true;
    }
  }
  return {
    uid,
    email: typeof body.email === "string" ? body.email.toLowerCase() : email,
    emailVerified,
  };
}

/** Create a Firebase Auth user (password stored securely by Firebase).
    Web-key deployments use the Identity Toolkit signUp endpoint — the returned
    idToken lets callers roll the user back and send a verification email
    without any Admin SDK. Locally: store a scrypt hash in the local store. */
export async function createFirebaseUser(
  email: string,
  password: string
): Promise<{ uid: string; idToken?: string }> {
  if (!firebaseAuthConfigured()) {
    const existing = await localCredentialGet(email);
    if (existing) throw new FirebaseAuthError("EMAIL_EXISTS", "EMAIL_EXISTS");
    const cred = await localCredentialUpsert(email, hashPassword(password));
    return { uid: cred.uid };
  }
  if (!firebaseConfigured()) {
    const body = await idToolkit("accounts:signUp", { email, password });
    const uid = typeof body.localId === "string" ? body.localId : "";
    if (!uid) throw new FirebaseAuthError("UNKNOWN", "Firebase did not return a user id.");
    return {
      uid,
      idToken: typeof body.idToken === "string" ? body.idToken : undefined,
    };
  }
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

/** Mint (or return) the Firebase Auth account behind a Google id_token.
    Google OAuth needs a real Firebase project — never available locally. */
export async function signInWithGoogleIdToken(
  googleIdToken: string
): Promise<VerifiedIdentity & { isNewUser: boolean }> {
  if (!firebaseAuthConfigured()) {
    throw new FirebaseAuthError("PROVIDER_DISABLED", "PROVIDER_DISABLED");
  }
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

/** Firebase-managed password reset link (the app emails it in its own
    template). Web-key deployments: try to get the raw oob link; if the project
    disallows returning links, Firebase emails its own reset message instead —
    the returned empty string tells callers to skip their own delivery. */
export async function generatePasswordResetLink(
  email: string,
  continueUrl: string
): Promise<string> {
  if (!firebaseAuthConfigured()) {
    throw new FirebaseAuthError("LOCAL_MODE_EMAIL", "LOCAL_MODE_EMAIL");
  }
  if (!firebaseConfigured()) {
    try {
      const body = await idToolkit("accounts:sendOobCode", {
        requestType: "PASSWORD_RESET",
        email,
        continueUrl,
        returnOobLink: true,
      });
      return typeof body.oobLink === "string" ? body.oobLink : "";
    } catch (e) {
      if (e instanceof FirebaseAuthError && e.code === "EMAIL_NOT_FOUND") throw e;
      // returnOobLink can be disallowed for unauthenticated callers — fall
      // back to letting Firebase send its own password-reset email.
      try {
        await idToolkit("accounts:sendOobCode", {
          requestType: "PASSWORD_RESET",
          email,
          continueUrl,
        });
        return "";
      } catch (e2) {
        if (e2 instanceof FirebaseAuthError) throw e2;
        throw e;
      }
    }
  }
  try {
    return await getAuth(getFirebaseApp()).generatePasswordResetLink(email, { url: continueUrl });
  } catch (e) {
    throw linkError(e, continueUrl);
  }
}

/** Firebase-managed email verification link (the app emails it in its own
    template). Web-key deployments need the user's idToken (as returned by
    accounts:signUp) — VERIFY_EMAIL cannot be minted for arbitrary users
    without the Admin SDK. An empty string means Firebase already emailed the
    user with its own template. */
export async function generateEmailVerificationLink(
  email: string,
  continueUrl: string,
  idToken?: string
): Promise<string> {
  if (!firebaseAuthConfigured()) {
    throw new FirebaseAuthError("LOCAL_MODE_EMAIL", "LOCAL_MODE_EMAIL");
  }
  if (!firebaseConfigured()) {
    if (!idToken) {
      throw new FirebaseAuthError("LOCAL_MODE_EMAIL", "LOCAL_MODE_EMAIL");
    }
    const body = await idToolkit("accounts:sendOobCode", {
      requestType: "VERIFY_EMAIL",
      idToken,
      continueUrl,
      returnOobLink: true,
    });
    return typeof body.oobLink === "string" ? body.oobLink : "";
  }
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

/** Remove a Firebase Auth user (used to roll back failed registrations).
    Web-key deployments require the idToken returned by accounts:signUp; without
    it the user cannot be deleted from the server (logged and skipped). */
export async function deleteFirebaseUser(uid: string, idToken?: string): Promise<void> {
  if (!firebaseAuthConfigured()) {
    await localCredentialDeleteByUid(uid);
    return;
  }
  if (!firebaseConfigured()) {
    if (idToken) {
      await idToolkit("accounts:update", {
        idToken,
        delete: true,
        returnSecureToken: false,
      });
      return;
    }
    console.warn(
      `[firebase-auth] cannot delete Firebase user ${uid} without an idToken (web-key-only deployment) — left in Firebase Auth.`
    );
    return;
  }
  await getAuth(getFirebaseApp()).deleteUser(uid);
}

/** Change a Firebase Auth password on web-key-only deployments: prove the
    current password with a fresh sign-in, then update via the returned
    idToken. Admin-SDK deployments never reach this (they use updateUser). */
export async function changeFirebasePasswordRest(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const body = await idToolkit("accounts:signInWithPassword", {
    email,
    password: currentPassword,
  });
  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  if (!idToken) {
    throw new FirebaseAuthError("UNKNOWN", "Firebase did not return a sign-in token.");
  }
  await idToolkit("accounts:update", {
    idToken,
    password: newPassword,
    returnSecureToken: false,
  });
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
  LOCAL_MODE_EMAIL:
    "This email link can't be generated on the current deployment configuration — contact your administrator.",
  INVALID_LOGIN_CREDENTIALS: "Incorrect email or password.",
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