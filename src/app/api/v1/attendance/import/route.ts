import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey, apiErrorMessage, scopeAllows } from "@/lib/apikey";
import { createNotification } from "@/lib/notify";
import { ingestClockEvents, type ClockEventInput } from "@/lib/clock";

export const dynamic = "force-dynamic";

function parseTime(v: unknown): Date | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const d = new Date(String(v).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

/* Accepts the flexible shapes device/desktop clients tend to send. */
function normalizeKind(v: unknown): "check-in" | "check-out" | "verify" | "system" | null {
  const s = String(v ?? "").toLowerCase().replace(/[\s_-]+/g, "");
  if (s === "checkin" || s === "in") return "check-in";
  if (s === "checkout" || s === "out") return "check-out";
  if (s === "verify" || s === "verified") return "verify";
  if (s === "system" || s === "heartbeat") return "system";
  return null;
}

/*
 * POST /api/v1/attendance/import
 * Authenticated with a cloud API key that has the attendance scope. Imports
 * punch records straight into the attendance section of the shared database —
 * the exact same UnifiedClockEvent + Attendance tables the cloud console and
 * the Bridge dashboard read, because the bridge and the cloud are the same
 * application pointed at the same PostgreSQL database.
 *
 * Body:
 *   { device?: { name?: string; ipAddress?: string },
 *     events: [{ employeeCode: string, time: ISO string, eventType: "check-in" }] }
 *
 * A device is optional: when a name/ip matches a registered device the import
 * links to it; otherwise the records are imported with the given label and the
 * rows still appear in Attendance immediately. Re-imports are idempotent (the
 * ingestion pipeline dedupes by employee code + kind within the same minute).
 */
export async function POST(req: Request) {
  try {
    const auth = await authenticateApiKey(req);
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid API key." },
        { status: 401 }
      );
    }
    if (!scopeAllows(auth.key.scopes, "attendance")) {
      return NextResponse.json(
        { ok: false, error: "This API key does not include the attendance scope." },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Send a JSON body with the records to import." },
        { status: 400 }
      );
    }
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

    const deviceBody = (body.device ?? {}) as Record<string, unknown>;
    const deviceName = str(deviceBody.name);
    const deviceIp = str(deviceBody.ipAddress);
    const sourceLabel = deviceName || deviceIp || "API Key Import";

    /* Link to a registered device when the label matches one in this org —
       never required for the import itself. */
    const deviceRef = deviceName || deviceIp
      ? await db.attendanceDevice.findFirst({
          where: {
            organizationId: auth.organizationId,
            OR: [...(deviceName ? [{ name: deviceName }] : []), ...(deviceIp ? [{ ipAddress: deviceIp }] : [])],
          },
          select: { id: true },
        })
      : null;

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
        events.push({
          employeeNo: employeeNo || "SYS",
          time,
          kind: "system" as const,
          label: str(r.eventType) || "System",
          raw: JSON.stringify(raw).slice(0, 500),
        });
        continue;
      }
      events.push({ employeeNo, time, kind, raw: str(r.raw) || null });
    }

    const ingested = await ingestClockEvents({
      organizationId: auth.organizationId,
      events,
      sourceLabel,
      deviceRef: deviceRef ? { id: deviceRef.id } : null,
    });

    if (!ingested.dbUnreachable) {
      // Import run recorded in the same sync history the Bridge dashboard shows.
      await db.syncRun
        .create({
          data: {
            organizationId: auth.organizationId,
            deviceId: deviceRef?.id ?? null,
            deviceName: sourceLabel,
            mode: "manual",
            received: events.length,
            persisted: ingested.persisted,
            attendanceRows: ingested.attendanceRows,
            matched: ingested.matched,
            unmatched: ingested.unmatchedPunches,
          },
        })
        .catch(() => {});
      await db.auditLog
        .create({
          data: {
            organizationId: auth.organizationId,
            userName: "API Key",
            action: "ApiKey.AttendanceImport",
            entityType: "Attendance",
            details: `${events.length} record(s) imported via API key (${ingested.persisted} new rows, ${ingested.attendanceRows} attendance rows)`,
          },
        })
        .catch(() => {});
      if (ingested.unmatchedPunches > 0) {
        await createNotification({
          organizationId: auth.organizationId,
          title: "Import warning",
          message: `${sourceLabel}: ${ingested.unmatchedPunches} record(s) could not be matched to an employee code.`,
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      ok: true,
      source: sourceLabel,
      received: events.length,
      skippedInvalid: skipped,
      persisted: ingested.persisted,
      attendanceRows: ingested.attendanceRows,
      matched: ingested.matched,
      unmatchedPunches: ingested.unmatchedPunches,
      syncedAt: new Date().toISOString(),
      dbUnreachable: ingested.dbUnreachable,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: apiErrorMessage(e, "Unable to import attendance right now.") },
      { status: 503 }
    );
  }
}