import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiErrorMessage } from "@/lib/apikey";
import { bridgeGuard } from "../guard";

export const dynamic = "force-dynamic";

/* GET /api/v1/bridge/employees?q=…
   The employee roster the desktop app pulls from the cloud (the return path in
   the device ⇄ desktop ⇄ cloud flow): employee codes must be enrolled on the
   LAN devices for punches to carry an identity, and the desktop needs the
   code → name mapping to display and upload data. Optional q filters by name
   or code. */
export async function GET(req: Request) {
  try {
    const g = await bridgeGuard(req);
    if (!g.ok) return g.response;
    const { ctx } = g;

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim().toLowerCase() || null;

    const employees = await db.employee.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(q
          ? {
              OR: [
                { employeeCode: { contains: q, mode: "insensitive" } },
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { department: { select: { name: true } } },
      orderBy: [{ status: "asc" }, { firstName: "asc" }],
      take: 500,
    });

    return NextResponse.json({
      ok: true,
      count: employees.length,
      employees: employees.map((e) => ({
        id: e.id,
        employeeCode: e.employeeCode,
        name: `${e.firstName} ${e.lastName}`,
        email: e.email,
        position: e.position,
        department: e.department?.name ?? null,
        status: e.status,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: apiErrorMessage(e, "Unable to load employees right now.") },
      { status: 503 }
    );
  }
}
