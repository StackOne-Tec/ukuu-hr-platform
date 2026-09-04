import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import AdminShell from "@/components/admin/AdminShell";
import { getReportsData, getAttendanceLogs } from "@/lib/queries";
import ReportGenerator from "@/components/reports/ReportGenerator";

export const metadata: Metadata = { title: "Report Generator · Ukuu HR" };

export default async function ReportGeneratorPage() {
  const [repRes, attRes] = await Promise.all([getReportsData(), getAttendanceLogs()]);
  return <ReportGenerator data={repRes.data} logs={attRes.data} />;
}