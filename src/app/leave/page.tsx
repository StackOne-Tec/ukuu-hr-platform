import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import LeaveView from "@/components/leave/LeaveView";
import { getLeave } from "@/lib/queries";

export const metadata: Metadata = { title: "Leave · Ukuu HR" };

export default async function LeavePage() {
  const res = await getLeave();
  return <LeaveView requests={res.data.requests} types={res.data.types} holidays={res.data.holidays} />;
}