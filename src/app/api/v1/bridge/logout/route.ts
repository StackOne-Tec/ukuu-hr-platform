import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logDbError } from "@/lib/db-error";
import { extractApiKey } from "@/lib/apikey";
import { hashBridgeToken, BRIDGE_TOKEN_PREFIX } from "@/lib/bridge";

export const dynamic = "force-dynamic";

/*
 * POST /api/v1/bridge/logout
 * Ends the Bridge session presented as `Authorization: Bearer <token>`.
 * Best-effort by design: even if the database is unreachable the desktop app
 * must be able to sign out locally, so this always resolves ok:true.
 */
export async function POST(req: Request) {
  const token = extractApiKey(req);
  if (!token || !token.startsWith(BRIDGE_TOKEN_PREFIX)) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }
  await db.bridgeSession
    .deleteMany({ where: { tokenHash: hashBridgeToken(token) } })
    .catch((e) => {
      // Best-effort logout: the session row failing to delete is logged so
      // orphaned sessions are diagnosable, but the client always signs out.
      logDbError(e, "bridge.logout");
    });
  return NextResponse.json({ ok: true });
}
