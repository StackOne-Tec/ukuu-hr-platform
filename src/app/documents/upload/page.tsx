import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import AdminShell from "@/components/admin/AdminShell";
import DocumentUploadForm from "@/components/documents/DocumentUploadForm";

export const metadata: Metadata = { title: "Upload Document · Ukuu HR" };

export default async function UploadPage() {
  return (
    <AdminShell activeKey="documents">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Files · upload</div>
          <h1 className="bk-admin-h1">Upload Document</h1>
          <p className="bk-admin-sub">Contracts, payslips, IDs, compliance and policies.</p>
        </div>
      </div>
      <DocumentUploadForm />
    </AdminShell>
  );
}