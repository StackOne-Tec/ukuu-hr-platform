import { NextRequest, NextResponse } from "next/server";
import { PLATFORM, isAdminOnlyPath } from "./lib/platform";

/**
 * Feature guard per deployment platform.
 *
 * On the standard (non-admin) platform the HR console, platform admin,
 * devices and settings/security modules are not offered: requests to those
 * routes are redirected to the public homepage instead.
 */
export default function proxy(req: NextRequest) {
  if (PLATFORM !== "standard") return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (isAdminOnlyPath(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/employees/:path*",
    "/attendance/:path*",
    "/leave/:path*",
    "/overtime/:path*",
    "/holidays/:path*",
    "/shifts/:path*",
    "/reports/:path*",
    "/devices/:path*",
    "/settings/:path*",
    "/security/:path*",
    "/super-admin/:path*",
  ],
};
