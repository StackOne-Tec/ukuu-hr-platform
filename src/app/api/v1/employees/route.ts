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
    if (!scopeAllows(auth.key.scopes, "employees")) {
      return NextResponse.json({ ok: false, error: "This API key does not include the employees scope." }, { status: 403 });
    }
    const employees = await db.employee.findMany({
      where: { organizationId: auth.organizationId },
      include: { department: true },
      orderBy: { employeeCode: "asc" },
    });
    return NextResponse.json({
      ok: true,
      count: employees.length,
      employees: employees.map((e) => ({
        id: e.id,
        employeeCode: e.employeeCode,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        phone: e.phone,
        position: e.position,
        department: e.department?.name ?? null,
        employmentType: e.employmentType,
        status: e.status,
        hireDate: e.hireDate.toISOString().slice(0, 10),
        basicSalary: e.basicSalary,
      })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: apiErrorMessage(e, "API temporarily unavailable.") }, { status: 503 });
  }
}