import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiErrorMessage } from "@/lib/apikey";
import { fetchDeviceEvents, fetchDeviceUsers } from "@/lib/isapi";
import { stageClockEvents } from "@/lib/clock";
import { bridgeGuard } from "../../../guard";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const g = await bridgeGuard(req);
    if (!g.ok) return g.response;
    const device = await db.attendanceDevice.findFirst({
      where: { id: (await params).id, organizationId: g.ctx.organizationId },
    });
    if (!device) return NextResponse.json({ ok: false, error: "Device not found in this organization." }, { status: 404 });
    if (!device.ipAddress) return NextResponse.json({ ok: false, error: "This device has no LAN IP address." }, { status: 400 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const username = typeof body.username === "string" && body.username.trim() ? body.username.trim() : "admin";
    const password = typeof body.password === "string" && body.password ? body.password : device.apiKey ?? undefined;
    const end = new Date();
    const start = body.from ? new Date(String(body.from)) : new Date("2020-01-01T00:00:00");
    const auth = { username, password };

    // Sequential requests matter for Hikvision firmware: concurrent digest
    // sessions commonly fail even when the credentials are valid.
    const users = await fetchDeviceUsers({ host: device.ipAddress, port: device.port, auth });
    const eventResult = await fetchDeviceEvents({ host: device.ipAddress, port: device.port, auth, start, end });
    const staged = await stageClockEvents({
      organizationId: g.ctx.organizationId,
      events: eventResult.events.map((event) => ({
        employeeNo: event.employeeNo,
        time: event.time,
        kind: event.kind,
        label: event.label,
        major: event.major,
        minor: event.minor,
        raw: event.raw,
      })),
      deviceRef: { id: device.id },
      devicePassword: typeof body.password === "string" && body.password ? body.password : null,
    });

    if (!staged.dbUnreachable) {
      await db.syncRun.create({
        data: {
          organizationId: g.ctx.organizationId,
          deviceId: device.id,
          deviceName: device.name,
          mode: "manual",
          received: eventResult.events.length,
          persisted: staged.persisted,
          attendanceRows: 0,
          matched: 0,
          unmatched: 0,
        },
      }).catch(() => {});
      await db.auditLog.create({
        data: {
          organizationId: g.ctx.organizationId,
          userName: "Bridge",
          action: "Bridge.DevicePull",
          entityType: "AttendanceDevice",
          entityId: device.id,
          details: `${eventResult.events.length} event(s) pulled from ${device.name}; ${users.length} people read; ${staged.persisted} new event(s) staged for review`,
        },
      }).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      device: { id: device.id, name: device.name },
      fetched: eventResult.fetched,
      persisted: staged.persisted,
      staged: staged.persisted,
      truncated: eventResult.truncated,
      personnelCount: users.length,
      personnel: users,
      attendanceRows: 0,
      syncedAt: new Date().toISOString(),
      dbUnreachable: staged.dbUnreachable,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: apiErrorMessage(e, "Unable to pull records from the device.", "v1.bridge.device.sync") }, { status: 502 });
  }
}
