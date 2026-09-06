"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import {
  GraduationCap,
  X,
  ChevronLeft,
  ChevronRight,
  Compass,
  Users,
  Clock,
  CalendarCheck,
  ClockPlus,
  CalendarDays,
  Fingerprint,
  BarChart3,
  ShieldCheck,
  CreditCard,
  Settings,
  LayoutDashboard,
  TicketPercent,
  ShieldUser,
  Loader2,
  Sparkles,
  Check,
  type LucideIcon,
} from "lucide-react";
import { toursForMode, type Tour } from "@/lib/tours";

const TOUR_ICONS: Record<string, LucideIcon> = {
  compass: Compass,
  users: Users,
  clock: Clock,
  "calendar-check": CalendarCheck,
  "clock-plus": ClockPlus,
  "calendar-days": CalendarDays,
  fingerprint: Fingerprint,
  "bar-chart": BarChart3,
  "shield-check": ShieldCheck,
  "credit-card": CreditCard,
  settings: Settings,
  "layout-dashboard": LayoutDashboard,
  "ticket-percent": TicketPercent,
  "shield-user": ShieldUser,
};

const TOOLTIP_W = 380;
const TOOLTIP_H = 216;
const PAD = 10;

/** Resolve a step's target: specific element → page header → sidebar nav item. */
function resolveTarget(stepKey: string): Element | null {
  for (const sel of [`[data-tour="${stepKey}"]`, `[data-tour="page-${stepKey}"]`, `[data-tour="nav-${stepKey}"]`]) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

export default function TourWalkthrough({ mode, collapsed }: { mode: "standard" | "admin"; collapsed: boolean }) {
  const tours = toursForMode(mode);
  const [picker, setPicker] = useState(false);
  const [tour, setTour] = useState<Tour | null>(null);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [missing, setMissing] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const stepKeyRef = useRef<string | null>(null);
  stepKeyRef.current = tour ? tour.steps[idx].key : null;

  const close = useCallback(() => {
    setTour(null);
    setIdx(0);
    setRect(null);
    setMissing(false);
  }, []);

  const start = useCallback((t: Tour) => {
    setTour(t);
    setIdx(0);
    setPicker(false);
    setRect(null);
    setMissing(false);
  }, []);

  const next = useCallback(() => {
    if (!tour) return;
    if (idx < tour.steps.length - 1) setIdx((i) => i + 1);
    else close();
  }, [tour, idx, close]);

  const prev = useCallback(() => {
    setIdx((i) => Math.max(0, i - 1));
  }, []);

  /* navigate to the step's page, then locate + spotlight the target */
  useEffect(() => {
    if (!tour) return;
    const step = tour.steps[idx];
    if (step.href && step.href !== pathname) {
      router.push(step.href);
      return;
    }
    let cancelled = false;
    let tries = 0;
    const attempt = () => {
      if (cancelled) return;
      const el = resolveTarget(step.key);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        window.setTimeout(() => {
          if (!cancelled) setRect(el.getBoundingClientRect());
        }, 480);
        setMissing(false);
      } else if (tries < 40) {
        tries += 1;
        window.setTimeout(attempt, 250);
      } else {
        setMissing(true);
      }
    };
    setRect(null);
    setMissing(false);
    attempt();
    return () => {
      cancelled = true;
    };
  }, [tour, idx, pathname, router]);

  /* keep the spotlight pinned while the page scrolls or resizes */
  useEffect(() => {
    if (!tour) return;
    const refresh = () => {
      const key = stepKeyRef.current;
      if (!key) return;
      const el = resolveTarget(key);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("scroll", refresh, true);
    window.addEventListener("resize", refresh);
    return () => {
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
    };
  }, [tour]);

  /* keyboard navigation: Esc exits, ← / → step */
  useEffect(() => {
    if (!tour) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tour, next, prev, close]);

  /* ── launcher trigger (rendered inline in the sidebar) ── */
  return (
    <>
      <button
        type="button"
        className="bk-admin-sidebar-item"
        onClick={() => setPicker(true)}
        title="Guided tutorials"
        aria-label="Guided tutorials"
      >
        <span className="bk-admin-sidebar-item-icon">
          <GraduationCap size={19} strokeWidth={1.9} />
        </span>
        {!collapsed && <span className="bk-admin-sidebar-item-text">Tutorials</span>}
      </button>

      {typeof document !== "undefined" && picker && createPortal(<TourPicker tours={tours} onStart={start} onClose={() => setPicker(false)} />, document.body)}

      {typeof document !== "undefined" &&
        tour &&
        createPortal(
          <Spotlight tour={tour} idx={idx} rect={rect} missing={missing} onPrev={prev} onNext={next} onClose={close} />,
          document.body,
        )}
    </>
  );
}

/* ─────────────────────────── tour picker ─────────────────────────── */

function TourPicker({ tours, onStart, onClose }: { tours: Tour[]; onStart: (t: Tour) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 5000, display: "grid", placeItems: "center", padding: 20 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(9,4,22,.6)", backdropFilter: "blur(5px)" }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Guided tutorials"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 660,
          maxHeight: "86vh",
          overflowY: "auto",
          borderRadius: 22,
          background: "linear-gradient(180deg,#1B0F38 0%,#140A2B 100%)",
          border: "1px solid rgba(177,140,255,.28)",
          boxShadow: "0 40px 120px rgba(10,4,26,.6)",
          padding: "28px 28px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <span
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg,#7B2FBE,#A78BFA)",
              color: "#fff",
            }}
          >
            <GraduationCap size={24} strokeWidth={1.9} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "#A78BFA" }}>Guided tutorials</div>
            <h2 style={{ margin: "4px 0 6px", fontSize: 21, fontWeight: 800, color: "#fff" }}>Learn your workspace, step by step</h2>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(235,228,255,.7)", lineHeight: 1.55 }}>
              Pick a walkthrough — we&rsquo;ll dim everything else and spotlight each section as we go. Use <strong style={{ color: "#fff" }}>→</strong> and{" "}
              <strong style={{ color: "#fff" }}>←</strong> to move, <strong style={{ color: "#fff" }}>Esc</strong> to exit.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,.16)",
              background: "rgba(255,255,255,.06)",
              color: "rgba(255,255,255,.8)",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 22 }}>
          {tours.map((t) => {
            const Icon = TOUR_ICONS[t.icon] ?? Compass;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onStart(t)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  textAlign: "left",
                  padding: "14px 16px",
                  borderRadius: 16,
                  cursor: "pointer",
                  background: "rgba(255,255,255,.045)",
                  border: "1px solid rgba(255,255,255,.1)",
                  fontFamily: "inherit",
                  transition: "border-color .15s ease, background .15s ease, transform .15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = t.accent;
                  e.currentTarget.style.background = "rgba(255,255,255,.08)";
                  e.currentTarget.style.transform = "translateX(3px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,.1)";
                  e.currentTarget.style.background = "rgba(255,255,255,.045)";
                  e.currentTarget.style.transform = "none";
                }}
              >
                <span
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    background: `${t.accent}1f`,
                    color: t.accent,
                  }}
                >
                  <Icon size={20} strokeWidth={1.9} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 800, fontSize: 14.5, color: "#fff" }}>{t.title}</span>
                  <span style={{ display: "block", fontSize: 12.5, color: "rgba(235,228,255,.62)", marginTop: 2, lineHeight: 1.45 }}>{t.tagline}</span>
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 800,
                    color: t.accent,
                    background: `${t.accent}1a`,
                    padding: "5px 10px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.steps.length} step{t.steps.length === 1 ? "" : "s"}
                </span>
                <ChevronRight size={17} style={{ flexShrink: 0, color: "rgba(255,255,255,.45)" }} />
              </button>
            );
          })}
        </div>

        <p style={{ margin: "18px 0 0", fontSize: 11.5, color: "rgba(235,228,255,.4)", display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={12} /> Walkthroughs stay in sync with the app as new workloads ship.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────── spotlight overlay ─────────────────────── */

function Spotlight({
  tour,
  idx,
  rect,
  missing,
  onPrev,
  onNext,
  onClose,
}: {
  tour: Tour;
  idx: number;
  rect: DOMRect | null;
  missing: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const step = tour.steps[idx];
  const total = tour.steps.length;
  const Icon = TOUR_ICONS[tour.icon] ?? Compass;
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;

  const hole = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;

  /* tooltip placement: below the target when there's room, above otherwise */
  let tipTop = 24;
  let tipLeft = clamp(vw / 2 - TOOLTIP_W / 2, 16, Math.max(16, vw - TOOLTIP_W - 16));
  let arrow: "top" | "bottom" | null = null;
  if (hole) {
    const below = hole.top + hole.height + 14;
    const above = hole.top - TOOLTIP_H - 14;
    if (below + TOOLTIP_H <= vh || above < 8) {
      tipTop = below;
      arrow = "top";
    } else {
      tipTop = above;
      arrow = "bottom";
    }
    tipLeft = clamp(hole.left + hole.width / 2 - TOOLTIP_W / 2, 16, Math.max(16, vw - TOOLTIP_W - 16));
  }

  const dimPanel = (s: React.CSSProperties): React.CSSProperties => ({
    position: "absolute",
    background: "rgba(9,4,22,.72)",
    backdropFilter: "blur(2.5px)",
    ...s,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${tour.title} — step ${idx + 1} of ${total}: ${step.title}`}
      style={{ position: "fixed", inset: 0, zIndex: 4500, pointerEvents: "none" }}
    >
      {hole && !missing ? (
        <>
          {dimPanel({ top: 0, left: 0, width: vw, height: hole.top })}
          {dimPanel({ top: hole.top + hole.height, left: 0, width: vw, height: vh - hole.top - hole.height })}
          {dimPanel({ top: hole.top, left: 0, width: hole.left, height: hole.height })}
          {dimPanel({ top: hole.top, left: hole.left + hole.width, width: vw - hole.left - hole.width, height: hole.height })}

          {/* highlight ring */}
          <div
            style={{
              position: "absolute",
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
              borderRadius: 14,
              border: "2px solid #B18CFF",
              boxShadow: "0 0 0 4px rgba(177,140,255,.28), 0 0 46px rgba(177,140,255,.55)",
              pointerEvents: "none",
              transition: "all .3s ease",
              animation: "ukuuSpotPulse 2.2s ease-in-out infinite",
            }}
          />
        </>
      ) : null}

      {missing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(9,4,22,.72)", backdropFilter: "blur(2.5px)", pointerEvents: "auto", display: "grid", placeItems: "center" }}>
          <span style={{ fontSize: 13, color: "rgba(235,228,255,.7)", fontWeight: 700 }}>Couldn&rsquo;t find that section — continue to the next step.</span>
        </div>
      )}

      {/* tooltip card */}
      <div
        style={{
          position: "fixed",
          top: tipTop,
          left: tipLeft,
          width: TOOLTIP_W,
          pointerEvents: "auto",
          borderRadius: 18,
          background: "linear-gradient(180deg,#201140 0%,#170C31 100%)",
          border: "1px solid rgba(177,140,255,.32)",
          boxShadow: "0 24px 70px rgba(8,3,20,.65)",
          padding: "18px 18px 16px",
          fontFamily: "inherit",
        }}
      >
        {arrow && (
          <span
            style={{
              position: "absolute",
              left: clamp(hole ? hole.left + hole.width / 2 - tipLeft : vw / 2, 20, TOOLTIP_W - 20),
              top: arrow === "top" ? -7 : undefined,
              bottom: arrow === "bottom" ? -7 : undefined,
              width: 14,
              height: 14,
              background: "#201140",
              borderLeft: "1px solid rgba(177,140,255,.32)",
              borderTop: arrow === "top" ? "1px solid rgba(177,140,255,.32)" : undefined,
              borderBottom: arrow === "bottom" ? "1px solid rgba(177,140,255,.32)" : undefined,
              transform: arrow === "top" ? "rotate(45deg)" : "rotate(225deg)",
            }}
          />
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", background: `${tour.accent}24`, color: tour.accent, flexShrink: 0 }}>
            <Icon size={14} strokeWidth={2.1} />
          </span>
          <span style={{ flex: 1, fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: tour.accent }}>
            {tour.title}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(235,228,255,.5)", fontVariantNumeric: "tabular-nums" }}>
            {idx + 1} / {total}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Exit tutorial"
            title="Exit (Esc)"
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              border: "none",
              background: "rgba(255,255,255,.07)",
              color: "rgba(255,255,255,.75)",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        <h3 style={{ margin: "0 0 6px", fontSize: 16.5, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>{step.title}</h3>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(235,228,255,.75)", lineHeight: 1.6 }}>{step.body}</p>

        {/* progress bar */}
        <div style={{ height: 4, borderRadius: 999, background: "rgba(255,255,255,.09)", marginTop: 14, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              borderRadius: 999,
              background: tour.accent,
              width: `${((idx + 1) / total) * 100}%`,
              transition: "width .3s ease",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
          <button
            type="button"
            onClick={onPrev}
            disabled={idx === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.14)",
              background: "rgba(255,255,255,.05)",
              color: idx === 0 ? "rgba(255,255,255,.3)" : "rgba(255,255,255,.85)",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: idx === 0 ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >
            <ChevronLeft size={14} /> Back
          </button>
          {idx === total - 1 ? (
            <button
              type="button"
              onClick={onNext}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 18px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg,#7B2FBE,#A78BFA)",
                color: "#fff",
                fontSize: 12.5,
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 8px 24px rgba(123,47,190,.4)",
              }}
            >
              Finish <Check size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 18px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg,#7B2FBE,#A78BFA)",
                color: "#fff",
                fontSize: 12.5,
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 8px 24px rgba(123,47,190,.4)",
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          )}
        </div>

        {idx === 0 && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(235,228,255,.45)" }}>
            <Loader2 size={11} className="animate-spin" style={{ opacity: 0 }} />
            Tip: use ← → to navigate · Esc to exit
          </div>
        )}
      </div>
    </div>
  );
}