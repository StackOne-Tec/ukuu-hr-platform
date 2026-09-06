import type { Metadata } from "next";
import BridgeDashboard from "@/components/bridge/BridgeDashboard";

export const metadata: Metadata = {
  title: "Devices — Bridge Dashboard — Ukuu HR Access Sync",
};

/**
 * /bridge/dashboard/devices — registered attendance devices on the LAN and
 * the license-aware add-device form.
 */
export default function BridgeDevicesPage() {
  return <BridgeDashboard page="devices" />;
}