import { NextResponse } from "next/server";
import { destroyWebSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  await destroyWebSession();
  return NextResponse.json({ ok: true });
}