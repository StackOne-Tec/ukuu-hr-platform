import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiErrorMessage } from "@/lib/apikey";
import { stageClockEvents, type ClockEventInput } from "@/lib/clock";
import { bridgeGuard } from "../guard";

export const dynamic = "force-dynamic";

const MODES = ["manual", "auto"] as const;

function parseTime(v: unknown): Date | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const d = new Date(String(v).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

/* Accepts the flexible shapes desktop apps tend to send. */
function normalizeKind(v: unknown): "check-in" | "check-out" | "verify" | "system" | null {
  const s = String(v ?? "").toLowerCase().replace(/[\s_-]+/g, "");
  if (s === "checkin" || s === "in") return "check-in";
  if (s === "checkout" || s === "out") return "check-out";
  if (s === "verify" || s === "verified") return "verify";
  if (s === "system" || s === "heartbeat") return "system";
  return null;
}

/*
 * POST /api/v1/bridge/sync
 * Upload attendance data the desktop app retrieved from a device — either by a
 * manual “upload now” click (mode: "manual", the default) or automatically on
 * the configured sync interval (mode: "auto"). Events are deduped against the
 * clock-event log and STAGED as pending records; they do NOT enter the core
 * attendance system until an admin selects them on the Import Attendance page
 * (POST /api/attendance/import/bridge). The device's lastSyncAt is refreshed.
 *
 * Body:
 *   { mode?: "manual" | "auto",
 *     deviceId?: string,            // a registered device (id, name or ip)
 *     device?: { id?: string; name?: string; ipAddress?: string },
 *     events: [{ employeeCode: string, time: ISO string, eventType: "check-in" }] }
 *
 * A sync with zero events is still valid — it acts as the device heartbeat and
 * refreshes lastSyncAt, which is what auto-sync produces when nothing is new.
 */
export async function POST(req: Request) {
  try {
    const g = await bridgeGuard(req);
    if (!g.ok) return g.response;
    const { ctx } = g;

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Send a JSON body with the retrieved events." }, { status: 400 });
    }
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

    const modeRaw = str(body.mode) || "manual";
    const mode = (MODES as readonly string[]).includes(modeRaw) ? modeRaw : "manual";

    // Resolve the device this data came from: id, or name/ip, within this org.
    const deviceBody = (body.device ?? {}) as Record<string, unknown>;
    const deviceId = str(body.deviceId) || str(deviceBody.id);
    const deviceName = str(deviceBody.name) || str(body.deviceName);
    const deviceIp = str(deviceBody.ipAddress) || str(body.ipAddress);
    const device = await db.attendanceDevice.findFirst({
      where: {
        organizationId: ctx.organizationId,
        OR: [
          ...(deviceId ? [{ id: deviceId }] : []),
          ...(deviceName ? [{ name: deviceName }] : []),
          ...(deviceIp ? [{ ipAddress: deviceIp }] : []),
        ],
      },
    });
    if (!device) {
      return NextResponse.json(
        {
          ok: false,
          error: deviceId || deviceName || deviceIp
            ? "This device is not registered yet — add it from the dashboard first."
            : "No device was specified — send deviceId or device.name/ipAddress.",
        },
        { status: 400 }
      );
    }

    const rawEvents = Array.isArray(body.events) ? (body.events as unknown[]) : [];
    const events: ClockEventInput[] = [];
    let skipped = 0;
    for (const raw of rawEvents) {
      const r = (raw ?? {}) as Record<string, unknown>;
      const employeeNo = str(r.employeeCode) || str(r.code) || str(r.employeeNo);
      const time = parseTime(r.time) ?? parseTime(r.eventTime);
      const kind = normalizeKind(r.eventType) ?? normalizeKind(r.type);
      if (!time) {
        skipped++;
        continue;
      }
      if (!kind) {
        // Unrecognized event types still get logged as system entries.
        events.push({ employeeNo: employeeNo || "SYS", time, kind: "system" as const, label: str(r.eventType) || "System", raw: JSON.stringify(raw).slice(0, 500) });
        continue;
      }
      events.push({ employeeNo, time, kind, raw: str(r.raw) || null });
    }

    const staged = await stageClockEvents({
      organizationId: ctx.organizationId,
      events,
      deviceRef: { id: device.id },
    });

    if (!staged.dbUnreachable) {
      // Structured sync-run history (feeds GET /api/v1/bridge/syncs) + audit.
      await db.syncRun
        .create({
          data: {
            organizationId: ctx.organizationId,
            deviceId: device.id,
            deviceName: device.name,
            mode,
            received: events.length,
            persisted: staged.persisted,
            attendanceRows: 0,
            matched: 0,
            unmatched: 0,
          },
        })
        .catch(() => {});
      await db.auditLog
        .create({
          data: {
            organizationId: ctx.organizationId,
            userName: "Bridge",
            action: mode === "auto" ? "Bridge.Sync.Auto" : "Bridge.Sync.Manual",
            entityType: "AttendanceDevice",
            entityId: device.id,
            details: `${events.length} event(s) uploaded from ${device.name} (${staged.persisted} new rows staged — awaiting admin import)`,
          },
        })
        .catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      mode,
      device: { id: device.id, name: device.name },
      received: events.length,
      skippedInvalid: skipped,
      persisted: staged.persisted,
      staged: staged.persisted, // records now waiting in the Import Attendance review list
      attendanceRows: 0, // nothing enters Attendance until the admin selects records to import
      matched: 0,
      unmatchedPunches: 0, // employee matching happens at import time
      syncedAt: new Date().toISOString(),
      dbUnreachable: staged.dbUnreachable,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: apiErrorMessage(e, "Unable to sync the device right now.", "v1.bridge.sync") },
      { status: 503 }
    );
  }
}
