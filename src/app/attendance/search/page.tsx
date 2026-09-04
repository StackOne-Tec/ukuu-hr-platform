import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import AttendanceSearch from "@/components/attendance/AttendanceSearch";
import { getAttendanceLogs } from "@/lib/queries";

export const metadata: Metadata = { title: "Attendance Search · Ukuu HR" };

export default async function AttendanceSearchPage() {
  const res = await getAttendanceLogs();
  return <AttendanceSearch initial={res.data} />;
}