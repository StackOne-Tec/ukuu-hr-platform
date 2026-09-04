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
    if (!scopeAllows(auth.key.scopes, "devices")) {
      return NextResponse.json({ ok: false, error: "This API key does not include the devices scope." }, { status: 403 });
    }

    const devices = await db.attendanceDevice.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      ok: true,
      count: devices.length,
      devices: devices.map((d) => ({
        id: d.id,
        name: d.name,
        vendor: d.vendor,
        model: d.model,
        ipAddress: d.ipAddress,
        integrationMode: d.integrationMode,
        status: d.status,
        isActive: d.isActive,
        lastSyncAt: d.lastSyncAt ? d.lastSyncAt.toISOString() : null,
      })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: apiErrorMessage(e, "API temporarily unavailable.") }, { status: 503 });
  }
}