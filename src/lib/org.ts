import "server-only";
import { db } from "@/lib/db";

/**
 * Most of the app scopes data to the "ukuuhr-demo" organization. If the
 * database is unseeded that organization doesn't exist yet, which surfaces as
 * "Organization not found" errors. Calling this before scoped operations
 * creates the baseline organization once, so the app works on a fresh DB.
 */
export async function ensureDemoOrg() {
  try {
    return await db.organization.upsert({
      where: { slug: "ukuuhr-demo" },
      update: {},
      create: {
        slug: "ukuuhr-demo",
        name: "UkuuHR Demo Ltd",
        email: "admin@ukuuhr.demo",
      },
    });
  } catch {
    // DB unreachable — callers already degrade gracefully.
    return null;
  }
}
