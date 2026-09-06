import type { Metadata } from "next";
import BridgeDashboard from "@/components/bridge/BridgeDashboard";

export const metadata: Metadata = {
  title: "Attendance — Bridge Dashboard — Ukuu HR Access Sync",
};

/**
 * /bridge/dashboard/attendance — attendance rows populated from punches
 * synced by the desktop app.
 */
export default function BridgeAttendancePage() {
  return <BridgeDashboard page="attendance" />;
}