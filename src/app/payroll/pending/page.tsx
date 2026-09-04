import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import PayrollPendingApprovals from "@/components/payroll/PayrollPendingApprovals";
import { getPayroll } from "@/lib/queries";

export const metadata: Metadata = { title: "Pending Approvals · Ukuu HR" };

export default async function PendingPage() {
  const res = await getPayroll();
  const draft = res.data.find((r) => r.status === "Draft") ?? res.data[0];
  return <PayrollPendingApprovals items={draft?.items ?? []} runLabel={draft?.periodLabel ?? "Payroll"} />;
}