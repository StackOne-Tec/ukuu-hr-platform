import type { Metadata } from "next";
import { getDevices, getClockEvents } from "@/lib/queries";
import ImportAttendance from "@/components/attendance/ImportAttendance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Import Attendance · Ukuu HR" };

export default async function ImportAttendancePage() {
  const [devRes, evRes] = await Promise.all([getDevices(), getClockEvents()]);
  const devices = devRes.data
    .filter((d) => d.status === "Online" || d.integrationMode === "REST")
    .map((d) => ({ id: d.id, name: d.name, vendor: d.vendor, model: d.model, ipAddress: d.ipAddress }));
  const recentEvents = evRes.data.slice(0, 8);
  return <ImportAttendance devices={devices} recentEvents={recentEvents} />;
}