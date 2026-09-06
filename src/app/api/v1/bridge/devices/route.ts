import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiErrorMessage } from "@/lib/apikey";
import { serializeDevice, deviceQuota } from "@/lib/bridge";
import { bridgeGuard } from "../guard";

export const dynamic = "force-dynamic";

const DEVICE_STATUSES = ["Online", "Offline", "Error"] as const;
const INTEGRATION_MODES = ["REST", "CSV", "SDK", "TCP"] as const;
const IP_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

/* GET /api/v1/bridge/devices — the devices already added for the org. The
   quota is reported as unlimited: the Bridge no longer caps how many devices
   a workspace may register. */
export async function GET(req: Request) {
  try {
    const g = await bridgeGuard(req);
    if (!g.ok) return g.response;
    const { ctx } = g;

    const devices = await db.attendanceDevice.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      ok: true,
      subscription: ctx.subscription,
      count: devices.length,
      quota: deviceQuota(ctx.subscription.plan, devices.length),
      devices: devices.map(serializeDevice),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: apiErrorMessage(e, "Unable to load devices right now.") },
      { status: 503 }
    );
  }
}

/* POST /api/v1/bridge/devices — register a new attendance device found on the
   LAN by the desktop app. Fields match the desktop “Add device” form: name,
   vendor, model, IP address, integration mode, sync interval. Registration is
   unlimited — there is no per-plan device cap. */
export async function POST(req: Request) {
  try {
    const g = await bridgeGuard(req);
    if (!g.ok) return g.response;
    const { ctx } = g;

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Send a JSON body with the device details." }, { status: 400 });
    }
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

    const name = str(body.name);
    if (!name) {
      return NextResponse.json({ ok: false, error: "Device name is required." }, { status: 400 });
    }

    const ipAddress = str(body.ipAddress) || null;
    if (ipAddress && !IP_RE.test(ipAddress)) {
      return NextResponse.json({ ok: false, error: "Enter a valid device IP address (e.g. 192.168.1.50)." }, { status: 400 });
    }

    const vendor = str(body.vendor) || "Hikvision";
    const model = str(body.model) || null;
    const rawPort = body.port === undefined ? 80 : Number(body.port);
    const port = Number.isInteger(rawPort) && rawPort > 0 && rawPort <= 65535 ? rawPort : 80;
    const mode = str(body.integrationMode) || "REST";
    if (!(INTEGRATION_MODES as readonly string[]).includes(mode)) {
      return NextResponse.json(
        { ok: false, error: `integrationMode must be one of: ${INTEGRATION_MODES.join(", ")}.` },
        { status: 400 }
      );
    }
    let status = str(body.status) || "Online";
    if (!(DEVICE_STATUSES as readonly string[]).includes(status)) status = "Online";

    if (ipAddress) {
      const existing = await db.attendanceDevice.findFirst({
        where: { organizationId: ctx.organizationId, ipAddress },
      });
      if (existing) {
        return NextResponse.json(
          {
            ok: false,
            error: `A device with IP ${ipAddress} is already registered (“${existing.name}”).`,
            existing: { id: existing.id, name: existing.name },
          },
          { status: 409 }
        );
      }
    }

    const used = await db.attendanceDevice.count({ where: { organizationId: ctx.organizationId } });

    const created = await db.attendanceDevice.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        vendor,
        model,
        ipAddress,
        port,
        integrationMode: mode,
        status,
        autoSyncEnabled: body.autoSyncEnabled !== false,
        syncIntervalMinutes: Math.max(1, Number(body.syncIntervalMinutes ?? 30) || 30),
        apiKey: str(body.password) || null, // device API password, same convention as the import flow
      },
    });

    return NextResponse.json(
      {
        ok: true,
        device: serializeDevice(created),
        quota: deviceQuota(ctx.subscription.plan, used + 1), // refreshed: drives “add another”
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: apiErrorMessage(e, "Unable to register the device right now.") },
      { status: 503 }
    );
  }
}
