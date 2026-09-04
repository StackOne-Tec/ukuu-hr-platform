import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { getDocuments } from "@/lib/queries";
import { FileText, Upload, FolderOpen } from "lucide-react";

export const metadata: Metadata = { title: "Documents · Ukuu HR" };

const CATS = ["Contract", "Payslip", "ID", "Compliance", "Policy"];
const CAT_COLORS: Record<string, string> = {
  Contract: "#7B2FBE", Payslip: "#14a37f", ID: "#2563EB", Compliance: "#e85d75", Policy: "#d89c11",
};

export default async function DocumentsPage() {
  const res = await getDocuments();
  const { documents, policies } = res.data;

  return (
    <AdminShell activeKey="documents">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Files · employee records</div>
          <h1 className="bk-admin-h1">Documents</h1>
          <p className="bk-admin-sub">Contracts, payslips, IDs, compliance and policies.</p>
        </div>
        <div className="bk-admin-actions">
          <Link href="/documents/upload" className="bk-btn bk-btn-primary"><Upload size={16} /> Upload</Link>
        </div>
      </div>

      {/* category cards */}
      <div className="bk-admin-kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {CATS.map((cat) => (
          <div key={cat} className="bk-admin-kpi-card">
            <div className="bk-admin-kpi-card-top">
              <div className="bk-admin-kpi-icon" style={{ background: `${CAT_COLORS[cat]}18`, color: CAT_COLORS[cat] }}><FolderOpen size={20} /></div>
            </div>
            <div className="bk-admin-kpi-value" style={{ fontSize: 24 }}>{documents.filter((d) => d.category === cat).length}</div>
            <div className="bk-admin-kpi-label">{cat}</div>
          </div>
        ))}
      </div>

      <div className="bk-admin-card" style={{ marginBottom: 24 }}>
        <div className="bk-admin-card-header"><h3>All documents</h3></div>
        <table className="bk-admin-table">
          <thead>
            <tr><th>Title</th><th>Category</th><th>File</th><th>Size</th><th>Uploaded</th></tr>
          </thead>
          <tbody>
            {documents.length === 0 && <tr><td colSpan={5} className="bk-admin-empty">No documents yet.</td></tr>}
            {documents.map((d) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 600 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FileText size={16} style={{ color: "var(--bk-ink-3)" }} /> {d.title}
                  </span>
                </td>
                <td><span className="bk-admin-pill" style={{ background: `${CAT_COLORS[d.category] ?? "#7B2FBE"}18`, color: CAT_COLORS[d.category] ?? "#7B2FBE", textTransform: "none" }}>{d.category}</span></td>
                <td className="bk-mono" style={{ color: "var(--bk-ink-3)" }}>{d.fileName}</td>
                <td className="bk-mono">{d.fileSize > 0 ? `${Math.round(d.fileSize / 1024)} KB` : "—"}</td>
                <td>{d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bk-admin-card">
        <div className="bk-admin-card-header"><h3>Organization policies</h3></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, padding: 24 }}>
          {policies.length === 0 && <div className="bk-admin-empty" style={{ gridColumn: "1 / -1" }}>No policies published.</div>}
          {policies.map((p) => (
            <div key={p.id} style={{ padding: 18, borderRadius: 14, background: "var(--bk-muted)", border: "1px solid var(--bk-line)" }}>
              <span className="bk-admin-pill info" style={{ textTransform: "none" }}>{p.category}</span>
              <div style={{ fontWeight: 800, fontSize: 14.5, marginTop: 10 }}>{p.title}</div>
              <p style={{ fontSize: 12.5, color: "var(--bk-ink-2)", lineHeight: 1.55, margin: "8px 0 0" }}>{p.content}</p>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}