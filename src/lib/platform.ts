/**
 * Deployment platform feature visibility.
 *
 * The same codebase is deployed twice on Render:
 *   - admin  → ukuu-hr-admin-portal (full HR console + platform admin + devices + settings/security)
 *   - standard → ukuu-hr-platform (public marketing + auth + the remaining modules)
 *
 * `NEXT_PUBLIC_PLATFORM` is baked at build time so both the server-side route
 * guard (proxy.ts) and the client-side shell (AdminShell) agree on the set of
 * features visible for the current deployment.
 */
export type Platform = "admin" | "standard";

export const PLATFORM: Platform =
  process.env.NEXT_PUBLIC_PLATFORM === "admin" ? "admin" : "standard";

export const IS_ADMIN_PLATFORM = PLATFORM === "admin";

/** Where brand/home links should point on this deployment.
 *  The admin portal has no marketing landing — it starts at sign-in. */
export const HOME_HREF = IS_ADMIN_PLATFORM ? "/login" : "/";

/** Top-level route prefixes that belong to the admin-only feature set. */
export const ADMIN_ONLY_PREFIXES = [
  "/dashboard",
  "/employees",
  "/attendance",
  "/leave",
  "/overtime",
  "/holidays",
  "/shifts",
  "/reports",
  "/devices",
  "/settings",
  "/security",
  "/super-admin",
] as const;

export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
