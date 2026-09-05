import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentOrg } from "@/lib/session";
import { generateApiKey, hashApiKey, lastFour, maskApiKey, scopesToLabels } from "@/lib/apikey";

export const dynamic = "force-dynamic";

const DB_DOWN = "The database is temporarily unreachable. Please try again in a moment.";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const existing = await db.apiKey.findUnique({ where: { id } });
    const org = await currentOrg();
    // Tenant isolation: only the owning organization may rotate its keys.
    if (!existing || existing.organizationId !== (org?.id ?? null)) {
      return NextResponse.json({ ok: false, error: "API key not found" }, { status: 404 });
    }

    const key = generateApiKey();
    const rotated = await db.apiKey.update({
      where: { id },
      data: {
        keyHash: hashApiKey(key),
        lastFour: lastFour(key),
        rotatedAt: new Date(),
        isActive: true,
        lastUsedAt: null,
      },
    });
    await db.auditLog
      .create({
        data: {
          organizationId: rotated.organizationId ?? null,
          userName: "Administrator",
          action: "ApiKey.Rotate",
          entityType: "ApiKey",
          entityId: rotated.id,
          details: rotated.name,
        },
      })
      .catch(() => {});
    return NextResponse.json({
      ok: true,
      id: rotated.id,
      name: rotated.name,
      masked: maskApiKey(key),
      // full key returned exactly once — never persisted
      key,
      scopes: rotated.scopes,
      scopeLabels: scopesToLabels(rotated.scopes),
      rotatedAt: rotated.rotatedAt?.toISOString() ?? null,
    });
  } catch {
    return NextResponse.json({ ok: false, error: DB_DOWN, dbDown: true }, { status: 503 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const existing = await db.apiKey.findUnique({ where: { id } });
    const org = await currentOrg();
    // Tenant isolation: only the owning organization may revoke its keys.
    if (!existing || existing.organizationId !== (org?.id ?? null)) {
      return NextResponse.json({ ok: false, error: "API key not found" }, { status: 404 });
    }
    await db.apiKey.update({ where: { id }, data: { isActive: false } });
    await db.auditLog
      .create({
        data: {
          organizationId: existing.organizationId ?? null,
          userName: "Administrator",
          action: "ApiKey.Delete",
          entityType: "ApiKey",
          entityId: existing.id,
          details: existing.name,
        },
      })
      .catch(() => {});
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: DB_DOWN, dbDown: true }, { status: 503 });
  }
}