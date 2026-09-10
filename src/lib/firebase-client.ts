/**
 * Client-side Firebase helpers (browser only — never import from a server
 * component or route handler).
 *
 * Only Google sign-in runs through the client SDK: `signInWithPopup` uses the
 * OAuth client Firebase auto-creates for the project, so it works with the
 * public web config alone (no Google Cloud OAuth credentials needed). The
 * resulting Google id_token is exchanged server-side at
 * /api/auth/google/token, which mints it into Firebase Auth and creates the
 * httpOnly session cookie.
 *
 * The Firebase modules are imported lazily inside the function so they only
 * load when the user actually clicks "Continue with Google".
 */

const CLIENT_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

/** True when the NEXT_PUBLIC_FIREBASE_* web config is present on this build. */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    CLIENT_CONFIG.apiKey && CLIENT_CONFIG.authDomain && CLIENT_CONFIG.projectId
  );
}

/** Run the Google sign-in popup and return the Google id_token. */
export async function signInWithGooglePopup(): Promise<{ idToken: string }> {
  const { initializeApp, getApps, getApp } = await import("firebase/app");
  const { getAuth, signInWithPopup, GoogleAuthProvider } = await import("firebase/auth");

  const app = getApps().length ? getApp() : initializeApp(CLIENT_CONFIG);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const idToken = credential?.idToken;
  if (!idToken) {
    throw new Error("Google did not return a sign-in token — please try again.");
  }
  return { idToken };
}