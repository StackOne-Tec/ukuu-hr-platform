import { NextResponse } from "next/server";
import { redeemAccessCode } from "@/lib/license";

export const dynamic = "force-dynamic";

/** Redeem an access code (coupon) issued from the admin portal. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code : "";

  const result = await redeemAccessCode(code);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, plan: result.plan, expiresAt: result.expiresAt });
}