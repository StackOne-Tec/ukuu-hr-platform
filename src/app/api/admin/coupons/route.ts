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

  /* Firestore has no column defaults or unique indexes, so two integrity
     rules live here instead:
      1. redemption fields are stamped as explicit nulls — the single-use
         claim in src/lib/license.ts matches `where: { id, redeemedAt: null }`
         and a Firestore `== null` query does NOT match documents lacking the
         field (mirrors the old Postgres `redeemedAt` column default).
      2. `id` is set to the code itself, so the document id IS the code.
         db.create() now uses an atomic `.create()` that fails when the id
         already exists — Firestore's native stand-in for a unique constraint.
         The findUnique pre-check below also rejects codes that collide with
         legacy coupons (older docs whose ids are not the code). */
  const existing = await db.coupon.findUnique({ where: { code } });
  if (existing) {
    return NextResponse.json(
      { error: "A coupon with this code already exists." },
      { status: 409 }
    );
  }

  try {
    const coupon = await db.coupon.create({
      data: {
        id: code,
        code,
        discountPercent,
        plan,
        status,
        expiresAt,
        description,
        redeemedAt: null,
        redeemedByOrgId: null,
        redeemedByOrgName: null,
      },
    });
    return NextResponse.json({
      ok: true,
      coupon: { id: coupon.id, code: coupon.code },
    });
  } catch (e) {
    logDbError(e, "admin.coupons.create");
    /* `already exists` means the atomic .create() lost a race against a
       concurrent request creating the same code — a 409 conflict, not an
       outage. Everything else keeps the usual 503-for-known-db-error split. */
    const message = e instanceof Error ? e.message : String(e);
    const duplicate = /already[_ ]?exists/i.test(message);
    return NextResponse.json(
      {
        error: duplicate
          ? "A coupon with this code already exists."
          : dbErrorMessage(e, "The access code could not be saved."),
      },
      { status: duplicate ? 409 : isKnownDbError(e) ? 503 : 409 }
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
