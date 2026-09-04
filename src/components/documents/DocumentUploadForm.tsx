"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

export default function DocumentUploadForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Contract");
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, fileName }),
      });
      const json = await res.json();
      if (json.ok) router.push("/documents");
      else alert(json.error ?? "Failed to upload");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bk-admin-card" style={{ maxWidth: 560 }}>
      <div className="bk-admin-card-content">
        <div
          style={{
            border: "2px dashed var(--bk-line-strong)", borderRadius: 16, padding: 40, textAlign: "center",
            background: "var(--bk-muted)", cursor: "pointer", marginBottom: 20,
          }}
        >
          <Upload size={28} style={{ color: "var(--bk-ink-3)" }} />
          <div style={{ fontWeight: 700, marginTop: 10, fontSize: 14 }}>Drop a file here or click to browse</div>
          <div className="bk-muted-text" style={{ marginTop: 4 }}>PDF, DOCX, XLSX or image · max 10 MB</div>
        </div>
        <div className="bk-field">
          <label className="bk-label">Title *</label>
          <input className="bk-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Employment Contract" />
        </div>
        <div className="bk-field">
          <label className="bk-label">Category</label>
          <select className="bk-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {["Contract", "Payslip", "ID", "Compliance", "Policy"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="bk-field">
          <label className="bk-label">File name</label>
          <input className="bk-input" value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="contract-2026.pdf" />
        </div>
        <button type="button" className="bk-btn bk-btn-primary" onClick={save} disabled={saving || !title} style={{ width: "100%" }}>
          <Upload size={16} /> {saving ? "Uploading…" : "Upload Document"}
        </button>
      </div>
    </div>
  );
}