"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarCheck,
  ClockPlus,
  CalendarDays,
  Fingerprint,
  List,
  FlaskConical,
  Settings,
  ShieldCheck,
  ShieldUser,
  Sun,
  Moon,
  ChevronUp,
  LogOut,
  Menu,
  Search,
  Cloud,
  Bell,
  CircleHelp,
  BarChart3,
  TicketPercent,
  CreditCard,
} from "lucide-react";
import { IS_ADMIN_PLATFORM } from "@/lib/platform";
import AccessGate from "@/components/license/AccessGate";
import TourWalkthrough from "@/components/tour/TourWalkthrough";
import "../../app/admin.css";

/* ───────────────────────── theme store ───────────────────────── */

const THEME_KEY = "ukuu-theme";
const THEME_EVENT = "ukuu-theme-change";

function subscribeTheme(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(THEME_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(THEME_EVENT, cb);
  };
}
function getThemeSnapshot(): boolean {
  try {
    return window.localStorage.getItem(THEME_KEY) === "dark";
  } catch {
    return false;
  }
}
function getThemeServerSnapshot(): boolean {
  return false;
}

/* ───────────────────────── navigation ───────────────────────── */

type Leaf = { key: string; label: string; href: string; icon: LucideIcon };
type Group = { key: string; label: string; icon: LucideIcon; children: Leaf[] };
type Entry = Leaf | Group;

const isGroup = (e: Entry): e is Group => (e as Group).children !== undefined;

const WORKSPACE: Entry[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "employees", label: "Employees", href: "/employees", icon: Users },
  { key: "attendance", label: "Attendance Records", href: "/attendance", icon: Clock },
  { key: "leave", label: "Leave", href: "/leave", icon: CalendarCheck },
  {
    key: "overtime",
    label: "Overtime",
    icon: ClockPlus,
    children: [
      { key: "overtime", label: "Overtime", href: "/overtime", icon: ClockPlus },
      { key: "holidays", label: "Holidays", href: "/holidays", icon: CalendarDays },
    ],
  },
  { key: "shifts", label: "Shifts", href: "/shifts", icon: CalendarDays },
  {
    key: "devices",
    label: "Devices",
    icon: Fingerprint,
    children: [
      { key: "devices", label: "All Devices", href: "/devices", icon: List },
      { key: "devices-diagnostics", label: "Diagnostics", href: "/devices/diagnostics", icon: FlaskConical },
    ],
  },
  { key: "reports", label: "Reports", href: "/reports", icon: BarChart3 },
];

const ADMIN: Entry[] = [
  { key: "settings", label: "Settings", href: "/settings", icon: Settings },
  { key: "security", label: "Security & Audit", href: "/security", icon: ShieldCheck },
  { key: "billing", label: "Billing", href: "/billing", icon: CreditCard },
];

/* Admin-portal (platform) section — only rendered on the admin deployment,
   which issues access codes and manages tenants platform-wide. */
const PLATFORM: Entry[] = [
  { key: "access-codes", label: "Access Codes", href: "/access-codes", icon: TicketPercent },
  { key: "super-admin", label: "Platform Admin", href: "/super-admin", icon: ShieldUser },
];

interface AdminShellProps {
  activeKey?: string;
  children: React.ReactNode;
}

export default function AdminShell({ activeKey = "dashboard", children }: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ overtime: true, devices: true });
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<{ id: string; title: string; message: string; read: boolean; createdAt: string }[]>([]);
  const [unread, setUnread] = useState(0);

  /* ── subscription gate: every account page verifies the workspace license ── */
  const [access, setAccess] = useState<{ checked: boolean; locked: boolean }>({ checked: IS_ADMIN_PLATFORM, locked: false });
  const refreshAccess = useCallback(() => {
    if (IS_ADMIN_PLATFORM) return;
    fetch("/api/license/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const s = d?.status;
        setAccess({ checked: true, locked: Boolean(s?.enforce && s?.locked) });
      })
      .catch(() => setAccess({ checked: true, locked: false }));
  }, []);
  useEffect(() => {
    refreshAccess();
  }, [refreshAccess]);

  useEffect(() => {
    let alive = true;
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.ok) {
          setNotifs(d.items);
          setUnread(d.unread);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const themeDark = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeDark ? "dark" : "light");
  }, [themeDark]);

  const toggleTheme = () => {
    try {
      window.localStorage.setItem(THEME_KEY, themeDark ? "light" : "dark");
    } catch { /* ignore */ }
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  const signOut = () => {
    try {
      localStorage.removeItem("ukuu_session");
      sessionStorage.removeItem("ukuu_session");
    } catch { /* ignore */ }
    // Destroy the server-side tenant session (httpOnly cookie) before redirecting.
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign("/login");
  };

  const toggleGroup = (key: string) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  // Dash-suffixed keys (e.g. attendance-import) highlight the parent leaf.
  const isActive = (key: string) => activeKey === key || activeKey.startsWith(key + "/") || activeKey.startsWith(key + "-");

  const renderLeaf = (leaf: Leaf) => (
    <Link key={leaf.key} href={leaf.href} data-tour={`nav-${leaf.key}`} className={`bk-admin-sidebar-item${isActive(leaf.key) ? " active" : ""}`} onClick={() => setMobileOpen(false)}>
      <span className="bk-admin-sidebar-item-icon"><leaf.icon size={19} strokeWidth={1.9} /></span>
      {!collapsed && <span className="bk-admin-sidebar-item-text">{leaf.label}</span>}
    </Link>
  );

  const renderEntry = (entry: Entry) => {
    if (isGroup(entry)) {
      const expanded = !!openGroups[entry.key];
      return (
        <div key={entry.key} className="bk-admin-sidebar-group">
          <button
            type="button"
            data-tour={`nav-${entry.key}`}
            className={`bk-admin-sidebar-item${isActive(entry.key) ? " active" : ""}`}
            onClick={() => toggleGroup(entry.key)}
            aria-expanded={expanded}
          >
            <span className="bk-admin-sidebar-item-icon"><entry.icon size={19} strokeWidth={1.9} /></span>
            {!collapsed && (
              <>
                <span className="bk-admin-sidebar-item-text">{entry.label}</span>
                <ChevronUp size={15} strokeWidth={2.2} style={{ transform: expanded ? "none" : "rotate(180deg)", transition: "transform .2s" }} />
              </>
            )}
          </button>
          {!collapsed && expanded && (
            <div>
              {entry.children.map((child) => (
                <Link key={child.key} href={child.href} data-tour={`nav-${child.key}`} className={`bk-admin-sidebar-subitem${isActive(child.key) ? " active" : ""}`} onClick={() => setMobileOpen(false)}>
                  <child.icon size={16} strokeWidth={1.9} style={{ color: "rgba(243,240,255,.6)" }} />
                  <span>{child.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }
    return renderLeaf(entry);
  };

  /* While the license check is in flight, show a branded loader instead of the
     app so users never glimpse the workspace before the gate resolves. */
  if (!access.checked) return <AccessGate checking />;
  if (access.locked) return <AccessGate onActivated={refreshAccess} />;

  return (
    <div className="bk-admin-body">
      <div className={`bk-admin-sidebar${collapsed ? " collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}>
        <Link href="/dashboard" className="bk-admin-sidebar-brand" onClick={() => setMobileOpen(false)}>
          <span className="bk-admin-sidebar-brand-logo"><img src="/ukuu-brand-white.png" alt="Ukuu HR" /></span>
          {!collapsed && (
            <span>
              <span className="bk-admin-sidebar-brand-name">UKUU HR</span>
              <div className="bk-admin-sidebar-brand-tag">HRMS Platform</div>
            </span>
          )}
        </Link>

        <nav className="bk-admin-sidebar-nav">
          {IS_ADMIN_PLATFORM ? (
            /* Admin portal: the HR workspace modules are tenant features, so
               the sidebar keeps only Dashboard + Administration + Platform. */
            <>
              {!collapsed && <div className="bk-admin-sidebar-section-label">Overview</div>}
              {renderLeaf({ key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard })}
            </>
          ) : (
            <>
              {!collapsed && <div className="bk-admin-sidebar-section-label">Workspace</div>}
              {WORKSPACE.map((e) => renderEntry(e))}
            </>
          )}

          {!collapsed && <div className="bk-admin-sidebar-section-label" style={{ marginTop: 14 }}>Administration</div>}
          {ADMIN.map((e) => renderEntry(e))}

          {IS_ADMIN_PLATFORM && (
            <>
              {!collapsed && <div className="bk-admin-sidebar-section-label" style={{ marginTop: 14 }}>Platform</div>}
              {PLATFORM.map((e) => renderEntry(e))}
            </>
          )}

          {!collapsed && <div className="bk-admin-sidebar-section-label" style={{ marginTop: 14 }}>Learn</div>}
          <TourWalkthrough mode={IS_ADMIN_PLATFORM ? "admin" : "standard"} collapsed={collapsed} />
        </nav>

        <div className="bk-admin-sidebar-footer">
          <button
            type="button"
            className="bk-admin-sidebar-item"
            onClick={toggleTheme}
            style={{ width: "100%", justifyContent: collapsed ? "center" : undefined }}
            title={themeDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            <span className="bk-admin-sidebar-item-icon">
              {themeDark ? <Moon size={18} strokeWidth={1.9} /> : <Sun size={18} strokeWidth={1.9} />}
            </span>
            {!collapsed && <span className="bk-admin-sidebar-item-text">{themeDark ? "Dark Mode" : "Light Mode"}</span>}
          </button>
          <Link href="/settings" className="bk-admin-sidebar-user">
            <span className="bk-admin-sidebar-user-avatar">A</span>
            {!collapsed && (
              <span style={{ overflow: "hidden", flex: 1, minWidth: 0 }}>
                <div className="bk-admin-sidebar-user-name">Administrator</div>
                <div className="bk-admin-sidebar-user-role">Super Admin</div>
              </span>
            )}
          </Link>
          <button type="button" className="bk-admin-sidebar-item" onClick={signOut} style={{ width: "100%", justifyContent: collapsed ? "center" : undefined }}>
            <span className="bk-admin-sidebar-item-icon"><LogOut size={18} strokeWidth={1.9} /></span>
            {!collapsed && <span className="bk-admin-sidebar-item-text">Sign Out</span>}
          </button>
        </div>
      </div>

      <div className={`bk-admin-main${collapsed ? " collapsed" : ""}`}>
        <header className="bk-admin-topbar">
          <button type="button" className="bk-admin-topbar-toggle" aria-label="Toggle sidebar" onClick={() => setCollapsed((c) => !c)}>
            <Menu size={22} strokeWidth={2} />
          </button>
          <label className="bk-admin-topbar-search">
            <span className="bk-admin-topbar-search-icon"><Search size={16} strokeWidth={2.1} /></span>
            <input type="search" placeholder="Search employees, payroll, leave..." aria-label="Search" />
          </label>
          <div style={{ flex: 1 }} />
          <button type="button" className="bk-admin-topbar-icon-btn" title="System status" aria-label="System status">
            <Cloud size={18} strokeWidth={1.9} />
          </button>
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="bk-admin-topbar-icon-btn"
              title="Notifications"
              aria-label="Notifications"
              onClick={() => {
                setNotifOpen((o) => !o);
                if (!notifOpen && unread > 0) {
                  fetch("/api/notifications", { method: "POST" }).catch(() => {});
                  setUnread(0);
                  setNotifs((ns) => ns.map((n) => ({ ...n, read: true })));
                }
              }}
            >
              <Bell size={18} strokeWidth={1.9} />
              {unread > 0 && <span className="bk-dot" />}
            </button>
            {notifOpen && (
              <div
                style={{
                  position: "absolute", right: 0, top: 44, width: 340, maxHeight: 420, overflowY: "auto",
                  background: "var(--bk-card, #fff)", border: "1px solid var(--bk-line)", borderRadius: 14,
                  boxShadow: "0 12px 40px rgba(23,10,55,.16)", zIndex: 200, padding: 6,
                }}
              >
                <div style={{ padding: "10px 12px 6px", fontWeight: 800, fontSize: 13.5, color: "var(--bk-ink)" }}>Notifications</div>
                {notifs.length === 0 && (
                  <div style={{ padding: "18px 12px", color: "var(--bk-ink-3)", fontSize: 13 }}>No notifications yet.</div>
                )}
                {notifs.map((n) => (
                  <div key={n.id} style={{ padding: "10px 12px", borderTop: "1px solid var(--bk-line)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: n.read ? "var(--bk-line)" : "#7B2FBE", marginTop: 5, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: "var(--bk-ink)" }}>{n.title}</div>
                      <div style={{ fontSize: 12, color: "var(--bk-ink-2)", lineHeight: 1.45 }}>{n.message}</div>
                      <div style={{ fontSize: 10.5, color: "var(--bk-ink-3)", marginTop: 3 }}>{new Date(n.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Link href="/settings" className="bk-admin-topbar-icon-btn" title="Help" aria-label="Help">
            <CircleHelp size={18} strokeWidth={1.9} />
          </Link>
          <Link href="/settings" className="bk-admin-topbar-avatar" aria-label="Profile">A</Link>
        </header>

        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(13,7,30,0.5)", zIndex: 99, backdropFilter: "blur(2px)", cursor: "pointer" }}
          />
        )}

        <main className="bk-admin-content bk-admin-fade-in">{children}</main>
      </div>

      {/* mobile bottom nav — workspace items on standard, platform items on admin */}
      <nav className="bk-mobile-bottomnav" aria-label="Primary navigation">
        <div className="bk-mobile-bottomnav-items">
          {(IS_ADMIN_PLATFORM
            ? [
                { href: "/dashboard", label: "Home", icon: LayoutDashboard, key: "dashboard" },
                { href: "/access-codes", label: "Codes", icon: TicketPercent, key: "access-codes" },
                { href: "/super-admin", label: "Platform", icon: ShieldUser, key: "super-admin" },
                { href: "/settings", label: "Settings", icon: Settings, key: "settings" },
              ]
            : [
                { href: "/dashboard", label: "Home", icon: LayoutDashboard, key: "dashboard" },
                { href: "/employees", label: "Team", icon: Users, key: "employees" },
                { href: "/attendance", label: "Attendance", icon: Clock, key: "attendance" },
                { href: "/leave", label: "Leave", icon: CalendarCheck, key: "leave" },
              ]
          ).map((n) => (
            <Link key={n.key} href={n.href} className={`bk-mobile-bottomnav-item${isActive(n.key) ? " active" : ""}`}>
              <n.icon size={20} strokeWidth={1.9} />
              <span>{n.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}