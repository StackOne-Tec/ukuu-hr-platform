import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebase";

export const dynamic = "force-dynamic";

export async function GET() {
  let database = "unavailable";
  try {
    // Cheap Firestore connectivity probe — a 1-doc read against a scratch
    // collection that auto-creates. Returns "connected" when Firestore
    // responds at all.
    const snap = await getDb().collection("_health").limit(1).get();
    if (snap) database = "connected";
  } catch {
    // Database unreachable: the app itself is still healthy,
    // report database state for observability.
  }
  return NextResponse.json({
    status: "ok",
    database,
    timestamp: new Date().toISOString(),
  });
}