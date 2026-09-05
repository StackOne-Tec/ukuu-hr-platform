import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiErrorMessage } from "@/lib/apikey";
import { bridgeGuard } from "../guard";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/* GET /api/v1/bridge/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD&deviceId=…
   The rows the desktop dashboard shows after a sync. Defaults to today. Each
   row carries the employee code/name plus the check-in/check-out the device
   data produced (source "Device"). */
export async function GET(req: Request) {
  try {
    const g = await bridgeGuard(req);
    if (!g.ok) return g.response;
    const { ctx } = g;

    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const deviceId = url.searchParams.get("deviceId")?.trim() || null;

    const to = toParam ? new Date(toParam) : new Date();
    const from = fromParam ? new Date(fromParam) : dayStart(to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return NextResponse.json(
        { ok: false, error: "Invalid date range — use from=YYYY-MM-DD and to=YYYY-MM-DD." },
        { status: 400 }
      );
    }
    const start = dayStart(from);
    const end = new Date(Math.max(to.getTime(), start.getTime()) + DAY_MS);

    const where: Record<string, unknown> = {
      organizationId: ctx.organizationId,
      date: { gte: start, lt: end },
    };
    if (deviceId) {
      // Attendance rows don't store the device id — the import note records
      // which device produced them ("Imported from <name or ip>").
      const dev = await db.attendanceDevice.findFirst({
        where: { organizationId: ctx.organizationId, id: deviceId },
        select: { id: true, name: true, ipAddress: true },
      });
      if (!dev) {
        return NextResponse.json({ ok: false, error: "Device not found in this organization." }, { status: 404 });
      }
      const label = dev.name || dev.ipAddress || "";
      if (label) where.note = { contains: label };
    }

    const [rows, employees] = await Promise.all([
      db.attendance.findMany({
        where,
        orderBy: [{ date: "desc" }, { employeeId: "asc" }],
        take: 500,
      }) as Promise<Array<Record<string, any>>>,
      db.employee.findMany({
        where: { organizationId: ctx.organizationId },
        select: { id: true, employeeCode: true, firstName: true, lastName: true },
      }) as Promise<Array<Record<string, any>>>,
    ]);
    const empById = new Map(employees.map((e) => [e.id, e]));

    const hhmm = (d: Date | null) => (d ? d.toTimeString().slice(0, 5) : null);

    return NextResponse.json({
      ok: true,
      range: { from: start.toISOString().slice(0, 10), to: new Date(end.getTime() - DAY_MS).toISOString().slice(0, 10) },
      count: rows.length,
      attendance: rows.map((a) => {
        const emp = empById.get(a.employeeId);
        return {
          id: a.id,
          employeeCode: emp?.employeeCode ?? null,
          employeeName: emp ? `${emp.firstName} ${emp.lastName}` : null,
          date: a.date.toISOString().slice(0, 10),
          checkIn: hhmm(a.checkIn),
          checkOut: hhmm(a.checkOut),
          workedHours: Math.round(a.workedHours * 100) / 100,
          status: a.status,
          source: a.source,
          note: a.note,
        };
      }),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: apiErrorMessage(e, "Unable to load attendance right now.") },
      { status: 503 }
    );
  }
}
