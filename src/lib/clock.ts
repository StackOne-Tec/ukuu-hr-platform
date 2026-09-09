import "server-only";
import { db } from "@/lib/db";
import { eventLabel } from "@/lib/isapi";

/* Shared write-side of the device → cloud sync pipeline. Both callers hand
   over events they ALREADY retrieved from a device:
     • the web Import Attendance flow pulls them server-side (ISAPI), and
     • the Bridge desktop app pulls them from the LAN and uploads them here.

   Records can flow into the core Attendance system in two ways:
     • ingestClockEvents — write + roll up immediately (web ISAPI pull and the
       API-key import are user-initiated, so importing right away is right).
     • stageClockEvents — write as PENDING records only; the Import Attendance
       page then presents them in a selection GUI ("records synced from the
       Bridge") and the chosen ones are rolled up into Attendance on demand
       via rollupClockEvents. This is the Bridge desktop path: nothing enters
       the core attendance system until an admin selects it.

   Every event is logged to UnifiedClockEvent. Check-in/check-out punches whose
   employee code matches a record are rolled up into daily Attendance rows.
   Returns counts so the caller can report honestly — if the database is
   unreachable it reports dbUnreachable:true instead of claiming records were
   saved (device-side work always completes). */

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_START = 8 * 60; // standard day shift starts 08:00 → later is "Late"
const MINUTE_MS = 60 * 1000;

export type ClockEventInput = {
  employeeNo: string; // employee code as enrolled on the device ("" = no person)
  time: Date;
  kind: "check-in" | "check-out" | "verify" | "system";
  label?: string; // human label (device events carry it; bridge payloads may not)
  major?: number; // device event codes — present for ISAPI-origin events
  minor?: number;
  raw?: string | null;
};

export type IngestResult = {
  persisted: number; // new clock-event rows actually written
  attendanceRows: number; // daily attendance rows created (updates not counted)
  matched: number; // employees with at least one matched punch that day
  unmatchedPunches: number; // punches with no matching employee record
  dbUnreachable: boolean;
};

export type StageResult = {
  persisted: number; // new PENDING clock-event rows written
  dbUnreachable: boolean;
};

export type RollupResult = {
  attendanceRows: number;
  matched: number;
  unmatchedPunches: number;
  dbUnreachable: boolean;
};

function eventTypeOf(e: ClockEventInput): string {
  if (e.kind === "check-in") return e.label ?? "Check In";
  if (e.kind === "check-out") return e.label ?? "Check Out";
  const cap = e.kind === "verify" ? "Verify" : "System";
  // ISAPI-origin events carry major/minor codes → keep the legacy labels.
  if (e.major != null || e.minor != null) return `${cap} · ${eventLabel(e.major ?? 0, e.minor ?? 0)}`;
  return e.label ?? cap;
}

/* ── stage: dedupe against the clock-event log and write new rows ──
   `pending` marks rows that are waiting to be imported into Attendance. */
async function writeClockEventRows(opts: {
  organizationId: string | null;
  events: ClockEventInput[];
  pending: boolean;
  deviceRef?: { id: string | null } | null; // when set, device sync metadata is updated
  devicePassword?: string | null; // persist into the device record when provided
}): Promise<{ persisted: number; dbUnreachable: boolean }> {
  const result: { persisted: number; dbUnreachable: boolean } = { persisted: 0, dbUnreachable: false };
  const { events, organizationId } = opts;

  try {
    // ── Dedupe against clock events already in the log ──
    // Punches match on code + kind within the same minute (device clocks
    // jitter); system/verify events on code + kind at the exact second. This
    // keeps a re-import idempotent without dropping legitimate same-minute
    // heartbeats. Scoped to this org so codes never collide across tenants.
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
          where: { organizationId: organizationId ?? undefined, employeeCode: { in: codes }, eventTime: { gte: since } },
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
          organizationId,
          employeeCode: e.employeeNo || "SYS",
          deviceId: opts.deviceRef?.id ?? null,
          eventType: eventTypeOf(e),
          eventTime: e.time,
          raw: e.raw || null,
          pending: opts.pending,
          importedAt: opts.pending ? null : new Date(),
        })),
      });
      result.persisted = count;
    }

    if (opts.deviceRef?.id) {
      await db.attendanceDevice.update({
        where: { id: opts.deviceRef.id },
        data: {
          ...(opts.devicePassword ? { apiKey: opts.devicePassword } : {}),
          status: "Online",
          lastSyncAt: new Date(),
          lastError: null,
        },
      });
    }
  } catch {
    result.dbUnreachable = true;
  }

  return result;
}

/* ── rollup: turn check-in/check-out punches into daily Attendance rows ── */
export async function rollupClockEvents(opts: {
  organizationId: string | null;
  events: ClockEventInput[];
  sourceLabel: string; // device name or ip — appears in the attendance note
}): Promise<RollupResult> {
  const result: RollupResult = { attendanceRows: 0, matched: 0, unmatchedPunches: 0, dbUnreachable: false };
  const { events, organizationId } = opts;

  try {
    const employees = await db.employee.findMany({
      where: { organizationId: organizationId ?? "none" },
      select: { id: true, employeeCode: true },
    }) as Array<{ id: string; employeeCode: string }>;
    const empByCode = new Map(employees.map((e) => [e.employeeCode, e.id]));

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
        result.unmatchedPunches++;
        continue;
      }
      const key = `${empId}|${dayKey(e.time).getTime()}`;
      const cur = agg.get(key) ?? { empId, date: dayKey(e.time), in: null, out: null };
      if (e.kind === "check-in" && (!cur.in || e.time < cur.in)) cur.in = e.time;
      if (e.kind === "check-out" && (!cur.out || e.time > cur.out)) cur.out = e.time;
      agg.set(key, cur);
    }
    result.matched = [...agg.keys()].length;

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
        note: `Imported from ${opts.sourceLabel}`,
        reviewed: false,
      };
      if (existingAtt) {
        await db.attendance.update({ where: { id: existingAtt.id }, data: payload });
      } else {
        await db.attendance.create({
          data: { organizationId, employeeId: empId, date, ...payload },
        });
        result.attendanceRows++;
      }
    }
  } catch {
    result.dbUnreachable = true;
  }

  return result;
}

/* Stage events as PENDING — nothing reaches Attendance until the admin picks
   them in the Import Attendance GUI and calls the bridge import endpoint. */
export async function stageClockEvents(opts: {
  organizationId: string | null;
  events: ClockEventInput[];
  deviceRef?: { id: string | null } | null;
  devicePassword?: string | null;
}): Promise<StageResult> {
  return writeClockEventRows({ ...opts, pending: true });
}

/* Write + roll up immediately (user-initiated flows: web ISAPI pull, API-key
   import). Kept for those callers — Bridge sync now stages instead. */
export async function ingestClockEvents(opts: {
  organizationId: string | null;
  events: ClockEventInput[];
  sourceLabel: string; // device name or ip — appears in the attendance note
  deviceRef?: { id: string | null } | null;
  devicePassword?: string | null;
}): Promise<IngestResult> {
  const staged = await writeClockEventRows({ ...opts, pending: false });
  const rolled = await rollupClockEvents({
    organizationId: opts.organizationId,
    events: opts.events,
    sourceLabel: opts.sourceLabel,
  });
  return {
    persisted: staged.persisted,
    attendanceRows: rolled.attendanceRows,
    matched: rolled.matched,
    unmatchedPunches: rolled.unmatchedPunches,
    dbUnreachable: staged.dbUnreachable || rolled.dbUnreachable,
  };
}