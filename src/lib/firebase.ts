import "server-only";
import { readFileSync } from "node:fs";
import {
  initializeApp,
  cert,
  getApps,
  getApp,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let _warned = false;

type ServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

/** Resolve the service account from env. Inline JSON wins, then a file path. */
function serviceAccount(): ServiceAccount | null {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (inline) {
    try {
      const parsed = JSON.parse(inline);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      console.error("[firebase] FIREBASE_SERVICE_ACCOUNT is not valid JSON — check .env.local");
      return null;
    }
  }
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8"));
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      console.error(`[firebase] Could not read GOOGLE_APPLICATION_CREDENTIALS at "${path}"`);
      return null;
    }
  }
  return null;
}

/**
 * Lazily-initialized Firebase app. Warns once when no service account is
 * configured and still returns an app — calls that need Firestore will then
 * fail with a driver error instead of crashing the import (mirrors the Resend
 * pattern). Set either:
 *   FIREBASE_SERVICE_ACCOUNT='{...service account JSON...}'
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */
export function getFirebaseApp(): App {
  if (getApps().length > 0) return getApp();
  const creds = serviceAccount();
  if (!creds) {
    if (!_warned) {
      _warned = true;
      console.warn(
        "[firebase] No service account configured (FIREBASE_SERVICE_ACCOUNT / GOOGLE_APPLICATION_CREDENTIALS) — Firestore calls will fail."
      );
    }
    return initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  }
  return initializeApp({
    credential: cert(creds as Parameters<typeof cert>[0]),
    projectId: creds.project_id ?? process.env.FIREBASE_PROJECT_ID,
  });
}

/** Firestore handle used by the data layer. */
export function getDb(): Firestore {
  return getFirestore(getFirebaseApp());
}