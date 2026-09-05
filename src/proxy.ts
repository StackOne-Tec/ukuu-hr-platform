import { NextRequest, NextResponse } from "next/server";
import { PLATFORM } from "./lib/platform";

/**
 * Entry and area routing per deployment.
 * - admin (ukuu-hr-admin-portal): the marketing landing page is removed,
 *   so "/" redirects to sign-in. Full app including Platform Admin.
 * - standard (ukuu-hr-platform): the marketing landing page stays at "/",
 *   but the Platform Admin (super-admin) area is admin-portal only.
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
    return NextResponse.next();
  }

  /* standard platform: super-admin area is not available */
  if (pathname === "/super-admin" || pathname.startsWith("/super-admin/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/super-admin/:path*"],
};
