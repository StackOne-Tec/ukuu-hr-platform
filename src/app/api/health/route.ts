import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let database = "unavailable";
  try {
    await db.$queryRaw`SELECT 1`;
    database = "connected";
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
