import { NextResponse } from "next/server";
import { getAccessStatus } from "@/lib/license";

export const dynamic = "force-dynamic";

/** Subscription status for the signed-in user's workspace. */
export async function GET() {
  const status = await getAccessStatus();
  return NextResponse.json({ ok: true, status });
}