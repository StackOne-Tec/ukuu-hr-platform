import type { Metadata } from "next";
import { Geist } from "next/font/google";
import BridgeLogin from "@/components/bridge/BridgeLogin";
import "../../bridge.css";
/* the sign-in card reuses the cloud application's auth styling (au-*) so the
   bridge and the cloud share the same look, fields and credentials */
import "../../auth.css";

const geist = Geist({
  variable: "--font-bridge-geist",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bridge Gateway Login — Ukuu HR Access Sync",
  description:
    "Authenticate the local daemon session of the Ukuu HR Access Sync Bridge with your organization cloud credentials.",
};

/**
 * /bridge/login — the desktop application's authentication page.
 * Renders the full Bridge window (titlebar, daemon header, login card,
 * status footer) wired to POST /api/v1/bridge/login.
 */
export default function BridgeLoginPage() {
  return (
    <div className={geist.variable}>
      <BridgeLogin />
    </div>
  );
}