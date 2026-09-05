/**
 * Deployment platform configuration.
 *
 * The same codebase is deployed twice on Render:
 *   - admin  → ukuu-hr-admin-portal (no marketing landing page — starts at /login)
 *   - standard → ukuu-hr-platform (public marketing landing at /)
 *
 * Both deployments serve the full application (console dashboard, modules,
 * auth). `NEXT_PUBLIC_PLATFORM` is baked at build time and read by the
 * server (proxy) and the client (shell, auth screens).
 */
export type Platform = "admin" | "standard";

export const PLATFORM: Platform =
  process.env.NEXT_PUBLIC_PLATFORM === "admin" ? "admin" : "standard";

export const IS_ADMIN_PLATFORM = PLATFORM === "admin";

/** Where brand/home links should point on this deployment.
 *  The admin portal has no marketing landing — it starts at sign-in. */
export const HOME_HREF = IS_ADMIN_PLATFORM ? "/login" : "/";
