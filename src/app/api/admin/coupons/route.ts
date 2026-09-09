import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dbErrorMessage, isKnownDbError, logDbError } from "@/lib/db-error";

const CODE_RE = /^[A-Z0-9][A-Z0-9-]{1,39}$/;

/**
 * Admin-portal coupon management (platform level).
 * POST  -> create a coupon
 * DELETE -> delete a coupon by id
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    code?: unknown;
    months?: unknown;
    plan?: unknown;
    status?: unknown;
    expiresAt?: unknown;
    description?: unknown;
  } | null;

  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const months =
    typeof body?.months === "number"
      ? Math.round(body.months)
      : typeof body?.months === "string" && body.months.trim() !== ""
        ? Number.parseInt(body.months, 10)
        : null;
  const plan =
    typeof body?.plan === "string" && body.plan.trim() ? body.plan.trim() : null;
  const status =
    typeof body?.status === "string" && ["Active", "Disabled"].includes(body.status)
      ? body.status
      : "Active";
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
  if (months !== null && (!Number.isInteger(months) || months < 1 || months > 120)) {
    return NextResponse.json(
      { error: "Duration must be a whole number of months between 1 and 120." },
      { status: 400 }
    );
  }

  /* Workspaces never pay inside Ukuu HR: redeeming an access code always
     covers the full subscription (100% discount). The chosen duration
     determines how long the unlocked subscription lasts. */
  const discountPercent = 100;
  let expiresAt: Date | null = null;
  if (months !== null) {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    expiresAt = d;
  }
  // Legacy clients may still send an explicit date instead of a duration.
  if (!expiresAt && typeof body?.expiresAt === "string" && body.expiresAt) {
    const parsed = new Date(body.expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Enter a valid expiry date." }, { status: 400 });
    }
    expiresAt = parsed;
  }

  try {
    const coupon = await db.coupon.create({
      data: { code, discountPercent, plan, status, expiresAt, description },
    });
    return NextResponse.json({
      ok: true,
      coupon: { id: coupon.id, code: coupon.code },
    });
  } catch (e) {
    logDbError(e, "admin.coupons.create");
    return NextResponse.json(
      { error: dbErrorMessage(e, "A coupon with this code already exists, or the code could not be saved.") },
      { status: isKnownDbError(e) ? 503 : 409 }
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
  } catch (e) {
    logDbError(e, "admin.coupons.delete");
    return NextResponse.json(
      { error: dbErrorMessage(e, "Coupon not found.") },
      { status: isKnownDbError(e) ? 503 : 404 }
    );
  }
}
