import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { probeDevice } from "@/lib/isapi";

export const dynamic = "force-dynamic";

/* Stage 1 of the Import Attendance modal — prompt a live connection to the
   selected device. Probes the terminal over ISAPI and, on success, records
   the sync on the device row. Returns 502 with a readable error when the
   device is unreachable so the modal shows its "Connection failed — Retry"
   state. */
export async function POST(req: Request) {
  let deviceId: string | null = null;
  try {
    const body = await req.json();
    deviceId = body.deviceId ?? null;

    let device: { id: string; name: string; vendor: string; model: string | null; ipAddress: string | null; apiKey: string | null } | null = null;
    if (deviceId) {
      try {
        device = await db.attendanceDevice.findUnique({
          where: { id: deviceId },
          select: { id: true, name: true, vendor: true, model: true, ipAddress: true, apiKey: true },
        });
      } catch {
        /* DB unreachable — fall through to manual IP handling */
      }
    }

    // Credentials come from the modal first, then from the stored device record.
    const username = String(body.username ?? "admin").trim() || "admin";
    const password = body.password ? String(body.password) : device?.apiKey ?? undefined;
    const auth = username ? { username, password } : undefined;

    const vendor = String(body.vendor ?? device?.vendor ?? "Hikvision");
    const host = String(device?.ipAddress ?? body.ipAddress ?? "").trim();
    const port = Number(device ? 80 : body.port ?? 80);
    if (!host) {
      return NextResponse.json({ ok: false, error: "No device IP address provided." }, { status: 400 });
    }
    if (!/^[\w.:\-[\]]+$/.test(host)) {
      return NextResponse.json({ ok: false, error: "Invalid device IP address." }, { status: 400 });
    }

    const info = await probeDevice(host, port, auth);

    // Best-effort: remember credentials, mark the device online and log the sync.
    try {
      if (deviceId && body.password && password) {
        await db.attendanceDevice.update({ where: { id: deviceId }, data: { apiKey: password } });
      }
      if (deviceId) {
        await db.attendanceDevice.update({
          where: { id: deviceId },
          data: { status: "Online", lastSyncAt: new Date(), lastError: null },
        });
      }
      await db.auditLog.create({
        data: {
          organizationId: null,
          userName: "system",
          action: "AttendanceImport.Connect",
          entityType: "AttendanceDevice",
          entityId: deviceId ?? undefined,
          details: `${vendor} device at ${host}:${port} connected (${info.model || info.deviceName})`,
        },
      });
    } catch {
      /* DB unreachable — connection itself is what matters here */
    }

    return NextResponse.json({ ok: true, deviceName: info.deviceName, model: info.model, vendor, ipAddress: host, port });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Connection failed";
    try {
      if (deviceId) {
        await db.attendanceDevice.update({
          where: { id: deviceId },
          data: { status: "Error", lastError: message.slice(0, 300) },
        });
      }
    } catch {
      /* best-effort */
    }
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
