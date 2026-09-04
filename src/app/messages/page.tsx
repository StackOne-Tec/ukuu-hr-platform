import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import AdminShell from "@/components/admin/AdminShell";
import { getMessages } from "@/lib/queries";

export const metadata: Metadata = { title: "Messages · Ukuu HR" };

export default async function MessagesPage() {
  const res = await getMessages();
  const conversations = res.data;

  return (
    <AdminShell activeKey="messages">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Inbox · team conversations</div>
          <h1 className="bk-admin-h1">Messages</h1>
          <p className="bk-admin-sub">Conversation list with sent/received thread UI.</p>
        </div>
      </div>

      <div className="bk-admin-grid-2" style={{ gridTemplateColumns: "320px 1fr" }}>
        {/* conversation list */}
        <div className="bk-admin-card">
          <div className="bk-admin-card-header"><h3>Conversations</h3></div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {conversations.length === 0 && <div className="bk-admin-empty">No conversations.</div>}
            {conversations.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid var(--bk-line)", cursor: "pointer", background: "rgba(123,47,190,.04)" }}>
                <span className="bk-admin-avatar pink">{c.participant.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.participant}</div>
                  <div style={{ fontSize: 12, color: "var(--bk-ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.messages[c.messages.length - 1]?.content ?? ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* thread */}
        <div className="bk-admin-card">
          <div className="bk-admin-card-header">
            <h3>{conversations[0]?.participant ?? "Select a conversation"}</h3>
            <span className="bk-muted-text">{conversations[0]?.title}</span>
          </div>
          <div style={{ padding: 24, minHeight: 360, display: "flex", flexDirection: "column", gap: 14 }}>
            {conversations[0]?.messages.map((m) => (
              <div key={m.id} style={{ alignSelf: m.isSent ? "flex-end" : "flex-start", maxWidth: "70%" }}>
                <div style={{
                  padding: "12px 16px", borderRadius: 16,
                  background: m.isSent ? "linear-gradient(135deg,#7B2FBE,#6A24A8)" : "var(--bk-muted)",
                  color: m.isSent ? "#fff" : "var(--bk-ink)",
                  fontSize: 13.5, lineHeight: 1.5,
                  borderBottomRightRadius: m.isSent ? 4 : 16,
                  borderBottomLeftRadius: m.isSent ? 16 : 4,
                }}>
                  {m.content}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--bk-ink-3)", marginTop: 4, textAlign: m.isSent ? "right" : "left" }}>
                  {m.senderName} · {m.sentAt ? new Date(m.sentAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }) : ""}
                </div>
              </div>
            ))}
            {conversations.length === 0 && <div className="bk-admin-empty">No thread selected.</div>}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}