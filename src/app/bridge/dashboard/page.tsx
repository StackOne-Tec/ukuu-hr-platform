import type { Metadata } from "next";
import { Geist } from "next/font/google";
import BridgeDashboard from "@/components/bridge/BridgeDashboard";
import "../../bridge.css";

const geist = Geist({
  variable: "--font-bridge-geist",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bridge Dashboard — Ukuu HR Access Sync",
  description:
    "The Bridge desktop app dashboard: registered attendance devices, sync activity, and device-synced attendance for your organization.",
};

/**
 * /bridge/dashboard — the desktop application's dashboard page.
 * Shown after a successful Bridge sign-in: registered devices, the
 * license-aware add-device form, manual/auto sync of retrieved device data,
 * sync-run history, and the attendance rows populated from synced punches.
 */
export default function BridgeDashboardPage() {
  return (
    <div className={geist.variable}>
      <BridgeDashboard />
    </div>
  );
}