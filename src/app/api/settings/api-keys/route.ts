import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDemoOrg } from "@/lib/org";
import { generateApiKey, hashApiKey, lastFour, maskApiKey, DEFAULT_SCOPES, scopesToLabels } from "@/lib/apikey";

export const dynamic = "force-dynamic";

const DB_DOWN = "The database is temporarily unreachable. Please try again in a moment.";

async function orgId(): Promise<string | null> {
  /* create the baseline organization if the DB was never seeded */
  const org = await ensureDemoOrg();
  return org?.id ?? null;
}

export async function GET() {
  let id: string | null;
  try {
    id = await orgId();
  } catch {
    // DB down — degrade like every other page in the app instead of leaking the raw error.
    return NextResponse.json({ ok: true, keys: [], dbDown: true, error: DB_DOWN });
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
  } catch {
    return NextResponse.json({ ok: true, keys: [], dbDown: true, error: DB_DOWN });
  }
}

export async function POST(req: Request) {
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
  } catch {
    return NextResponse.json({ ok: false, error: DB_DOWN, dbDown: true }, { status: 503 });
  }
}