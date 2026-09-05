import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import AdminShell from "@/components/admin/AdminShell";
import { CouponsPanel } from "@/components/platform/PlatformAccountDashboard";
import { getPlatformAccountData } from "@/lib/queries";
import { KeyRound } from "lucide-react";

export const metadata: Metadata = { title: "Access Codes · Ukuu HR" };

export default async function AccessCodesPage() {
  const res = await getPlatformAccountData();

  return (
    <AdminShell activeKey="access-codes">
      <div className="bk-admin-section-header" data-tour="page-access-codes">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Platform · subscription codes</div>
          <h1 className="bk-admin-h1">Access Codes</h1>
          <p className="bk-admin-sub">Issue single-use access codes that unlock workspaces and their subscription plans.</p>
        </div>
        <div className="bk-admin-actions">
          <span className="bk-admin-pill active" style={{ textTransform: "none" }}><KeyRound size={12} /> {res.data.coupons.filter((c) => c.status === "Active" && !c.redeemedAt).length} available</span>
        </div>
      </div>
      <CouponsPanel coupons={res.data.coupons} />
    </AdminShell>
  );
}