"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { Users, KeyRound, UserPlus, Copy, RefreshCw, ShieldCheck, CheckCircle2 } from "lucide-react";

type SettingsData = {
  users: { id: string; name: string; email: string; role: string; isActive: boolean; lastLoginAt: string | null }[];
  apiKeys: { id: string; name: string; masked: string; scopes: string; scopeLabels: string[]; isActive: boolean; lastUsedAt: string | null; createdAt: string | null; rotatedAt: string | null }[];
};

const TABS = [
  ["users", "User Management", Users],
  ["api-keys", "API Keys", KeyRound],
] as const;

type ApiKeyRow = {
  id: string;
  name: string;
  masked: string;
  scopes: string;
  scopeLabels: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string | null;
  rotatedAt: string | null;
  revealed?: string; // full key, shown once right after create/rotate
};

export default function SettingsView({ data }: { data: SettingsData }) {
  const [tab, setTab] = useState("api-keys");
  const [keys, setKeys] = useState<ApiKeyRow[]>(data.apiKeys);
  const [users, setUsers] = useState<SettingsData["users"]>(data.users);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dbDown, setDbDown] = useState(false);

  /* invite-a-teammate (User Management) */
  const [showInvite, setShowInvite] = useState(false);
  const [invForm, setInvForm] = useState({ name: "", email: "", role: "Admin" });
  const [invBusy, setInvBusy] = useState(false);
  const [invError, setInvError] = useState("");
  const [invited, setInvited] = useState<{ name: string; email: string; tempPassword: string } | null>(null);

  const loadKeys = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/settings/api-keys");
      const json = await res.json();
      if (json.ok) {
        setKeys(json.keys ?? []);
        if (json.dbDown) {
          setDbDown(true);
          setError("");
        }
      } else {
        setDbDown(Boolean(json.dbDown));
        setError(json.dbDown ? "The database is temporarily unreachable — please try again in a moment." : json.error ?? "Failed to load API keys");
      }
    } catch {
      setError("Could not reach the API keys service.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "api-keys") loadKeys();
  }, [tab, loadKeys]);

  const copyText = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${what} copied to clipboard`);
    } catch {
      setNotice(`Copy failed — select the ${what.toLowerCase()} manually`);
    }
    setTimeout(() => setNotice(""), 2500);
  };

  const createKey = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/settings/api-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const json = await res.json();
      if (json.ok) {
        const row: ApiKeyRow = { id: json.id, name: json.name, masked: json.masked, scopes: json.scopes, scopeLabels: json.scopeLabels, isActive: true, lastUsedAt: null, createdAt: json.createdAt, rotatedAt: null, revealed: json.key };
        setKeys((k) => [row, ...k]);
        setNotice("New API key created — copy it now, it won’t be shown again");
      } else {
        setDbDown(Boolean(json.dbDown));
        setError(json.dbDown ? "The database is temporarily unreachable — please try again in a moment." : json.error ?? "Failed to create API key");
      }
    } catch {
      setError("Could not create API key.");
    } finally {
      setBusy(false);
      setTimeout(() => setNotice(""), 6000);
    }
  };

  const rotateKey = async (id: string) => {
    if (!window.confirm("Regenerate this API key? The old key will stop working immediately.")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/settings/api-keys/${id}`, { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        setKeys((ks) => ks.map((k) => (k.id === id ? { ...k, masked: json.masked, scopes: json.scopes, scopeLabels: json.scopeLabels, rotatedAt: json.rotatedAt, lastUsedAt: null, revealed: json.key } : k)));
        setNotice("API key regenerated — copy it now, it won’t be shown again");
      } else {
        setDbDown(Boolean(json.dbDown));
        setError(json.dbDown ? "The database is temporarily unreachable — please try again in a moment." : json.error ?? "Failed to regenerate API key");
      }
    } catch {
      setError("Could not regenerate API key.");
    } finally {
      setBusy(false);
      setTimeout(() => setNotice(""), 6000);
    }
  };

  const revokeKey = async (id: string) => {
    if (!window.confirm("Revoke this API key? Requests using it will be rejected immediately.")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/settings/api-keys/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        setKeys((ks) => ks.map((k) => (k.id === id ? { ...k, isActive: false } : k)));
        setNotice("API key revoked");
      } else {
        setDbDown(Boolean(json.dbDown));
        setError(json.dbDown ? "The database is temporarily unreachable — please try again in a moment." : json.error ?? "Failed to revoke API key");
      }
    } catch {
      setError("Could not revoke API key.");
    } finally {
      setBusy(false);
      setTimeout(() => setNotice(""), 2500);
    }
  };

  /* ── invite a new member into the workspace ── */
  const inviteUser = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (invBusy) return;
    setInvError("");
    setInvited(null);

    const name = invForm.name.trim();
    const email = invForm.email.trim();
    if (!name) {
      setInvError("Enter the invitee's full name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setInvError("Enter a valid email address.");
      return;
    }

    setInvBusy(true);
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role: invForm.role }),
      });
      const json = await res.json();
      if (json.ok) {
        setUsers((prev) => [json.user, ...prev]);
        setInvited({ name: json.user.name, email: json.user.email, tempPassword: json.tempPassword });
        setInvForm({ name: "", email: "", role: "Admin" });
      } else {
        setDbDown(Boolean(json.dbDown));
        setInvError(
          json.dbDown
            ? "The database is temporarily unreachable — please try again in a moment."
            : json.error ?? "Failed to send the invitation."
        );
      }
    } catch {
      setInvError("Could not reach the invite service.");
    } finally {
      setInvBusy(false);
    }
  };

  const openInvite = () => {
    setInvited(null);
    setInvError("");
    setShowInvite((v) => !v);
  };

  return (
    <AdminShell activeKey="settings">
      <div className="bk-admin-section-header" data-tour="page-settings">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Administration · configuration</div>
          <h1 className="bk-admin-h1">Settings</h1>
          <p className="bk-admin-sub">User accounts and the scoped API keys used for integrations.</p>
        </div>
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--bk-line)", marginBottom: 20, flexWrap: "wrap" }} data-tour="settings-tabs">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} type="button" onClick={() => setTab(key)} style={{
            padding: "10px 14px", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit",
            fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6,
            color: tab === key ? "var(--bk-accent)" : "var(--bk-ink-3)",
            borderBottom: tab === key ? "2px solid var(--bk-accent)" : "2px solid transparent", marginBottom: -1,
          }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bk-admin-empty" style={{ color: "var(--bk-accent-4)", marginBottom: 12, fontSize: 13 }}>
          {error.split("\n")[0].slice(0, 220)}
        </div>
      )}
      {notice && <div className="bk-admin-empty" style={{ color: "var(--bk-accent-3)", marginBottom: 12 }}>{notice}</div>}

      {tab === "users" && (
        <div className="bk-admin-card">
          <div className="bk-admin-card-header">
            <div>
              <h3>User accounts</h3>
              <p>People who can sign in to this workspace — invite teammates to join.</p>
            </div>
            <button type="button" className="bk-btn bk-btn-secondary" onClick={openInvite} disabled={invBusy}>
              <UserPlus size={15} /> {showInvite ? "Close" : "Invite user"}
            </button>
          </div>

          {invited ? (
            <div className="bk-admin-card-content" style={{ borderBottom: "1px solid var(--bk-line)" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ color: "#0b8a60", marginTop: 2 }}><CheckCircle2 size={20} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    Invite sent to {invited.email}
                  </div>
                  <div className="bk-muted-text" style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.5 }}>
                    They can sign in at the Ukuu HR sign-in page with their email and this temporary password.
                    An invitation email was also sent — share the password securely in case it doesn’t arrive.
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                    <input
                      className="bk-input bk-mono"
                      readOnly
                      value={invited.tempPassword}
                      style={{ maxWidth: 220, fontFamily: "ui-monospace, Menlo, monospace" }}
                      onFocus={(e) => e.target.select()}
                    />
                    <button type="button" className="bk-btn bk-btn-secondary" onClick={() => copyText(invited.tempPassword, "Temporary password")}>
                      <Copy size={14} /> Copy password
                    </button>
                    <button type="button" className="bk-btn bk-btn-secondary" onClick={() => { setInvited(null); setShowInvite(true); }}>
                      <UserPlus size={14} /> Invite another
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : showInvite ? (
            <form className="bk-admin-card-content" onSubmit={inviteUser} noValidate style={{ borderBottom: "1px solid var(--bk-line)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 16 }}>
                <div className="bk-field">
                  <label className="bk-label" htmlFor="inv-name">Full name</label>
                  <input
                    id="inv-name"
                    className="bk-input"
                    placeholder="Jane Mulenga"
                    value={invForm.name}
                    onChange={(e) => setInvForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="bk-field">
                  <label className="bk-label" htmlFor="inv-email">Email address</label>
                  <input
                    id="inv-email"
                    className="bk-input"
                    type="email"
                    placeholder="jane@company.com"
                    value={invForm.email}
                    onChange={(e) => setInvForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="bk-field">
                  <label className="bk-label" htmlFor="inv-role">Role</label>
                  <select
                    id="inv-role"
                    className="bk-input"
                    value={invForm.role}
                    onChange={(e) => setInvForm((f) => ({ ...f, role: e.target.value }))}
                  >
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="Employee">Employee</option>
                  </select>
                </div>
              </div>
              {invError && <div className="bk-muted-text" style={{ color: "var(--bk-accent-4)", fontSize: 12.5, marginTop: 10 }}>{invError}</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button type="submit" className="bk-btn bk-btn-primary" disabled={invBusy}>
                  <UserPlus size={15} /> {invBusy ? "Sending invite…" : "Send invite"}
                </button>
                <button type="button" className="bk-btn bk-btn-secondary" onClick={() => setShowInvite(false)} disabled={invBusy}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          <table className="bk-admin-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last login</th><th>Status</th></tr></thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={5} className="bk-admin-empty">No users yet — invite the first teammate to join this workspace.</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className="bk-admin-pill info" style={{ textTransform: "none" }}>{u.role}</span></td>
                  <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}</td>
                  <td><span className={`bk-admin-pill ${u.isActive ? "approved" : "inactive"}`}>{u.isActive ? "Active" : "Disabled"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "api-keys" && (
        <div className="bk-admin-card">
          <div className="bk-admin-card-header">
            <div>
              <h3>API keys</h3>
              <p>Scoped keys for integrations — send as <span className="bk-mono">Authorization: Bearer &lt;key&gt;</span></p>
            </div>
            <button type="button" className="bk-btn bk-btn-secondary" onClick={createKey} disabled={busy || dbDown}>
              <KeyRound size={15} /> New key
            </button>
          </div>
          <div className="bk-admin-card-content">
            {dbDown && (
              <div className="bk-admin-empty">API keys can’t be managed while the database is unreachable — they’ll reappear once it’s back.</div>
            )}
            {!dbDown && keys.length === 0 && !busy && (
              <div className="bk-admin-empty">No API keys yet — create one to start integrating.</div>
            )}
            {keys.map((k) => {
              return (
                <div key={k.id} className="bk-field" style={{ padding: "16px 0", borderBottom: "1px solid var(--bk-line)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <label className="bk-label" style={{ marginBottom: 0 }}>{k.name}</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {!k.isActive && <span className="bk-admin-pill inactive">Revoked</span>}
                      {k.lastUsedAt && <span className="bk-muted-text" style={{ fontSize: 12 }}>Last used {new Date(k.lastUsedAt).toLocaleString()}</span>}
                      {k.rotatedAt && <span className="bk-muted-text" style={{ fontSize: 12 }}>Rotated {new Date(k.rotatedAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input className="bk-input bk-mono" readOnly value={k.revealed ?? k.masked} style={{ flex: 1 }} onFocus={(e) => e.target.select()} />
                    {k.revealed && (
                      <button type="button" className="bk-btn bk-btn-secondary" title="Copy full key" onClick={() => copyText(k.revealed!, "API key")}>
                        <Copy size={15} /> Copy
                      </button>
                    )}
                    {k.isActive && !dbDown ? (
                      <>
                        <button type="button" className="bk-btn bk-btn-secondary" onClick={() => rotateKey(k.id)} disabled={busy}>
                          <RefreshCw size={15} /> Regenerate
                        </button>
                        <button type="button" className="bk-btn bk-btn-secondary" style={{ color: "var(--bk-accent)" }} onClick={() => revokeKey(k.id)} disabled={busy}>
                          Revoke
                        </button>
                      </>
                    ) : null}
                  </div>
                  {k.revealed && (
                    <div className="bk-muted-text" style={{ marginTop: 8, color: "var(--bk-accent-3)", fontWeight: 600 }}>
                      Copy this key now — it won’t be shown again.
                    </div>
                  )}
                  <div className="bk-muted-text" style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <ShieldCheck size={13} />
                    Scopes: {k.scopeLabels.join(" · ")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AdminShell>
  );
}