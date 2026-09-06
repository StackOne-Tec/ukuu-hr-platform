import { NextRequest, NextResponse } from "next/server";
import { PLATFORM } from "./lib/platform";

/**
 * Entry/area routing per deployment + cache-busting for HTML responses.
 *
 * Routes:
 * - admin (ukuu-hr-admin-portal): the marketing landing page is removed,
 *   so "/" redirects to sign-in. Full app including Platform Admin.
 * - standard (ukuu-hr-platform): marketing landing stays at "/", but the
 *   Platform Admin (super-admin) area is admin-portal only.
 *
 * Cache busting:
 * HTML responses are never cached (no-store), so every redeploy is picked up
 * immediately — no stale page shells referencing old hashed bundles. Hashed
 * assets under /_next/static keep their long-lived caching.
 */
export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PLATFORM === "admin") {
    if (pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    // Workspace sign-ups belong to the public product; the admin console is
    // an operator area, so its auth surface is sign-in only.
    if (pathname === "/signup" || pathname.startsWith("/signup/")) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  } else if (
    pathname === "/super-admin" ||
    pathname.startsWith("/super-admin/") ||
    pathname === "/access-codes" ||
    pathname.startsWith("/access-codes/")
  ) {
    // Platform-level pages (tenant lists, coupon pool) are admin-portal only.
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  if ((req.headers.get("accept") ?? "").includes("text/html")) {
    res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
    const build =
      process.env.RENDER_GIT_COMMIT ||
      process.env.SOURCE_VERSION ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      "dev";
    if (build) res.headers.set("X-Ukuu-Build", build);
  }
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
