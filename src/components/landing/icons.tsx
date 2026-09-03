"use client"

import {
  ArrowRight, PlayCircle, Clock3, Globe, BadgeCheck, IdCard, CalendarCheck,
  CalendarClock, ShieldCheck, BarChart3, UserPlus, CheckCircle2, CalendarDays,
  X, Check, Zap, MonitorSmartphone, Link2, Home, ChevronLeft, ChevronRight,
  Download, Monitor, Laptop, Cpu, CircuitBoard, Code2, HeartPulse, RotateCcw,
  FolderOpen, Server, Lock, Package, LogIn, Plus, FileText, Calculator,
  AlertCircle, UserX, Sun, Moon, Terminal, Boxes, Cloud, Container,
  MonitorDown,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

type IconName =
  | "arrow_forward" | "play_circle" | "schedule" | "public" | "verified"
  | "badge" | "event_available" | "view_timeline" | "security" | "analytics"
  | "person_add" | "task_alt" | "calendar_month" | "close" | "check"
  | "bolt" | "devices" | "link" | "home" | "chevron_left" | "chevron_right"
  | "download" | "desktop_windows" | "laptop_mac" | "memory" | "developer_board"
  | "code" | "health_and_safety" | "restart_alt" | "folder_open" | "dns"
  | "lock" | "deployed_code" | "login" | "add" | "description" | "calculate"
  | "error_outline" | "person_off" | "light_mode" | "dark_mode" | "terminal"
  | "boxes" | "cloud" | "container" | "install_desktop"

const ICONS: Record<IconName, LucideIcon> = {
  arrow_forward: ArrowRight,
  play_circle: PlayCircle,
  schedule: Clock3,
  public: Globe,
  verified: BadgeCheck,
  badge: IdCard,
  event_available: CalendarCheck,
  view_timeline: CalendarClock,
  security: ShieldCheck,
  analytics: BarChart3,
  person_add: UserPlus,
  task_alt: CheckCircle2,
  calendar_month: CalendarDays,
  close: X,
  check: Check,
  bolt: Zap,
  devices: MonitorSmartphone,
  link: Link2,
  home: Home,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  download: Download,
  desktop_windows: Monitor,
  laptop_mac: Laptop,
  memory: Cpu,
  developer_board: CircuitBoard,
  code: Code2,
  health_and_safety: HeartPulse,
  restart_alt: RotateCcw,
  folder_open: FolderOpen,
  dns: Server,
  lock: Lock,
  deployed_code: Package,
  login: LogIn,
  add: Plus,
  description: FileText,
  calculate: Calculator,
  error_outline: AlertCircle,
  person_off: UserX,
  light_mode: Sun,
  dark_mode: Moon,
  terminal: Terminal,
  boxes: Boxes,
  cloud: Cloud,
  container: Container,
  install_desktop: MonitorDown,
}

export function MIcon({
  name,
  size = 24,
  className,
  strokeWidth = 2,
}: {
  name: IconName
  size?: number
  className?: string
  strokeWidth?: number
}) {
  const Icon = ICONS[name]
  if (!Icon) return null
  return (
    <Icon
      width={size}
      height={size}
      className={className}
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    />
  )
}

export type { IconName }
