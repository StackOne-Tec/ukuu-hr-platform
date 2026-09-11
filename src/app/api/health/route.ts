import { NextResponse } from "next/server";
import { getDb, firebaseConfigured, firebaseAuthConfigured } from "@/lib/firebase";
import { localHealthy } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export async function GET() {
  let database = "unavailable";
  let mode: "firestore" | "local" = firebaseConfigured() ? "firestore" : "local";
  try {
    if (mode === "local") {
      // No Firebase service account — probe the local file-backed store that
      // transparently backs the data layer in this mode.
      database = (await localHealthy()) ? "connected" : "unavailable";
    } else {
      // Cheap Firestore connectivity probe — a 1-doc read against a scratch
      // collection that auto-creates. Returns "connected" when Firestore
      // responds at all.
      const snap = await getDb().collection("_health").limit(1).get();
      if (snap) database = "connected";
    }
  } catch {
    // Database unreachable: the app itself is still healthy,
    // report database state for observability.
  }
  const auth: "firebase" | "local" = firebaseAuthConfigured() ? "firebase" : "local";
  return NextResponse.json({
    status: "ok",
    database,
    mode,
    auth,
    timestamp: new Date().toISOString(),
  });
}
