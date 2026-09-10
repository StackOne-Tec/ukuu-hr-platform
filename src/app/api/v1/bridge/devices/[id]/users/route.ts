import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiErrorMessage } from "@/lib/apikey";
import { fetchDeviceUsers, upsertDeviceUser } from "@/lib/isapi";
import { bridgeGuard } from "../../../guard";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function credentials(body: Record<string, unknown>, password: string | null) {
  const username = typeof body.username === "string" && body.username.trim() ? body.username.trim() : "admin";
  return { username, password: typeof body.password === "string" ? body.password : password ?? undefined };
}

async function deviceFor(id: string, organizationId: string) {
  return db.attendanceDevice.findFirst({
    where: { id, organizationId },
    select: { id: true, name: true, ipAddress: true, port: true, apiKey: true },
  });
}

export async function GET(req: Request, { params }: Ctx) {
  try {
    const g = await bridgeGuard(req);
    if (!g.ok) return g.response;
    const device = await deviceFor((await params).id, g.ctx.organizationId);
    if (!device) return NextResponse.json({ ok: false, error: "Device not found in this organization." }, { status: 404 });
    if (!device.ipAddress) return NextResponse.json({ ok: false, error: "This device has no LAN IP address." }, { status: 400 });

    const url = new URL(req.url);
    const username = url.searchParams.get("username")?.trim() || "admin";
    const users = await fetchDeviceUsers({
      host: device.ipAddress,
      port: device.port,
      auth: { username, password: device.apiKey ?? undefined },
    });
    return NextResponse.json({ ok: true, device: { id: device.id, name: device.name }, users });
  } catch (e) {
    return NextResponse.json({ ok: false, error: apiErrorMessage(e, "Unable to read people from the device.", "v1.bridge.device.users.list") }, { status: 502 });
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const g = await bridgeGuard(req);
    if (!g.ok) return g.response;
    const device = await deviceFor((await params).id, g.ctx.organizationId);
    if (!device) return NextResponse.json({ ok: false, error: "Device not found in this organization." }, { status: 404 });
    if (!device.ipAddress) return NextResponse.json({ ok: false, error: "This device has no LAN IP address." }, { status: 400 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const employeeNo = typeof body?.employeeNo === "string" ? body.employeeNo.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!employeeNo || !name) return NextResponse.json({ ok: false, error: "Employee code and full name are required." }, { status: 400 });

    const auth = credentials(body ?? {}, device.apiKey);
    await upsertDeviceUser({ host: device.ipAddress, port: device.port, auth, user: { employeeNo, name } });

    const [firstName, ...lastParts] = name.split(/\s+/);
    const lastName = lastParts.join(" ") || firstName;
    const existing = await db.employee.findFirst({ where: { organizationId: g.ctx.organizationId, employeeCode: employeeNo } });
    const employee = existing
      ? await db.employee.update({ where: { id: existing.id }, data: { firstName, lastName, status: "Active" } })
      : await db.employee.create({
          data: {
            organizationId: g.ctx.organizationId,
            employeeCode: employeeNo,
            firstName,
            lastName,
            email: `${employeeNo.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@enrolled.ukuu.local`,
            position: "Enrolled from terminal",
            employmentType: "Full-time",
            status: "Active",
            hireDate: new Date(),
            salary: 0,
            basicSalary: 0,
          },
        });

    await db.attendanceDevice.update({ where: { id: device.id }, data: { status: "Online", lastSyncAt: new Date(), lastError: null, ...(typeof body?.password === "string" && body.password ? { apiKey: body.password } : {}) } });
    return NextResponse.json({ ok: true, employee: { id: employee.id, employeeCode, name: `${employee.firstName} ${employee.lastName}` }, synced: "device → cloud" }, { status: existing ? 200 : 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: apiErrorMessage(e, "Unable to enroll the employee on the device.", "v1.bridge.device.users.enroll") }, { status: 502 });
  }
}
