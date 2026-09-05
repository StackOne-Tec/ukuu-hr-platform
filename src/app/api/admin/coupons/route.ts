import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const CODE_RE = /^[A-Z0-9][A-Z0-9-]{1,39}$/;

/**
 * Admin-portal coupon management (platform level).
 * POST  -> create a coupon
 * DELETE -> delete a coupon by id
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    code?: unknown;
    discountPercent?: unknown;
    plan?: unknown;
    status?: unknown;
    expiresAt?: unknown;
    description?: unknown;
  } | null;

  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const discountPercent =
    typeof body?.discountPercent === "number"
      ? Math.round(body.discountPercent)
      : typeof body?.discountPercent === "string"
        ? Number.parseInt(body.discountPercent, 10)
        : NaN;
  const plan =
    typeof body?.plan === "string" && body.plan.trim() ? body.plan.trim() : null;
  const status =
    typeof body?.status === "string" && ["Active", "Disabled"].includes(body.status)
      ? body.status
      : "Active";
  const expiresAt =
    typeof body?.expiresAt === "string" && body.expiresAt
      ? new Date(body.expiresAt)
      : null;
  const description =
    typeof body?.description === "string" && body.description.trim()
      ? body.description.trim()
      : null;

  if (!CODE_RE.test(code)) {
    return NextResponse.json(
      { error: "Coupon code must be 2–40 characters using A–Z, 0–9 and dashes." },
      { status: 400 }
    );
  }
  if (!Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    return NextResponse.json({ error: "Discount must be a whole number between 0 and 100." }, { status: 400 });
  }
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return NextResponse.json({ error: "Enter a valid expiry date." }, { status: 400 });
  }

  try {
    const coupon = await db.coupon.create({
      data: { code, discountPercent, plan, status, expiresAt, description },
    });
    return NextResponse.json({
      ok: true,
      coupon: { id: coupon.id, code: coupon.code },
    });
  } catch {
    return NextResponse.json(
      { error: "A coupon with this code already exists, or the code could not be saved." },
      { status: 409 }
    );
  }
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Coupon id is required." }, { status: 400 });

  try {
    await db.coupon.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Coupon not found." }, { status: 404 });
  }
}
