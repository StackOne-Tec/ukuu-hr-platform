import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiErrorMessage } from "@/lib/apikey";
import { serializeDevice } from "@/lib/bridge";
import { bridgeGuard } from "../../guard";

export const dynamic = "force-dynamic";

const DEVICE_STATUSES = ["Online", "Offline", "Error"] as const;

type Ctx = { params: Promise<{ id: string }> };

/* PATCH /api/v1/bridge/devices/[id]
   Update a registered device. Mainly used for the auto-upload configuration
   (“configure auto upload after every sync interval”): toggle
   autoSyncEnabled and set syncIntervalMinutes. name/status can also change. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const g = await bridgeGuard(req);
    if (!g.ok) return g.response;
    const { ctx } = g;

    const { id } = await params;
    const existing = await db.attendanceDevice.findFirst({
      where: { organizationId: ctx.organizationId, id },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Device not found in this organization." }, { status: 404 });
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Send a JSON body with the fields to update." }, { status: 400 });
    }
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const data: Record<string, unknown> = {};

    const name = str(body.name);
    if (name) data.name = name;
    if (typeof body.autoSyncEnabled === "boolean") data.autoSyncEnabled = body.autoSyncEnabled;
    if (body.syncIntervalMinutes !== undefined) {
      const mins = Number(body.syncIntervalMinutes);
      if (!Number.isInteger(mins) || mins < 1 || mins > 1440) {
        return NextResponse.json(
          { ok: false, error: "syncIntervalMinutes must be a whole number of minutes between 1 and 1440." },
          { status: 400 }
        );
      }
      data.syncIntervalMinutes = mins;
    }
    const status = str(body.status);
    if (status) {
      if (!(DEVICE_STATUSES as readonly string[]).includes(status)) {
        return NextResponse.json(
          { ok: false, error: `status must be one of: ${DEVICE_STATUSES.join(", ")}.` },
          { status: 400 }
        );
      }
      data.status = status;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to update — send name, autoSyncEnabled, syncIntervalMinutes and/or status." }, { status: 400 });
    }

    const updated = await db.attendanceDevice.update({ where: { id: existing.id }, data });

    return NextResponse.json({ ok: true, device: serializeDevice(updated) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: apiErrorMessage(e, "Unable to update the device right now.") },
      { status: 503 }
    );
  }
}
