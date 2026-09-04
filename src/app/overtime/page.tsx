import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import OvertimeView from "@/components/overtime/OvertimeView";
import { getOvertime } from "@/lib/queries";

export const metadata: Metadata = { title: "Overtime · Ukuu HR" };

export default async function OvertimePage() {
  const res = await getOvertime();
  return <OvertimeView records={res.data} />;
}