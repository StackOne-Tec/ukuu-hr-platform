/**
 * Guided walkthrough registry — the single source of truth for the Tutorials
 * feature. Each tour walks a workload step by step: every step dims the rest of
 * the app and spotlights one element (sidebar item → page header → key action).
 *
 * Target resolution for a step's `key`:
 *   1. `[data-tour="<key>"]`        — a specific element (e.g. the Add button)
 *   2. `[data-tour="page-<key>"]`   — the page header on that page
 *   3. `[data-tour="nav-<key>"]`    — the sidebar nav item (always present)
 *
 * Keep this file in sync as workloads evolve — it is the maintenance point for
 * the walkthroughs.
 */

export type TourStep = {
  /** data-tour id resolved against specific → page → nav anchors */
  key: string;
  title: string;
  body: string;
  /** page to navigate to for this step (optional; step then runs on that page) */
  href?: string;
};

export type Tour = {
  id: string;
  title: string;
  tagline: string;
  /** lucide icon name — mapped to a component in TourWalkthrough */
  icon: string;
  /** accent color used for the icon chip and progress bar */
  accent: string;
  steps: TourStep[];
};

/* ─────────────────────────── standard app ─────────────────────────── */

export const STANDARD_TOURS: Tour[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    tagline: "The full tour — every section of the workspace, one spotlight at a time.",
    icon: "compass",
    accent: "#A78BFA",
    steps: [
      {
        key: "dashboard",
        href: "/dashboard",
        title: "Your command center",
        body: "The Dashboard is your live pulse: employee headcount, today's attendance, pending leave and overtime, working hours and device status — all in one place. Start here each morning to see what needs your attention.",
      },
      {
        key: "employees",
        href: "/employees",
        title: "Build your team directory",
        body: "Employees is your master list of people. Add new hires, search by name, code or position, filter by department and status, and open anyone for their full profile.",
      },
      {
        key: "attendance",
        href: "/attendance",
        title: "Track time, live",
        body: "Attendance shows who's in, who's late and who's on leave — updated live from clock events and device imports. Use Clock In / Out for manual punches or pull records straight from your terminals.",
      },
      {
        key: "leave",
        href: "/leave",
        title: "Manage leave requests",
        body: "Leave centralizes requests, balances and public holidays. Approve or reject pending requests, see how many days each employee has per type, and keep an eye on upcoming holidays.",
      },
      {
        key: "overtime",
        href: "/overtime",
        title: "Approve overtime",
        body: "Overtime classifies hours by rate — Standard (1.5×), Weekend (2×) and Public Holiday (3×) — with an approve/reject workflow and running totals of approved hours per rate.",
      },
      {
        key: "shifts",
        href: "/shifts",
        title: "Design your schedule",
        body: "Shifts lets you define fixed, rotating, flexible and overnight shifts, assign employees, and configure tolerance policies for late arrivals and early departures.",
      },
      {
        key: "devices",
        href: "/devices",
        title: "Connect your terminals",
        body: "Devices manages the biometric terminals that feed attendance — Hikvision, ZKTeco, Suprema and more — over REST, CSV, SDK or TCP. Register a device and watch its sync status here.",
      },
      {
        key: "reports",
        href: "/reports",
        title: "Understand your workforce",
        body: "Reports turns your data into insight: department distribution, attendance health and payroll spend by period. Use the Report Generator for custom exports.",
      },
      {
        key: "settings",
        href: "/settings",
        title: "Configure your workspace",
        body: "Settings is where your organization lives — profile, branches, leave types, notifications, users and API keys for integrations.",
      },
      {
        key: "security",
        href: "/security",
        title: "Protect your data",
        body: "Security & Audit shows your security score, lets you enable policies like MFA and session timeouts, and keeps a full audit log of privileged actions.",
      },
      {
        key: "billing",
        href: "/billing",
        title: "Your subscription",
        body: "Billing shows your active license — plan, code and expiry — plus the plan comparison if you ever want to upgrade.",
      },
    ],
  },
  {
    id: "employees",
    title: "Employees",
    tagline: "Build and manage your workforce directory.",
    icon: "users",
    accent: "#7B2FBE",
    steps: [
      { key: "employees", title: "Open the Employees page", body: "Click Employees in the sidebar to open your workforce directory — the master list of everyone in your organization." },
      { key: "employees", href: "/employees", title: "The employee directory", body: "This page lists every employee with their department, position, hire date and status. The greeting shows how many people are on record." },
      { key: "employees-add", href: "/employees", title: "Add someone new", body: "Use Add Employee to onboard a new hire — name, department, position, salary and documents — and they appear in the directory immediately." },
      { key: "employees-search", href: "/employees", title: "Search & filter", body: "Search by name, code or position, then narrow by department or status to find exactly who you need in seconds." },
      { key: "employees-table", href: "/employees", title: "The directory table", body: "Click any row to open an employee's full profile — their details, attendance history and documents all live there." },
    ],
  },
  {
    id: "attendance",
    title: "Attendance",
    tagline: "Live time tracking, clock events and device imports.",
    icon: "clock",
    accent: "#14a37f",
    steps: [
      { key: "attendance", title: "Open Attendance", body: "Click Attendance Records in the sidebar to open live time tracking for today." },
      { key: "attendance", href: "/attendance", title: "Live attendance", body: "Shift-aware status updated live: who's present, who's late, who's on leave, and the total hours worked today." },
      { key: "attendance-clock", href: "/attendance", title: "Clock In / Out", body: "Employees without a terminal can punch in and out manually here — every event lands in the live feed instantly." },
      { key: "attendance-live", href: "/attendance", title: "Live clock events", body: "Every punch streams in here in real time, tagged by employee code and event type." },
      { key: "attendance-table", href: "/attendance", title: "Today's attendance", body: "The full roster with check-in, check-out, hours and a colour-coded status pill for every employee." },
    ],
  },
  {
    id: "leave",
    title: "Leave",
    tagline: "Requests, balances and public holidays.",
    icon: "calendar-check",
    accent: "#2563EB",
    steps: [
      { key: "leave", title: "Open Leave", body: "Click Leave in the sidebar to open the approval workflow." },
      { key: "leave", href: "/leave", title: "Leave Management", body: "Approve or reject requests from the tabs below, track balances, and keep an eye on public holidays — all from one page." },
      { key: "leave-types", href: "/leave", title: "Balances & holidays", body: "Each card shows the annual entitlement per leave type, plus how many public holidays are on the calendar and how many are coming up." },
    ],
  },
  {
    id: "overtime",
    title: "Overtime",
    tagline: "Rate-classified hours with an approval workflow.",
    icon: "clock-plus",
    accent: "#d89c11",
    steps: [
      { key: "overtime", title: "Open Overtime", body: "Click Overtime in the sidebar to open the overtime console." },
      { key: "overtime", href: "/overtime", title: "Overtime", body: "Every overtime record is classified by rate type with a simple approve/reject workflow." },
      { key: "overtime-rates", href: "/overtime", title: "Rate types", body: "Standard hours run at 1.5×, weekends at 2× and public holidays at 3×. Each card totals the approved hours for that rate." },
    ],
  },
  {
    id: "shifts",
    title: "Shifts",
    tagline: "Fixed, rotating, flexible and overnight schedules.",
    icon: "calendar-days",
    accent: "#e85d75",
    steps: [
      { key: "shifts", title: "Open Shifts", body: "Click Shifts in the sidebar to open shift management." },
      { key: "shifts", href: "/shifts", title: "Shift Management", body: "Define fixed, rotating, flexible and overnight shifts for your organization and see coverage at a glance." },
      { key: "shifts-config", href: "/shifts", title: "Assignments & policies", body: "Assign employees to shifts, configure tolerance rules for lateness and early departures, and review weekly coverage." },
    ],
  },
  {
    id: "devices",
    title: "Devices",
    tagline: "Biometric terminal integration — REST, CSV, SDK, TCP.",
    icon: "fingerprint",
    accent: "#7B2FBE",
    steps: [
      { key: "devices", title: "Open Devices", body: "Click Devices in the sidebar to open terminal integration." },
      { key: "devices", href: "/devices", title: "Devices", body: "Register the biometric terminals and readers that feed attendance, and watch their connection status from one place." },
      { key: "devices-vendors", href: "/devices", title: "Vendor support", body: "Hikvision, ZKTeco, Suprema, Dahua, Anviz, Matrix and eSSL are supported out of the box — see which are connected." },
      { key: "devices-table", href: "/devices", title: "Registered devices", body: "Every terminal with its vendor, model, IP, integration mode, last sync and live status. Use Diagnostics from the header to troubleshoot." },
    ],
  },
  {
    id: "reports",
    title: "Reports",
    tagline: "Workforce analytics and payroll spend.",
    icon: "bar-chart",
    accent: "#6c63ff",
    steps: [
      { key: "reports", title: "Open Reports", body: "Click Reports in the sidebar to open analytics." },
      { key: "reports", href: "/reports", title: "Reports", body: "Workforce distribution, attendance health and payroll spend — the numbers that matter, visualized." },
      { key: "reports-charts", href: "/reports", title: "Workforce analytics", body: "Department distribution and attendance status at a glance, with counts broken down per slice." },
      { key: "reports-payroll", href: "/reports", title: "Payroll spend", body: "Payroll spend by period, so you can see where the budget goes month over month." },
    ],
  },
  {
    id: "security",
    title: "Security & Audit",
    tagline: "Policies, login stats and the audit log.",
    icon: "shield-check",
    accent: "#14a37f",
    steps: [
      { key: "security", title: "Open Security & Audit", body: "Click Security & Audit in the sidebar to open governance." },
      { key: "security", href: "/security", title: "Security & Audit", body: "Your security score, login activity and the full audit trail of privileged actions — everything that keeps the workspace safe." },
      { key: "security-score", href: "/security", title: "Security policies", body: "Toggle policies like MFA, password rotation, session timeouts and audit logging to raise your security score." },
      { key: "security-audit", href: "/security", title: "Audit log", body: "Every privileged action recorded — who did what, when, and on which entity. This is your accountability trail." },
    ],
  },
  {
    id: "billing",
    title: "Billing & License",
    tagline: "Your subscription, plan and expiry.",
    icon: "credit-card",
    accent: "#F0C257",
    steps: [
      { key: "billing", title: "Open Billing", body: "Click Billing in the sidebar to open your subscription." },
      { key: "billing", href: "/billing", title: "Billing", body: "Your license, usage and plan comparison all live here." },
      { key: "billing-license", href: "/billing", title: "Your active license", body: "The plan, license code (copy it anywhere), user and employee counts, and exactly when the subscription expires — or if it's permanent." },
      { key: "billing-plans", href: "/billing", title: "Compare plans", body: "Starter, Professional and Enterprise side by side. Your current plan is highlighted — upgrade any time." },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    tagline: "Organization, users, notifications and API keys.",
    icon: "settings",
    accent: "#A78BFA",
    steps: [
      { key: "settings", title: "Open Settings", body: "Click Settings in the sidebar to open workspace configuration." },
      { key: "settings", href: "/settings", title: "Settings", body: "Everything that configures your workspace lives here — profile, branches, leave types, notifications, users and API keys." },
      { key: "settings-tabs", href: "/settings", title: "Six configuration areas", body: "Organization, Branches, Leave Types, Notifications, User Management and API Keys — jump straight to the area you need." },
    ],
  },
];

/* ─────────────────────────── admin portal ─────────────────────────── */

export const ADMIN_TOURS: Tour[] = [
  {
    id: "admin-overview",
    title: "Account Overview",
    tagline: "Platform-wide users, access codes and organizations.",
    icon: "layout-dashboard",
    accent: "#7B2FBE",
    steps: [
      { key: "dashboard", title: "Open the portal home", body: "The admin portal home is Account Overview — the platform-wide control room." },
      { key: "dashboard", href: "/dashboard", title: "Account Overview", body: "Every workspace on the platform, seen from above: registered users, issued access codes and organizations." },
      { key: "dashboard-kpis", href: "/dashboard", title: "At-a-glance KPIs", body: "Organizations, registered users, active access codes and devices across all workspaces — the health of the platform in four numbers." },
      { key: "admin-users", href: "/dashboard", title: "Registered users", body: "Every account across every workspace, with role, status and last login. Spot inactive accounts and manage them here." },
      { key: "admin-orgs", href: "/dashboard", title: "Organizations", body: "Each tenant workspace with its plan, employee and user counts — your customer list at a glance." },
    ],
  },
  {
    id: "admin-access-codes",
    title: "Access Codes",
    tagline: "Issue single-use codes and track every redemption.",
    icon: "ticket-percent",
    accent: "#d89c11",
    steps: [
      { key: "access-codes", title: "Open Access Codes", body: "Click Access Codes in the sidebar to open the subscription-code console." },
      { key: "access-codes", href: "/access-codes", title: "Access Codes", body: "This is where workspaces get their subscription. The header shows how many codes are still available to issue." },
      { key: "access-codes-new", href: "/access-codes", title: "Issue a new code", body: "New Access Code opens a modal where you set the code, discount, plan, expiry and description. Codes are single-use — the first workspace that redeems one keeps it." },
      { key: "access-codes-list", href: "/access-codes", title: "Track redemptions", body: "Every code shows its state: Available or Used. Click any row to expand the full detail — who redeemed it, when, and which plan was granted." },
    ],
  },
  {
    id: "admin-platform",
    title: "Platform Admin",
    tagline: "Multi-tenant oversight across the platform.",
    icon: "shield-user",
    accent: "#2563EB",
    steps: [
      { key: "super-admin", title: "Open Platform Admin", body: "Click Platform Admin in the sidebar to open tenant oversight." },
      { key: "super-admin", href: "/super-admin", title: "Platform Admin", body: "Super-admin scope: organizations, user accounts, devices and payroll runs across every tenant." },
      { key: "super-admin-tenants", href: "/super-admin", title: "Tenant list", body: "Every organization on the platform with its slug, plan and size — the definitive tenant registry." },
    ],
  },
];

/** All tours for a given mode — used by the launcher. */
export function toursForMode(mode: "standard" | "admin"): Tour[] {
  return mode === "admin" ? ADMIN_TOURS : STANDARD_TOURS;
}