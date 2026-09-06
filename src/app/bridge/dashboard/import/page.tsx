import type { Metadata } from "next";
import BridgeDashboard from "@/components/bridge/BridgeDashboard";

export const metadata: Metadata = {
  title: "Import — Bridge Dashboard — Ukuu HR Access Sync",
};

/**
 * /bridge/dashboard/import — write attendance records straight into the
 * shared database with a cloud API key.
 */
export default function BridgeImportPage() {
  return <BridgeDashboard page="import" />;
}