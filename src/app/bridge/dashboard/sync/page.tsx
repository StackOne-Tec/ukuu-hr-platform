import type { Metadata } from "next";
import BridgeDashboard from "@/components/bridge/BridgeDashboard";

export const metadata: Metadata = {
  title: "Sync Activity — Bridge Dashboard — Ukuu HR Access Sync",
};

/**
 * /bridge/dashboard/sync — device → desktop → cloud upload history
 * (manual & auto sync runs).
 */
export default function BridgeSyncPage() {
  return <BridgeDashboard page="sync" />;
}