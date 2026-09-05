import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentOrg } from "@/lib/session";
import { fetchDeviceEvents, fetchDeviceUsers } from "@/lib/isapi";
import { ingestClockEvents } from "@/lib/clock";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

/* Stage 2 of the Import Attendance modal — pull EVERYTHING the device holds:
   its full event history (all event types, not just punches), plus the people
   enrolled on it, and write it all into the unified clock-event log. Daily
   attendance rows are rolled up only from check-in/check-out punches whose
   employee code matches an employee record.

   Import semantics (kept explicit so the modal's summary reads honestly):
     fetched         — events returned by the device
     imported        — check-in/check-out punches found (the attendance records)
     persisted       — new clock-event rows actually written (every event type)
     attendanceRows  — daily attendance rows created/updated from matched punches
     matched         — punches whose employee code matched an employee record
     personnelCount  — people enrolled on the device (UserInfo/Search)
   If the database is unreachable the device side still completes and the
   response reports persisted: 0 so the UI never claims records were saved.

   All database writes (dedupe, roll-up, device refresh) are shared with the
   Bridge desktop sync endpoint via src/lib/clock.ts — this route only owns
   the device-side ISAPI pull. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const host = String(body.ipAddress ?? "").trim();
    const port = Number(body.port ?? 80);
    const deviceNameHint = String(body.deviceName ?? "").trim();
    if (!host) {
      return NextResponse.json({ ok: false, error: "No device IP address provided." }, { status: 400 });
    }

    // Find the registered device (for stored credentials + id) by IP or name.
    let registered: { id: string; apiKey: string | null } | null = null;
    try {
      registered = await db.attendanceDevice.findFirst({
        where: { OR: [{ ipAddress: host }, { name: deviceNameHint || undefined }] },
        select: { id: true, apiKey: true },
      });
    } catch {
      /* DB unreachable — import still works, just nothing is persisted */
    }

    // Credentials come from the modal first, then from the stored device record.
    const username = String(body.username ?? "admin").trim() || "admin";
    const password = body.password ? String(body.password) : registered?.apiKey ?? undefined;
    const auth = username ? { username, password } : undefined;

    // Default: the device's whole history. A from/to range can narrow it.
    const end = body.to ? new Date(String(body.to)) : new Date();
    const start = body.from ? new Date(String(body.from)) : new Date("2020-01-01T00:00:00");

    // NOTE: run device requests SEQUENTIALLY — this Hikvision firmware rejects
    // concurrent ISAPI digest sessions (verified live on the DS-K1T321MFWX).
    const users = await fetchDeviceUsers({ host, port, auth }).catch(() => []);
    const eventRes = await fetchDeviceEvents({
      host,
      port,
      auth,
      start,
      end: end > start ? end : new Date(start.getTime() + DAY_MS),
    });
    const events = eventRes.events;

    // Persist what was retrieved — shared write path with the Bridge app.
    let orgId: string | null = null;
    try {
      const org = await currentOrg();
      orgId = org?.id ?? null;
    } catch {
      /* DB unreachable — the ingest helper reports dbUnreachable */
    }
    const ingested = await ingestClockEvents({
      organizationId: orgId,
      events: events.map((e) => ({
        employeeNo: e.employeeNo,
        time: e.time,
        kind: e.kind,
        label: e.label,
        major: e.major,
        minor: e.minor,
        raw: e.raw,
      })),
      sourceLabel: deviceNameHint || host,
      deviceRef: registered ? { id: registered.id } : null,
      devicePassword: body.password ? password : null,
    });

    // Audit (caller-owned so it can include the personnel count) — original
    // format preserved.
    if (!ingested.dbUnreachable && orgId) {
      await db.auditLog
        .create({
          data: {
            organizationId: orgId,
            userName: "system",
            action: "AttendanceImport.Import",
            entityType: "AttendanceDevice",
            entityId: registered?.id ?? undefined,
            details: `${events.length} event(s) pulled from ${host}:${port} (${ingested.persisted} new rows, ${ingested.attendanceRows} attendance rows, ${users.length} people enrolled)`,
          },
        })
        .catch(() => {});
    }

    const punches = events.filter((e) => e.kind === "check-in" || e.kind === "check-out");
    return NextResponse.json({
      ok: true,
      deviceName: deviceNameHint || host,
      fetched: eventRes.fetched,
      truncated: eventRes.truncated,
      imported: punches.length,
      checkIns: punches.filter((p) => p.kind === "check-in").length,
      checkOuts: punches.filter((p) => p.kind === "check-out").length,
      persisted: ingested.persisted,
      attendanceRows: ingested.attendanceRows,
      matched: ingested.matched,
      unmatchedPunches: ingested.unmatchedPunches,
      personnelCount: users.length,
      personnel: users.slice(0, 20),
      dbUnreachable: ingested.dbUnreachable,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
