import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey, apiErrorMessage, scopesToLabels } from "@/lib/apikey";

export const dynamic = "force-dynamic";

const ENDPOINTS = [
  { method: "GET", path: "/api/v1", desc: "API index, key info and scopes" },
  { method: "GET", path: "/api/v1/employees", desc: "List employees" },
  { method: "GET", path: "/api/v1/attendance", desc: "List today's attendance" },
  { method: "GET", path: "/api/v1/payroll", desc: "List payroll runs" },
  { method: "GET", path: "/api/v1/leave", desc: "List leave requests" },
  { method: "GET", path: "/api/v1/devices", desc: "List attendance devices" },
  // Bridge desktop sync app (cloud sign-in flow)
  { method: "POST", path: "/api/v1/bridge/login", desc: "Sign in with cloud account — returns a session token + subscription state" },
  { method: "GET", path: "/api/v1/bridge/account", desc: "Account, subscription validity and device summary (session)" },
  { method: "GET", path: "/api/v1/bridge/devices", desc: "List already-added devices (session)" },
  { method: "POST", path: "/api/v1/bridge/devices", desc: "Register a new device (session)" },
  { method: "PATCH", path: "/api/v1/bridge/devices/{id}", desc: "Update a device + auto-upload config (session)" },
  { method: "POST", path: "/api/v1/bridge/sync", desc: "Upload retrieved device data — manual or auto (session)" },
  { method: "GET", path: "/api/v1/bridge/syncs", desc: "Recent sync-run history per device (session)" },
  { method: "GET", path: "/api/v1/bridge/attendance", desc: "Attendance rows for the dashboard (session)" },
  { method: "GET", path: "/api/v1/bridge/employees", desc: "Employee roster for device enrollment (session)" },
  { method: "POST", path: "/api/v1/bridge/logout", desc: "End the Bridge session" },
] as const;

export async function GET(req: Request) {
  try {
    const auth = await authenticateApiKey(req);
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid API key — send `Authorization: Bearer <key>` or `X-Api-Key: <key>`." },
        { status: 401 }
      );
    }
    const org = await db.organization.findUnique({ where: { id: auth.organizationId } });
    return NextResponse.json({
      ok: true,
      service: "Ukuu HR Platform API",
      organization: org?.name ?? "Unknown",
      key: { id: auth.key.id, name: auth.key.name, scopes: auth.key.scopes, scopeLabels: scopesToLabels(auth.key.scopes) },
      version: "v1",
      endpoints: ENDPOINTS,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: apiErrorMessage(e, "API temporarily unavailable.") }, { status: 503 });
  }
}