import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentOrg, requireVerifiedEmail } from "@/lib/session";
import { generateApiKey, hashApiKey, lastFour, maskApiKey, DEFAULT_SCOPES, scopesToLabels } from "@/lib/apikey";
import { dbErrorMessage, logDbError } from "@/lib/db-error";

export const dynamic = "force-dynamic";

async function orgId(): Promise<string | null> {
  /* the signed-in user's tenant, falling back to the demo organization */
  const org = await currentOrg();
  return org?.id ?? null;
}

export async function GET() {
  let id: string | null;
  try {
    id = await orgId();
  } catch (e) {
    // DB down — degrade like every other page in the app, with a descriptive error.
    logDbError(e, "settings.api-keys.get");
    return NextResponse.json({ ok: true, keys: [], dbDown: true, error: dbErrorMessage(e) });
  }
  try {
    if (!id) return NextResponse.json({ ok: true, keys: [] });
    const keys = await db.apiKey.findMany({
      where: { organizationId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      ok: true,
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        masked: `${k.prefix}${new Array(24).fill("•").join("")}`,
        scopes: k.scopes,
        scopeLabels: scopesToLabels(k.scopes),
        isActive: k.isActive,
        lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
        createdAt: k.createdAt.toISOString(),
        rotatedAt: k.rotatedAt ? k.rotatedAt.toISOString() : null,
      })),
    });
  } catch (e) {
    logDbError(e, "settings.api-keys.get");
    return NextResponse.json({ ok: true, keys: [], dbDown: true, error: dbErrorMessage(e) });
  }
}

export async function POST(req: Request) {
  const gate = await requireVerifiedEmail();
  if (!gate.verified) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }
  try {
    const id = await orgId();
    if (!id) return NextResponse.json({ ok: false, error: "Organization not found" }, { status: 404 });
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "Scoped API key";
    const scopes = typeof body?.scopes === "string" && body.scopes.trim() ? body.scopes.trim() : DEFAULT_SCOPES;

    const key = generateApiKey();
    const created = await db.apiKey.create({
      data: {
        organizationId: id,
        name,
        keyHash: hashApiKey(key),
        lastFour: lastFour(key),
        scopes,
      },
    });
    await db.auditLog
      .create({
        data: {
          organizationId: id,
          userName: "Administrator",
          action: "ApiKey.Create",
          entityType: "ApiKey",
          entityId: created.id,
          details: `${name} (scopes: ${scopes})`,
        },
      })
      .catch(() => {});
    return NextResponse.json({
      ok: true,
      id: created.id,
      name: created.name,
      masked: maskApiKey(key),
      // full key returned exactly once — never persisted
      key,
      scopes,
      scopeLabels: scopesToLabels(scopes),
      createdAt: created.createdAt.toISOString(),
    });
  } catch (e) {
    logDbError(e, "settings.api-keys.create");
    return NextResponse.json({ ok: false, error: dbErrorMessage(e), dbDown: true }, { status: 503 });
  }
}