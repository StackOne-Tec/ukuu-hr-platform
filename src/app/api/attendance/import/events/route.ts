import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchDeviceEvents, fetchDeviceUsers, eventLabel } from "@/lib/isapi";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_START = 8 * 60; // standard day shift starts 08:00 → later is "Late"
const MINUTE_MS = 60 * 1000;

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
   response reports persisted: 0 so the UI never claims records were saved. */
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

    let persisted = 0;
    let attendanceRows = 0;
    let matched = 0;
    let unmatchedPunches = 0;
    let dbUnreachable = false;

    try {
      const org = await db.organization.findFirst({ where: { slug: "ukuuhr-demo" } });
      const orgId = org?.id ?? null;
      const employees = await db.employee.findMany({ where: { organizationId: orgId ?? "ukuuhr-demo" } });
      const empByCode = new Map(employees.map((e) => [e.employeeCode, e.id]));

      // ── Dedupe against clock events already in the log ──
      // One key format both sides: punches match on code + kind within the same
      // minute (device clocks jitter); system/verify events on code + kind at
      // the exact second. This keeps a re-import idempotent without dropping
      // legitimate same-minute heartbeats.
      const keyOf = (e: { employeeCode: string; kind: string; timeMs: number }) => {
        if (e.kind === "check-in" || e.kind === "check-out") {
          return `p|${e.employeeCode}|${e.kind}|${Math.floor(e.timeMs / MINUTE_MS)}`;
        }
        return `e|${e.employeeCode || "SYS"}|${e.kind}|${Math.floor(e.timeMs / 1000)}`;
      };
      const earliest = events.length ? Math.min(...events.map((e) => e.time.getTime())) : Date.now();
      const since = new Date(earliest - DAY_MS);
      const codes = [...new Set(events.map((e) => e.employeeNo || "SYS"))];
      const existing = codes.length
        ? await db.unifiedClockEvent.findMany({
            where: { employeeCode: { in: codes }, eventTime: { gte: since } },
            select: { employeeCode: true, eventType: true, eventTime: true },
          })
        : [];
      const seen = new Set(
        existing.map((c) => {
          const t = c.eventType ?? "";
          const kind = t === "Check In" ? "check-in" : t === "Check Out" ? "check-out" : t.startsWith("Verify") ? "verify" : "system";
          return keyOf({ employeeCode: c.employeeCode, kind, timeMs: c.eventTime.getTime() });
        })
      );
      const fresh = events.filter((e) => !seen.has(keyOf({ employeeCode: e.employeeNo, kind: e.kind, timeMs: e.time.getTime() })));

      if (fresh.length > 0) {
        const { count } = await db.unifiedClockEvent.createMany({
          data: fresh.map((e) => ({
            organizationId: orgId,
            employeeCode: e.employeeNo || "SYS",
            deviceId: registered?.id ?? null,
            eventType: e.kind === "system" ? `System · ${eventLabel(e.major, e.minor)}` : e.kind === "verify" ? `Verify · ${eventLabel(e.major, e.minor)}` : e.label,
            eventTime: e.time,
            raw: e.raw || null,
          })),
        });
        persisted = count;
      }

      // ── Roll check-in/check-out punches up into daily attendance rows ──
      const dayKey = (t: Date) => {
        const d = new Date(t);
        d.setHours(0, 0, 0, 0);
        return d;
      };
      const agg = new Map<string, { empId: string; date: Date; in: Date | null; out: Date | null }>();
      for (const e of events) {
        if (e.kind !== "check-in" && e.kind !== "check-out") continue;
        const empId = empByCode.get(e.employeeNo);
        if (!empId) {
          unmatchedPunches++;
          continue;
        }
        const key = `${empId}|${dayKey(e.time).getTime()}`;
        const cur = agg.get(key) ?? { empId, date: dayKey(e.time), in: null, out: null };
        if (e.kind === "check-in" && (!cur.in || e.time < cur.in)) cur.in = e.time;
        if (e.kind === "check-out" && (!cur.out || e.time > cur.out)) cur.out = e.time;
        agg.set(key, cur);
      }
      matched = [...agg.keys()].length;

      for (const { empId, date, in: checkIn, out: checkOut } of agg.values()) {
        const startDay = new Date(date);
        const endDay = new Date(date.getTime() + DAY_MS);
        const existingAtt = await db.attendance.findFirst({
          where: { employeeId: empId, date: { gte: startDay, lt: endDay } },
          select: { id: true, checkIn: true, checkOut: true },
        });
        const finalIn = existingAtt?.checkIn && (!checkIn || existingAtt.checkIn < checkIn) ? existingAtt.checkIn : checkIn;
        const finalOut = existingAtt?.checkOut && (!checkOut || existingAtt.checkOut > checkOut) ? existingAtt.checkOut : checkOut;
        const hours = finalIn && finalOut ? Math.round(((finalOut.getTime() - finalIn.getTime()) / 3600000) * 100) / 100 : 0;
        const minutes = finalIn ? finalIn.getHours() * 60 + finalIn.getMinutes() : 0;
        const status = !finalIn ? "Absent" : minutes > DAY_START ? "Late" : "Present";
        const payload = {
          checkIn: finalIn,
          checkOut: finalOut,
          workedHours: Math.max(0, hours),
          status,
          source: "Device",
          note: `Imported from ${deviceNameHint || host}`,
          reviewed: false,
        };
        if (existingAtt) {
          await db.attendance.update({ where: { id: existingAtt.id }, data: payload });
        } else {
          await db.attendance.create({
            data: { organizationId: orgId, employeeId: empId, date, ...payload },
          });
          attendanceRows++;
        }
      }

      if (registered) {
        await db.attendanceDevice.update({
          where: { id: registered.id },
          data: {
            ...(body.password && password ? { apiKey: password } : {}),
            status: "Online",
            lastSyncAt: new Date(),
            lastError: null,
          },
        });
      }
      await db.auditLog.create({
        data: {
          organizationId: orgId,
          userName: "system",
          action: "AttendanceImport.Import",
          entityType: "AttendanceDevice",
          entityId: registered?.id ?? undefined,
          details: `${events.length} event(s) pulled from ${host}:${port} (${persisted} new rows, ${attendanceRows} attendance rows, ${users.length} people enrolled)`,
        },
      });
    } catch {
      dbUnreachable = true;
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
      persisted,
      attendanceRows,
      matched,
      unmatchedPunches,
      personnelCount: users.length,
      personnel: users.slice(0, 20),
      dbUnreachable,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
