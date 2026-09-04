import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey, apiErrorMessage, scopeAllows } from "@/lib/apikey";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await authenticateApiKey(req);
    if (!auth) {
      return NextResponse.json({ ok: false, error: "Missing or invalid API key." }, { status: 401 });
    }
    if (!scopeAllows(auth.key.scopes, "attendance")) {
      return NextResponse.json({ ok: false, error: "This API key does not include the attendance scope." }, { status: 403 });
    }

    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const day = dateParam ? new Date(dateParam) : new Date();
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const [rows, employees] = await Promise.all([
      db.attendance.findMany({
        where: { organizationId: auth.organizationId, date: { gte: start, lt: end } },
        orderBy: { checkIn: "asc" },
      }),
      db.employee.findMany({ where: { organizationId: auth.organizationId } }),
    ]);

    return NextResponse.json({
      ok: true,
      date: start.toISOString().slice(0, 10),
      count: rows.length,
      records: rows.map((a) => ({
        id: a.id,
        employeeCode: employees.find((e) => e.id === a.employeeId)?.employeeCode ?? "",
        employeeName: (employees.find((e) => e.id === a.employeeId)?.firstName ?? "") + " " + (employees.find((e) => e.id === a.employeeId)?.lastName ?? ""),
        status: a.status,
        checkIn: a.checkIn ? a.checkIn.toTimeString().slice(0, 5) : null,
        checkOut: a.checkOut ? a.checkOut.toTimeString().slice(0, 5) : null,
        hours: Math.round(a.workedHours * 10) / 10,
        shiftName: a.shiftName,
        source: a.source,
      })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: apiErrorMessage(e, "API temporarily unavailable.") }, { status: 503 });
  }
}