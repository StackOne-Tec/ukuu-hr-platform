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
    if (!scopeAllows(auth.key.scopes, "leave")) {
      return NextResponse.json({ ok: false, error: "This API key does not include the leave scope." }, { status: 403 });
    }

    const [requests, employees] = await Promise.all([
      db.leaveRequest.findMany({
        where: { organizationId: auth.organizationId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.employee.findMany({ where: { organizationId: auth.organizationId } }),
    ]);

    return NextResponse.json({
      ok: true,
      count: requests.length,
      requests: requests.map((l) => ({
        id: l.id,
        employeeCode: employees.find((e) => e.id === l.employeeId)?.employeeCode ?? "",
        employeeName: (employees.find((e) => e.id === l.employeeId)?.firstName ?? "") + " " + (employees.find((e) => e.id === l.employeeId)?.lastName ?? ""),
        type: l.type,
        startDate: l.startDate.toISOString().slice(0, 10),
        endDate: l.endDate.toISOString().slice(0, 10),
        days: l.daysUsed,
        status: l.status,
        reason: l.reason,
      })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: apiErrorMessage(e, "API temporarily unavailable.") }, { status: 503 });
  }
}