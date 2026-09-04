import { NextResponse } from "next/server";
import { authenticateBridge, loadSubscription, type SubscriptionInfo } from "@/lib/bridge";

export const dynamic = "force-dynamic";

export type BridgeCtx = {
  organizationId: string;
  subscription: SubscriptionInfo;
};

export type GuardResult = { ok: true; ctx: BridgeCtx } | { ok: false; response: NextResponse };

/* Shared gate for the Bridge endpoints: the caller must present a valid
   Bridge session token AND belong to an organization with a valid
   subscription (the “check subscription is valid” step, enforced server-side). */
export async function bridgeGuard(req: Request): Promise<GuardResult> {
  const session = await authenticateBridge(req);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Not signed in — call POST /api/v1/bridge/login first." },
        { status: 401 }
      ),
    };
  }
  const loaded = await loadSubscription(session.organizationId);
  if (!loaded) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Your organization could not be found. Contact your administrator." },
        { status: 404 }
      ),
    };
  }
  if (!loaded.subscription.valid) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: loaded.subscription.reason, subscription: loaded.subscription },
        { status: 403 }
      ),
    };
  }
  return { ok: true, ctx: { organizationId: session.organizationId, subscription: loaded.subscription } };
}
