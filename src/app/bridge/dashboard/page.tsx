import type { Metadata } from "next";
import BridgeDashboard from "@/components/bridge/BridgeDashboard";

export const metadata: Metadata = {
  title: "Devices — Bridge Dashboard — Ukuu HR Access Sync",
};

/**
 * /bridge/dashboard — default landing route after a Bridge sign-in.
 * Renders the Devices page (registered devices + add-device form); the
 * canonical deep-link URL is /bridge/dashboard/devices.
 */
export default function BridgeDashboardPage() {
  return <BridgeDashboard page="devices" />;
}