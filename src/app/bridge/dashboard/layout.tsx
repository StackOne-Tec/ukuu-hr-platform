import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist } from "next/font/google";
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
 * /bridge/dashboard — the desktop application's dashboard shell.
 * Each section is a real, deep-linkable route rendered by the shared
 * BridgeDashboard client component:
 *   /bridge/dashboard            → Devices (default)
 *   /bridge/dashboard/devices    → registered devices + add-device form
 *   /bridge/dashboard/sync       → device → desktop → cloud upload history
 *   /bridge/dashboard/attendance → attendance rows synced from devices
 *   /bridge/dashboard/import     → API-key direct attendance import
 */
export default function BridgeDashboardLayout({ children }: { children: ReactNode }) {
  return <div className={geist.variable}>{children}</div>;
}