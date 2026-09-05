import { NextRequest, NextResponse } from "next/server";
import { PLATFORM } from "./lib/platform";

/**
 * Entry routing per deployment.
 * - admin (ukuu-hr-admin-portal): the marketing landing page is removed,
 *   so "/" redirects to sign-in. The rest of the app is served normally.
 * - standard (ukuu-hr-platform): the marketing landing page stays at "/".
 */
export default function proxy(req: NextRequest) {
  if (PLATFORM === "admin" && req.nextUrl.pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
