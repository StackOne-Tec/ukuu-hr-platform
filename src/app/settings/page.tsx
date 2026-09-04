import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import SettingsView from "@/components/settings/SettingsView";
import { getSettings } from "@/lib/queries";

export const metadata: Metadata = { title: "Settings · Ukuu HR" };

export default async function SettingsPage() {
  const res = await getSettings();
  return <SettingsView data={res.data} />;
}