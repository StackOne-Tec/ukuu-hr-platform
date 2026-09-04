import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiErrorMessage } from "@/lib/apikey";
import { bridgeGuard } from "../guard";

export const dynamic = "force-dynamic";

/* GET /api/v1/bridge/syncs?limit=50&deviceId=…
   Recent device ⇄ cloud upload runs (each POST /api/v1/bridge/sync records
   one). Lets the desktop dashboard populate its sync activity view — what was
   loaded from each device, when, and whether it was a manual upload or an
   automatic one on the sync interval. */
export async function GET(req: Request) {
  try {
    const g = await bridgeGuard(req);
    if (!g.ok) return g.response;
    const { ctx } = g;

    const url = new URL(req.url);
    const limitParam = Number(url.searchParams.get("limit") ?? 50);
    const limit = Number.isInteger(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;
    const deviceId = url.searchParams.get("deviceId")?.trim() || null;

    const runs = await db.syncRun.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(deviceId ? { deviceId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      ok: true,
      count: runs.length,
      syncs: runs.map((r) => ({
        id: r.id,
        deviceId: r.deviceId,
        deviceName: r.deviceName,
        mode: r.mode,
        received: r.received,
        persisted: r.persisted,
        attendanceRows: r.attendanceRows,
        matched: r.matched,
        unmatched: r.unmatched,
        ranAt: r.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: apiErrorMessage(e, "Unable to load sync history right now.") },
      { status: 503 }
    );
  }
}
