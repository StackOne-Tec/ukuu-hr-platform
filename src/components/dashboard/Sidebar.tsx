"use client";

import { useState } from "react";
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
  ChevronUp,
  RefreshCw,
  LogOut,
} from "lucide-react";

type NavLeaf = { key: string; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> };
type NavParent = { key: string; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; children: NavLeaf[] };
type NavEntry = NavLeaf | NavParent;

function isParent(entry: NavEntry): entry is NavParent {
  return (entry as NavParent).children !== undefined;
}

const WORKSPACE_NAV: NavEntry[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "employees", label: "Employees", icon: Users },
  { key: "attendance", label: "Attendance", icon: Clock },
  { key: "leave", label: "Leave", icon: CalendarCheck },
  {
    key: "overtime",
    label: "Overtime",
    icon: ClockPlus,
    children: [
      { key: "overtime-records", label: "Overtime", icon: ClockPlus },
      { key: "overtime-holidays", label: "Holidays", icon: CalendarDays },
    ],
  },
  { key: "shifts", label: "Shifts", icon: Calendar },
  {
    key: "devices",
    label: "Devices",
    icon: Fingerprint,
    children: [
      { key: "devices-all", label: "All Devices", icon: List },
      { key: "devices-diagnostics", label: "Diagnostics", icon: FlaskConical },
    ],
  },
];

const ADMIN_NAV: NavEntry[] = [
  { key: "settings", label: "Settings", icon: Settings },
  { key: "security", label: "Security & Audit", icon: ShieldCheck },
];

interface SidebarProps {
  activeKey?: string;
  themeDark: boolean;
  onToggleTheme: () => void;
  onSignOut?: () => void;
}

export default function Sidebar({ activeKey = "dashboard", themeDark, onToggleTheme, onSignOut }: SidebarProps) {
  // groups default-expanded like the screenshot (chevron up)
  const [open, setOpen] = useState<Record<string, boolean>>({ overtime: true, devices: true });
  const toggle = (key: string) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const renderItem = (entry: NavEntry, depth = 0) => {
    if (isParent(entry)) {
      const expanded = !!open[entry.key];
      return (
        <li key={entry.key}>
          <button
            type="button"
            className={`db-nav-item${depth === 0 ? "" : " db-nav-subitem"}`}
            aria-expanded={expanded}
            onClick={() => toggle(entry.key)}
          >
            <span className="db-nav-icon"><entry.icon size={19} strokeWidth={1.9} /></span>
            <span className="db-nav-label">{entry.label}</span>
            <span className="db-nav-chevron"><ChevronUp size={15} strokeWidth={2.2} /></span>
          </button>
          {expanded && (
            <div className="db-nav-sub" role="group" aria-label={`${entry.label} submenu`}>
              {entry.children.map((child) => (
                <button
                  key={child.key}
                  type="button"
                  className={`db-nav-item${activeKey === child.key ? " is-active" : ""}`}
                  title={child.label}
                >
                  <span className="db-nav-icon"><child.icon size={16} strokeWidth={1.9} /></span>
                  <span className="db-nav-label">{child.label}</span>
                </button>
              ))}
            </div>
          )}
        </li>
      );
    }
    const active = activeKey === entry.key;
    return (
      <li key={entry.key}>
        <button type="button" className={`db-nav-item${active ? " is-active" : ""}`} title={entry.label} aria-current={active ? "page" : undefined}>
          <span className="db-nav-icon"><entry.icon size={19} strokeWidth={1.9} /></span>
          <span className="db-nav-label">{entry.label}</span>
        </button>
      </li>
    );
  };

  return (
    <aside className="db-sidebar" aria-label="Workspace navigation">
      <div className="db-side-logo">
        <span className="db-logo-badge" aria-hidden="true">
          <RefreshCw size={15} strokeWidth={2.2} />
          <span className="db-logo-word">UKUU</span>
        </span>
        <span className="db-logo-text">
          <span className="db-logo-brand">UKUU HR</span>
          <span className="db-logo-sub">HRMS Platform</span>
        </span>
      </div>

      <nav className="db-nav">
        <p className="db-nav-section"><span>Workspace</span></p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {WORKSPACE_NAV.map((entry) => renderItem(entry))}
        </ul>
        <p className="db-nav-section"><span>Administration</span></p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {ADMIN_NAV.map((entry) => renderItem(entry))}
        </ul>
      </nav>

      <div className="db-side-mid">
        <p className="db-super-label">
          <span className="db-nav-icon"><ShieldCheck size={15} strokeWidth={1.9} /></span>
          <span>Super Admin</span>
        </p>
        <button type="button" className="db-nav-item" title="Platform Admin">
          <span className="db-nav-icon"><ShieldUser size={19} strokeWidth={1.9} /></span>
          <span className="db-nav-label">Platform Admin</span>
        </button>
      </div>

      <div className="db-side-bottom">
        <div className="db-theme-row">
          <span className="db-nav-icon"><Sun size={18} strokeWidth={1.9} /></span>
          <span className="db-theme-label">Light Mode</span>
          <button
            type="button"
            className="db-switch"
            role="switch"
            aria-checked={themeDark}
            aria-label="Toggle dark mode"
            onClick={onToggleTheme}
          />
        </div>
        <div className="db-profile">
          <span className="db-avatar" aria-hidden="true">A</span>
          <div className="db-profile-meta">
            <p className="db-profile-name">Administrator</p>
            <p className="db-profile-role">Admin</p>
          </div>
        </div>
        <button type="button" className="db-signout" onClick={onSignOut}>
          <span className="db-nav-icon"><LogOut size={18} strokeWidth={1.9} /></span>
          <span className="db-nav-label">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
