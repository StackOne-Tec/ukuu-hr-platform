import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logDbError } from "@/lib/db-error";
import { currentOrg, getWebSession } from "@/lib/session";
import { rollupClockEvents, type ClockEventInput } from "@/lib/clock";
import { createNotification } from "@/lib/notify";

export const dynamic = "force-dynamic";

/* Firestore `in` clauses cap at 30 values — chunk selections. */
const IN_BATCH = 30;

function kindOf(type: string | null | undefined): ClockEventInput["kind"] {
  const t = type ?? "";
  if (t === "Check In") return "check-in";
  if (t === "Check Out") return "check-out";
  if (t.startsWith("Verify")) return "verify";
  return "system";
}

/*
 * POST /api/attendance/import/bridge
 *
 * Import the user-SELECTED pending records that the Bridge desktop app synced
 * up (see POST /api/v1/bridge/sync, which stages them with pending: true).
 * The chosen check-in/check-out punches are rolled up into daily Attendance
 * rows, and the records are marked imported so the review list drains.
 *
 * Body: { eventIds: string[] } — ids of the pending UnifiedClockEvent rows the
 * admin picked in the Import Attendance GUI.
 *
 * Returns: { ok, imported (attendance rows created), matched,
 *            unmatchedPunches, eventsProcessed, dbUnreachable }
 */
export async function POST(req: Request) {
  try {
    const session = await getWebSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: "Sign in to import records." }, { status: 401 });
    }
    const org = await currentOrg();
    const organizationId = org?.id ?? null;
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: "No workspace is associated with this account." },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => null)) as { eventIds?: unknown } | null;
    const rawIds = Array.isArray(body?.eventIds) ? body.eventIds : [];
    const eventIds = [...new Set(rawIds.filter((v): v is string => typeof v === "string"))];
    if (eventIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Select at least one record to import." },
        { status: 400 }
      );
    }

    // Fetch the selected records (ids are globally unique cuids — scope-check
    // org + pending in memory for defense-in-depth).
    const rows: Array<{
      id: string;
      organizationId?: string | null;
      employeeCode: string;
      eventType: string | null;
      eventTime: Date;
      pending?: boolean;
    }> = [];
    for (let i = 0; i < eventIds.length; i += IN_BATCH) {
      const batch = eventIds.slice(i, i + IN_BATCH);
      const found = await db.unifiedClockEvent.findMany({
        where: { id: { in: batch } },
        select: { id: true, organizationId: true, employeeCode: true, eventType: true, eventTime: true, pending: true },
      });
      rows.push(...found);
    }
    const selected = rows.filter(
      (r) => r.organizationId === organizationId && r.pending === true
    );
    if (selected.length === 0) {
      return NextResponse.json(
        { ok: true, imported: 0, matched: 0, unmatchedPunches: 0, eventsProcessed: 0, message: "No pending records matched your selection." },
        { status: 200 }
      );
    }

    const events: ClockEventInput[] = selected.map((r) => ({
      employeeNo: r.employeeCode === "SYS" ? "" : r.employeeCode,
      time: r.eventTime,
      kind: kindOf(r.eventType),
    }));

    const rolled = await rollupClockEvents({
      organizationId,
      events,
      sourceLabel: "Bridge",
    });

    // Drain the review list: mark every imported record as no longer pending.
    await Promise.all(
      selected.map((r) =>
        db.unifiedClockEvent
          .update({ where: { id: r.id }, data: { pending: false, importedAt: new Date() } })
          .catch(() => {})
      )
    );

    if (!rolled.dbUnreachable && rolled.unmatchedPunches > 0) {
      await createNotification({
        organizationId,
        title: "Import warning",
        message: `${rolled.unmatchedPunches} imported record(s) could not be matched to an employee code.`,
      });
    }
    if (!rolled.dbUnreachable) {
      await db.auditLog
        .create({
          data: {
            organizationId,
            userName: "system",
            action: "AttendanceImport.Bridge",
            entityType: "UnifiedClockEvent",
            details: `${selected.length} record(s) imported from the Bridge (${rolled.attendanceRows} attendance rows, ${rolled.unmatchedPunches} unmatched)`,
          },
        })
        .catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      imported: rolled.attendanceRows,
      matched: rolled.matched,
      unmatchedPunches: rolled.unmatchedPunches,
      eventsProcessed: selected.length,
      dbUnreachable: rolled.dbUnreachable,
    });
  } catch (e) {
    logDbError(e, "attendance.import.bridge");
    return NextResponse.json(
      { ok: false, error: "Unable to import the selected records." },
      { status: 502 }
    );
  }
}