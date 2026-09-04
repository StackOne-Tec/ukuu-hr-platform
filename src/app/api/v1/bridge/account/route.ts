import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiErrorMessage } from "@/lib/apikey";
import { authenticateBridge, loadSubscription, deviceQuota } from "@/lib/bridge";

export const dynamic = "force-dynamic";

/*
 * GET /api/v1/bridge/account
 * The desktop app's dashboard fetch (after login): account details plus the
 * account/subscription validity gate and an at-a-glance device summary of
 * the devices already added.
 */
export async function GET(req: Request) {
  try {
    const ctx = await authenticateBridge(req);
    if (!ctx) {
      return NextResponse.json(
        { ok: false, error: "Not signed in — call POST /api/v1/bridge/login first." },
        { status: 401 }
      );
    }

    const [account, loaded] = await Promise.all([
      ctx.userId ? db.userAccount.findUnique({ where: { id: ctx.userId } }) : Promise.resolve(null),
      loadSubscription(ctx.organizationId),
    ]);
    if (!loaded) {
      return NextResponse.json(
        { ok: false, error: "Your organization could not be found. Contact your administrator." },
        { status: 404 }
      );
    }
    const { org, subscription } = loaded;

    const devices = await db.attendanceDevice.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      ok: true,
      account: account
        ? { name: account.name, email: account.email, role: account.role }
        : null,
      organization: { id: org.id, name: org.name, slug: org.slug, plan: org.plan },
      subscription,
      dashboard: {
        allowed: subscription.valid,
        devices: {
          total: devices.length,
          online: devices.filter((d) => d.status === "Online").length,
          offline: devices.filter((d) => d.status === "Offline").length,
          error: devices.filter((d) => d.status === "Error").length,
          items: devices.map((d) => ({ id: d.id, name: d.name, status: d.status })),
        },
        quota: deviceQuota(subscription.plan, devices.length),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: apiErrorMessage(e, "Unable to load your account right now.") },
      { status: 503 }
    );
  }
}
