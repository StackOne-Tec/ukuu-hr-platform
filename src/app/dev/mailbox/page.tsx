"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Inbox, Loader2, Mail, RefreshCw, Search, ExternalLink } from "lucide-react"

type MailSummary = {
  id: string
  toEmail: string
  subject: string
  provider: string
  status: string
  error: string | null
  createdAt: string
}

type MailFull = MailSummary & { html: string }

const STYLES = `
.mb-root { min-height: 100dvh; background: #f6f4fa; font-family: 'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;
  color: #1a1a2e; display: flex; flex-direction: column; }
.mb-bar { background: #171226; color: #fff; padding: 14px 22px; display: flex; align-items: center;
  gap: 14px; flex-wrap: wrap; }
.mb-logo { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center;
  background: linear-gradient(135deg,#7b2fbe,#6a24a8); font-weight: 800; font-size: 15px; }
.mb-title { font-weight: 800; font-size: 14px; letter-spacing: .02em; }
.mb-title small { display: block; font-weight: 500; font-size: 10.5px; color: #b9b2d4; letter-spacing: .06em; }
.mb-mode { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.mb-chip { font-size: 11px; font-weight: 700; padding: 5px 11px; border-radius: 99px;
  background: rgba(123,47,190,.25); color: #d9c6ff; border: 1px solid rgba(123,47,190,.45); }
.mb-refresh { border: 0; background: rgba(255,255,255,.09); color: #fff; border-radius: 9px;
  padding: 7px 13px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 7px; }
.mb-refresh:hover { background: rgba(255,255,255,.16); }
.mb-refresh.spin svg { animation: mb-rot 1s linear infinite; }
@keyframes mb-rot { to { transform: rotate(360deg); } }
.mb-body { flex: 1; display: grid; grid-template-columns: 360px 1fr; min-height: 0;
  max-width: 1280px; width: 100%; margin: 0 auto; gap: 18px; padding: 18px 22px; box-sizing: border-box; }
.mb-list { background: #fff; border: 1px solid #ece8f4; border-radius: 16px; overflow: hidden;
  display: flex; flex-direction: column; min-height: 320px; }
.mb-list-h { padding: 13px 16px; font-size: 12px; font-weight: 800; letter-spacing: .08em;
  color: #8b87a0; border-bottom: 1px solid #f0ecf7; display: flex; align-items: center; gap: 8px; }
.mb-scroll { overflow-y: auto; flex: 1; }
.mb-item { padding: 13px 16px; border-bottom: 1px solid #f4f0fa; cursor: pointer; transition: background .12s; }
.mb-item:hover { background: #faf8ff; }
.mb-item.on { background: #f4eefc; box-shadow: inset 3px 0 0 #7b2fbe; }
.mb-sub { font-size: 13.5px; font-weight: 700; margin: 0 0 3px; }
.mb-to { font-size: 12px; color: #6d6885; margin: 0 0 7px; }
.mb-meta { display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
.mb-tag { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 99px; }
.mb-tag.captured { background: #f1e8fc; color: #7b2fbe; }
.mb-tag.sent { background: #e8f7ee; color: #17954c; }
.mb-tag.failed { background: #fdeeee; color: #c23b3b; }
.mb-time { font-size: 10.5px; color: #a29dbb; margin-left: auto; }
.mb-empty { padding: 46px 20px; text-align: center; color: #8b87a0; font-size: 13px; line-height: 1.7; }
.mb-preview { background: #fff; border: 1px solid #ece8f4; border-radius: 16px; display: flex;
  flex-direction: column; min-height: 320px; overflow: hidden; }
.mb-prev-h { padding: 15px 18px; border-bottom: 1px solid #f0ecf7; }
.mb-prev-sub { font-size: 15.5px; font-weight: 800; margin: 0 0 5px; }
.mb-prev-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #6d6885; flex-wrap: wrap; }
.mb-links { padding: 12px 18px; border-bottom: 1px solid #f0ecf7; display: flex; gap: 9px; flex-wrap: wrap; }
.mb-linkbtn { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700;
  padding: 7px 13px; border-radius: 9px; border: 1px solid #dcccf5; color: #7b2fbe; background: #fbfaff;
  cursor: pointer; text-decoration: none; }
.mb-linkbtn:hover { background: #f4eefc; }
.mb-frame { flex: 1; width: 100%; border: 0; background: #fff; min-height: 420px; }
.mb-load { display: grid; place-items: center; flex: 1; color: #8b87a0; font-size: 13px; padding: 60px; }
.mb-search { margin: 0 12px 12px; position: relative; }
.mb-search input { width: 100%; box-sizing: border-box; border: 1.5px solid #e4dff0; border-radius: 10px;
  padding: 9px 12px 9px 34px; font-size: 12.5px; background: #fbfaff; outline: none; }
.mb-search input:focus { border-color: #7b2fbe; }
.mb-search svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #a29dbb; }
@media (max-width: 900px) { .mb-body { grid-template-columns: 1fr; } }
`

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function extractLinks(html: string): { href: string; label: string }[] {
  const out: { href: string; label: string }[] = []
  const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const href = m[1]
    if (!/^https?:/i.test(href) && !href.startsWith("/")) continue
    const label = m[2].replace(/<[^>]+>/g, "").trim() || href
    if (!out.some((l) => l.href === href)) out.push({ href, label })
  }
  return out.slice(0, 6)
}

export default function DevMailboxPage() {
  const [emails, setEmails] = useState<MailSummary[] | null>(null)
  const [selected, setSelected] = useState<MailFull | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState("")
  const [unavailable, setUnavailable] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadList = useCallback(async () => {
    const res = await fetch("/api/dev/mailbox").catch(() => null)
    if (!res) return
    if (res.status === 404) {
      setUnavailable(true)
      return
    }
    const data = (await res.json().catch(() => null)) as { emails?: MailSummary[] } | null
    setEmails(data?.emails ?? [])
  }, [])

  useEffect(() => {
    loadList()
    pollRef.current = setInterval(loadList, 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [loadList])

  const openMail = useCallback(async (id: string) => {
    setLoadingDetail(true)
    setSelected(null)
    try {
      const res = await fetch(`/api/dev/mailbox?id=${encodeURIComponent(id)}`)
      const data = (await res.json().catch(() => null)) as { email?: MailFull } | null
      if (data?.email) setSelected(data.email)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await loadList()
    setTimeout(() => setRefreshing(false), 500)
  }, [loadList])

  const filtered = (emails ?? []).filter(
    (e) =>
      !query ||
      e.toEmail.toLowerCase().includes(query.toLowerCase()) ||
      e.subject.toLowerCase().includes(query.toLowerCase())
  )

  const links = selected ? extractLinks(selected.html) : []

  if (unavailable) {
    return (
      <div className="mb-root">
        <style>{STYLES}</style>
        <div style={{ margin: "auto", textAlign: "center", padding: 40, fontSize: 14, color: "#565166" }}>
          The Dev Mailbox is only available when no real email provider is configured
          (no <code>RESEND_API_KEY</code>). Emails are being delivered to real inboxes.
        </div>
      </div>
    )
  }

  return (
    <div className="mb-root">
      <style>{STYLES}</style>
      <header className="mb-bar">
        <div className="mb-logo">U</div>
        <div className="mb-title">
          UKUU HR — Dev Mailbox
          <small>LOCAL OUTBOX · EMAILS CAPTURED IN THIS SANDBOX</small>
        </div>
        <div className="mb-mode">
          <span className="mb-chip">provider: outbox</span>
          <button className={`mb-refresh${refreshing ? " spin" : ""}`} onClick={refresh}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </header>

      <div className="mb-body">
        <aside className="mb-list">
          <div className="mb-list-h">
            <Inbox size={13} /> OUTBOX ({filtered.length})
          </div>
          <div className="mb-search">
            <Search size={13} />
            <input
              placeholder="Filter by recipient or subject…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="mb-scroll">
            {emails === null && <div className="mb-empty">Loading outbox…</div>}
            {emails !== null && filtered.length === 0 && (
              <div className="mb-empty">
                No emails captured yet.
                <br />
                Trigger one from <a href="/login?mode=forgot" style={{ color: "#7b2fbe", fontWeight: 700 }}>Forgot password</a>.
              </div>
            )}
            {filtered.map((m) => (
              <div
                key={m.id}
                className={`mb-item${selected?.id === m.id ? " on" : ""}`}
                onClick={() => openMail(m.id)}
              >
                <p className="mb-sub">{m.subject}</p>
                <p className="mb-to">{m.toEmail}</p>
                <div className="mb-meta">
                  <span className={`mb-tag ${m.status}`}>{m.status}</span>
                  <span className="mb-time">{timeAgo(m.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="mb-preview">
          {loadingDetail && (
            <div className="mb-load">
              <Loader2 size={20} className="mb-spin" style={{ animation: "mb-rot 1s linear infinite" }} />
            </div>
          )}
          {!loadingDetail && !selected && (
            <div className="mb-empty" style={{ display: "grid", placeItems: "center", flex: 1 }}>
              <div>
                <Mail size={30} style={{ color: "#d5cdec", marginBottom: 10 }} />
                <div>Select an email to preview it.</div>
              </div>
            </div>
          )}
          {!loadingDetail && selected && (
            <>
              <div className="mb-prev-h">
                <p className="mb-prev-sub">{selected.subject}</p>
                <div className="mb-prev-meta">
                  <strong style={{ color: "#1a1a2e" }}>To:</strong> {selected.toEmail}
                  <span className={`mb-tag ${selected.status}`}>{selected.status}</span>
                  <span className={`mb-tag ${selected.provider}`}>{selected.provider}</span>
                  <span style={{ marginLeft: "auto" }}>
                    {new Date(selected.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              {links.length > 0 && (
                <div className="mb-links">
                  {links.map((l) => (
                    <a
                      key={l.href}
                      className="mb-linkbtn"
                      href={l.href}
                      target={l.href.startsWith("/") ? "_self" : "_blank"}
                      rel="noreferrer"
                    >
                      <ExternalLink size={12} /> {l.label.slice(0, 42)}
                      {l.label.length > 42 ? "…" : ""}
                    </a>
                  ))}
                </div>
              )}
              <iframe
                title="Email preview"
                className="mb-frame"
                srcDoc={selected.html}
                sandbox="allow-top-navigation-by-user-activation allow-popups allow-popups-to-escape-sandbox"
              />
            </>
          )}
        </section>
      </div>
    </div>
  )
}
