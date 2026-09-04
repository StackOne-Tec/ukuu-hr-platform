"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarCheck,
  ClockPlus,
  Calendar,
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
  Banknote,
  Timer,
  BarChart3,
} from "lucide-react";
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
  { key: "attendance", label: "Attendance", href: "/attendance", icon: Clock },
  { key: "clock", label: "Clock In/Out", href: "/clock", icon: Timer },
  { key: "timecards", label: "Time Cards", href: "/timecards", icon: Calendar },
  { key: "leave", label: "Leave", href: "/leave", icon: CalendarCheck },
  { key: "payroll", label: "Payroll", href: "/payroll", icon: Banknote },
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
];

interface AdminShellProps {
  activeKey?: string;
  children: React.ReactNode;
}

export default function AdminShell({ activeKey = "dashboard", children }: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ overtime: true, devices: true });
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
    window.location.assign("/login");
  };

  const toggleGroup = (key: string) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const isActive = (key: string) => activeKey === key || activeKey.startsWith(key + "/");

  const renderLeaf = (leaf: Leaf) => (
    <Link key={leaf.key} href={leaf.href} className={`bk-admin-sidebar-item${isActive(leaf.key) ? " active" : ""}`} onClick={() => setMobileOpen(false)}>
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
                <Link key={child.key} href={child.href} className={`bk-admin-sidebar-subitem${isActive(child.key) ? " active" : ""}`} onClick={() => setMobileOpen(false)}>
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

  return (
    <div className="bk-admin-body">
      <div className={`bk-admin-sidebar${collapsed ? " collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}>
        <Link href="/dashboard" className="bk-admin-sidebar-brand" onClick={() => setMobileOpen(false)}>
          <span className="bk-admin-sidebar-brand-logo">U</span>
          {!collapsed && (
            <span>
              <span className="bk-admin-sidebar-brand-name">UKUU HR</span>
              <div className="bk-admin-sidebar-brand-tag">HRMS Platform</div>
            </span>
          )}
        </Link>

        <nav className="bk-admin-sidebar-nav">
          {!collapsed && <div className="bk-admin-sidebar-section-label">Workspace</div>}
          {WORKSPACE.map((e) => renderEntry(e))}

          {!collapsed && <div className="bk-admin-sidebar-section-label" style={{ marginTop: 14 }}>Administration</div>}
          {ADMIN.map((e) => renderEntry(e))}

          {!collapsed && <div className="bk-admin-sidebar-section-label" style={{ marginTop: 14 }}>Super Admin</div>}
          <Link href="/super-admin" className={`bk-admin-sidebar-item${isActive("super-admin") ? " active" : ""}`} onClick={() => setMobileOpen(false)}>
            <span className="bk-admin-sidebar-item-icon"><ShieldUser size={19} strokeWidth={1.9} /></span>
            {!collapsed && <span className="bk-admin-sidebar-item-text">Platform Admin</span>}
          </Link>
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
          <button type="button" className="bk-admin-topbar-icon-btn" title="Notifications" aria-label="Notifications">
            <Bell size={18} strokeWidth={1.9} />
            <span className="bk-dot" />
          </button>
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

      {/* mobile bottom nav */}
      <nav className="bk-mobile-bottomnav" aria-label="Primary navigation">
        <div className="bk-mobile-bottomnav-items">
          {[
            { href: "/dashboard", label: "Home", icon: LayoutDashboard, key: "dashboard" },
            { href: "/employees", label: "Team", icon: Users, key: "employees" },
            { href: "/attendance", label: "Attendance", icon: Clock, key: "attendance" },
            { href: "/leave", label: "Leave", icon: CalendarCheck, key: "leave" },
          ].map((n) => (
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