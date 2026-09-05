import "server-only";
import { db } from "@/lib/db";
import { currentOrg } from "@/lib/session";

/* All helpers are defensive: if the database is unreachable they return
   empty/default shapes so pages still render. */

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
const money = (n: number): number => Math.round(n * 100) / 100;
const dayStart = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

type Safe<T> = { ok: true; data: T } | { ok: false; data: T };

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<Safe<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch {
    return { ok: false, data: fallback };
  }
}

/* ───────────────────────── dashboard ───────────────────────── */

export async function getDashboardData() {
  return safe(async () => {
    const today = dayStart(new Date());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const org = await currentOrg();
    const orgId = org?.id ?? "none";

    const [employees, attendance, leaveReqs, overtime, devices, monthAtt, monthOt] = await Promise.all([
      db.employee.findMany({ where: { organizationId: orgId }, include: { department: true } }),
      db.attendance.findMany({ where: { organizationId: orgId, date: today } }),
      db.leaveRequest.findMany({ where: { organizationId: orgId } }),
      db.overtimeRecord.findMany({ where: { organizationId: orgId, status: "Pending" } }),
      db.attendanceDevice.findMany({ where: { organizationId: orgId, isActive: true } }),
      db.attendance.findMany({ where: { organizationId: orgId, date: { gte: monthStart } } }),
      db.overtimeRecord.findMany({ where: { organizationId: orgId, status: { not: "Rejected" }, date: { gte: monthStart } } }),
    ]);

    const present = attendance.filter((a) => a.status === "Present" || a.status === "Late").length;
    const onLeave = attendance.filter((a) => a.status === "OnLeave").length;
    const late = attendance.filter((a) => a.status === "Late").length;
    const pct = attendance.length > 0 ? (present / attendance.length) * 100 : 0;
    const pendingLeave = leaveReqs.filter((l) => l.status === "Pending").length;
    const approvedThisMonth = leaveReqs.filter(
      (l) => l.status === "Approved" && l.reviewedAt && l.reviewedAt.getMonth() === today.getMonth()
    ).length;
    const worked = monthAtt.reduce((s, a) => s + a.workedHours, 0);
    const overtimeH = monthOt.reduce((s, o) => s + o.hours, 0);
    const days = Math.max(1, today.getDate());
    const online = devices.filter((d) => d.status === "Online").length;

    return {
      orgName: org?.name ?? "UkuuHR Demo Ltd",
      totalEmployees: employees.length,
      activeEmployees: employees.filter((e) => e.status === "Active").length,
      onProbation: employees.filter((e) => e.status === "Probation").length,
      attendancePct: Math.round(pct * 10) / 10,
      presentToday: present,
      lateToday: late,
      onLeaveToday: onLeave,
      pendingLeave,
      approvedThisMonth,
      pendingOvertime: overtime.length,
      totalWorkedHours: Math.round(worked * 10) / 10,
      totalOvertimeHours: Math.round(overtimeH * 10) / 10,
      avgHoursPerDay: Math.round((worked / days) * 10) / 10,
      totalDevices: devices.length,
      onlineDevices: online,
      offlineDevices: devices.filter((d) => d.status === "Offline").length,
      errorDevices: devices.filter((d) => d.status === "Error").length,
      devices: devices.map((d) => ({
        id: d.id,
        name: d.name,
        vendor: d.vendor,
        status: d.status,
        lastSyncAt: iso(d.lastSyncAt),
      })),
      todayAttendance: attendance.map((a) => ({
        id: a.id,
        employeeName: employees.find((e) => e.id === a.employeeId)?.firstName + " " + (employees.find((e) => e.id === a.employeeId)?.lastName ?? ""),
        status: a.status,
        checkIn: a.checkIn ? a.checkIn.toTimeString().slice(0, 5) : "—",
        checkOut: a.checkOut ? a.checkOut.toTimeString().slice(0, 5) : "—",
        hours: Math.round(a.workedHours * 10) / 10,
      })),
      pendingOvertimeRecords: overtime.map((o) => ({
        id: o.id,
        employeeName: employees.find((e) => e.id === o.employeeId)?.firstName + " " + (employees.find((e) => e.id === o.employeeId)?.lastName ?? ""),
        date: o.date.toISOString().slice(0, 10),
        hours: Math.round(o.hours * 10) / 10,
        rateType: o.rateType,
      })),
    };
  }, {
    orgName: "UkuuHR Demo Ltd", totalEmployees: 0, activeEmployees: 0, onProbation: 0,
    attendancePct: 0, presentToday: 0, lateToday: 0, onLeaveToday: 0, pendingLeave: 0,
    approvedThisMonth: 0, pendingOvertime: 0, totalWorkedHours: 0, totalOvertimeHours: 0,
    avgHoursPerDay: 0, totalDevices: 0, onlineDevices: 0, offlineDevices: 0, errorDevices: 0,
    devices: [], todayAttendance: [], pendingOvertimeRecords: [],
  });
}

/* ───────────────────────── employees ───────────────────────── */

export async function getEmployees() {
  return safe(async () => {
    const org = await currentOrg();
    const list = await db.employee.findMany({
      where: { organizationId: org?.id ?? "none" },
      include: { department: true },
      orderBy: { hireDate: "asc" },
    });
    return list.map((e) => ({
      id: e.id,
      code: e.employeeCode,
      firstName: e.firstName,
      lastName: e.lastName,
      email: e.email,
      phone: e.phone ?? "",
      position: e.position,
      department: e.department?.name ?? "—",
      departmentColor: e.department?.color ?? "#7B2FBE",
      employmentType: e.employmentType,
      status: e.status,
      hireDate: iso(e.hireDate),
      salary: e.salary,
      basicSalary: e.basicSalary,
      rating: e.rating,
      nrc: e.nrc ?? "",
      tpin: e.tpin ?? "",
    }));
  }, []);
}

export async function getEmployeeDetail(id: string) {
  return safe(async () => {
    const e = await db.employee.findUnique({
      where: { id },
      include: {
        department: true,
        leaveRequests: { orderBy: { createdAt: "desc" }, take: 5 },
        attendances: { orderBy: { date: "desc" }, take: 5 },
        documents: true,
      },
    });
    if (!e) return null;
    return {
      id: e.id,
      code: e.employeeCode,
      firstName: e.firstName,
      lastName: e.lastName,
      email: e.email,
      phone: e.phone ?? "",
      position: e.position,
      department: e.department?.name ?? "—",
      departmentColor: e.department?.color ?? "#7B2FBE",
      employmentType: e.employmentType,
      status: e.status,
      hireDate: iso(e.hireDate),
      salary: e.salary,
      basicSalary: e.basicSalary,
      rating: e.rating,
      nrc: e.nrc ?? "",
      tpin: e.tpin ?? "",
      bankName: e.bankName ?? "",
      bankAccountNumber: e.bankAccountNumber ?? "",
      bankBranch: e.bankBranch ?? "",
      address: e.address ?? "",
      emergencyContact: e.emergencyContact ?? "",
      gender: e.gender ?? "",
      maritalStatus: e.maritalStatus ?? "",
      dateOfBirth: iso(e.dateOfBirth),
      leaveRequests: e.leaveRequests.map((l) => ({
        id: l.id, type: l.type, startDate: iso(l.startDate), endDate: iso(l.endDate), status: l.status, reason: l.reason ?? "",
      })),
      attendances: e.attendances.map((a) => ({
        id: a.id, date: iso(a.date), status: a.status, checkIn: a.checkIn ? a.checkIn.toTimeString().slice(0, 5) : "—",
        checkOut: a.checkOut ? a.checkOut.toTimeString().slice(0, 5) : "—", hours: Math.round(a.workedHours * 10) / 10,
      })),
      documents: e.documents.map((d) => ({ id: d.id, title: d.title, category: d.category, fileName: d.fileName ?? "", uploadedAt: iso(d.uploadedAt) })),
    };
  }, null);
}

/* ───────────────────────── attendance ───────────────────────── */

export async function getAttendance(date?: string) {
  return safe(async () => {
    const org = await currentOrg();
    const day = date ? new Date(date) : new Date();
    const start = dayStart(day);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const [rows, employees] = await Promise.all([
      db.attendance.findMany({
        where: { organizationId: org?.id ?? "none", date: { gte: start, lt: end } },
        orderBy: { checkIn: "asc" },
      }),
      db.employee.findMany({ where: { organizationId: org?.id ?? "none" } }),
    ]);
    return rows.map((a) => ({
      id: a.id,
      employeeId: a.employeeId,
      employeeName: (employees.find((e) => e.id === a.employeeId)?.firstName ?? "") + " " + (employees.find((e) => e.id === a.employeeId)?.lastName ?? ""),
      status: a.status,
      checkIn: a.checkIn ? a.checkIn.toTimeString().slice(0, 5) : "—",
      checkOut: a.checkOut ? a.checkOut.toTimeString().slice(0, 5) : "—",
      hours: Math.round(a.workedHours * 10) / 10,
      shiftName: a.shiftName ?? "Day Shift",
      source: a.source ?? "Manual",
      reviewed: a.reviewed,
    }));
  }, []);
}

export async function getAttendanceLogs() {
  return safe(async () => {
    const org = await currentOrg();
    const rows = await db.attendance.findMany({
      where: { organizationId: org?.id ?? "none" },
      orderBy: { date: "desc" },
      take: 200,
    });
    const employees = await db.employee.findMany({ where: { organizationId: org?.id ?? "none" } });
    return rows.map((a) => ({
      id: a.id,
      employeeName: (employees.find((e) => e.id === a.employeeId)?.firstName ?? "") + " " + (employees.find((e) => e.id === a.employeeId)?.lastName ?? ""),
      date: iso(a.date),
      status: a.status,
      checkIn: a.checkIn ? a.checkIn.toTimeString().slice(0, 5) : "—",
      checkOut: a.checkOut ? a.checkOut.toTimeString().slice(0, 5) : "—",
      hours: Math.round(a.workedHours * 10) / 10,
      shiftName: a.shiftName ?? "Day Shift",
      source: a.source ?? "Manual",
    }));
  }, []);
}

export async function getClockEvents() {
  return safe(async () => {
    const org = await currentOrg();
    return (await db.unifiedClockEvent.findMany({
      where: { organizationId: org?.id ?? "none" },
      orderBy: { eventTime: "desc" },
      take: 30,
    })).map((c) => ({ id: c.id, employeeCode: c.employeeCode, eventType: c.eventType, eventTime: iso(c.eventTime) }));
  }, []);
}

/* ───────────────────── device imports ───────────────────── */

export async function getDeviceImports() {
  return safe(async () => {
    const org = await currentOrg();
    const rows = await db.attendance.findMany({
      where: { organizationId: org?.id ?? "none", source: "Device", note: { contains: "Imported from" } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    const employees = await db.employee.findMany({ where: { organizationId: org?.id ?? "none" } });
    return rows.map((a) => ({
      id: a.id,
      employeeName: (employees.find((e) => e.id === a.employeeId)?.firstName ?? "") + " " + (employees.find((e) => e.id === a.employeeId)?.lastName ?? ""),
      date: a.date.toISOString().slice(0, 10),
      checkIn: a.checkIn ? a.checkIn.toTimeString().slice(0, 5) : "—",
      checkOut: a.checkOut ? a.checkOut.toTimeString().slice(0, 5) : "—",
      hours: Math.round(a.workedHours * 10) / 10,
      status: a.status,
      device: (a.note ?? "").replace(/^Imported from\s*/i, ""),
    }));
  }, []);
}

/* ───────────────────────── leave ───────────────────────── */

export async function getLeave() {
  return safe(async () => {
    const org = await currentOrg();
    const orgId = org?.id ?? "none";
    const [requests, types, holidays, employees] = await Promise.all([
      db.leaveRequest.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" } }),
      db.leaveType.findMany({ where: { organizationId: orgId } }),
      db.leaveHoliday.findMany({ where: { organizationId: orgId }, orderBy: { date: "asc" } }),
      db.employee.findMany({ where: { organizationId: orgId } }),
    ]);
    return {
      requests: requests.map((r) => ({
        id: r.id,
        employeeName: (employees.find((e) => e.id === r.employeeId)?.firstName ?? "") + " " + (employees.find((e) => e.id === r.employeeId)?.lastName ?? ""),
        type: r.type,
        startDate: iso(r.startDate),
        endDate: iso(r.endDate),
        days: r.daysUsed,
        status: r.status,
        reason: r.reason ?? "",
      })),
      types: types.map((t) => ({ id: t.id, name: t.name, daysPerYear: t.daysPerYear, color: t.color })),
      holidays: holidays.map((h) => ({ id: h.id, name: h.name, date: iso(h.date), country: h.country })),
    };
  }, { requests: [], types: [], holidays: [] });
}

/* ───────────────────────── payroll ───────────────────────── */

export async function getPayroll() {
  return safe(async () => {
    const org = await currentOrg();
    const runs = await db.payrollRun.findMany({
      where: { organizationId: org?.id ?? "none" },
      include: { items: true },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    });
    return runs.map((r) => ({
      id: r.id,
      period: `${r.periodYear}-${String(r.periodMonth).padStart(2, "0")}`,
      periodLabel: new Date(r.periodYear, r.periodMonth - 1, 1).toLocaleString("en", { month: "long", year: "numeric" }),
      status: r.status,
      totalGross: money(r.items.reduce((s, i) => s + i.gross, 0)),
      totalNet: money(r.items.reduce((s, i) => s + i.net, 0)),
      totalPaye: money(r.items.reduce((s, i) => s + i.paye, 0)),
      employees: r.items.length,
      approvedAt: iso(r.approvedAt),
      items: r.items.map((i) => ({
        id: i.id,
        employeeCode: i.employeeCode,
        employeeName: i.employeeName,
        gross: i.gross,
        nAPSA: i.nAPSA,
        nhima: i.nhima,
        paye: i.paye,
        net: i.net,
        overtimePay: i.overtimePay,
        workedHours: i.workedHours,
        overtimeHours: i.overtimeHours,
      })),
    }));
  }, []);
}

/* ───────────────────────── shifts ───────────────────────── */

export async function getShifts() {
  return safe(async () => {
    const org = await currentOrg();
    const orgId = org?.id ?? "none";
    const [shifts, assignments, deptAssigns, tolerance] = await Promise.all([
      db.shift.findMany({ where: { organizationId: orgId } }),
      db.employeeShiftAssignment.findMany({ where: { organizationId: orgId }, include: { shift: true } }),
      db.departmentShiftAssignment.findMany({ where: { organizationId: orgId }, include: { shift: true } }),
      db.attendanceTolerance.findFirst({ where: { organizationId: orgId } }),
    ]);
    const employees = await db.employee.findMany({ where: { organizationId: orgId } });

    // Display metadata derived from shift properties (matches the reference shift cards)
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const meta = (name: string, type: string, start: string, end: string) => {
      let s = toMin(start);
      let e = toMin(end);
      if (e <= s) e += 1440; // overnight rollover
      const plannedHours = Math.round(((e - s) / 60) * 10) / 10;
      const breakMinutes = /flex/i.test(name) ? 45 : /weekend/i.test(name) ? 0 : 60;
      const weekdays = /weekend/i.test(name)
        ? [6, 7]
        : /night/i.test(name) || /rotating/i.test(name)
          ? [1, 2, 3, 4, 5, 6, 7]
          : [1, 2, 3, 4, 5];
      return {
        plannedHours,
        breakMinutes,
        weekdays,
        flexRange: /flex/i.test(name) ? "6.0h - 9.0h" : null,
        rotation: /rotating/i.test(name) ? "2 slots x 7 days" : null,
        overnight: type === "Overnight" ? "Crosses midnight" : null,
      };
    };

    const enriched = shifts.map((s) => {
      const m = meta(s.name, s.type, s.startTime, s.endTime);
      return {
        id: s.id,
        name: s.name,
        type: s.type,
        startTime: s.startTime,
        endTime: s.endTime,
        color: s.color,
        description: s.description ?? "",
        isActive: s.isActive,
        plannedHours: m.plannedHours,
        breakMinutes: m.breakMinutes,
        weekdays: m.weekdays,
        flexRange: m.flexRange,
        rotation: m.rotation,
        overnight: m.overnight,
        assignedCount: assignments.filter((a) => a.shiftId === s.id).length,
      };
    });

    return {
      shifts: enriched,
      assignments: assignments.map((a) => ({
        id: a.id,
        employeeName: (employees.find((e) => e.id === a.employeeId)?.firstName ?? "") + " " + (employees.find((e) => e.id === a.employeeId)?.lastName ?? ""),
        shiftName: a.shift.name,
        shiftStart: a.shift.startTime,
        shiftEnd: a.shift.endTime,
        isPrimary: a.isPrimary,
        effectiveFrom: iso(a.effectiveFrom),
      })),
      deptAssignments: deptAssigns.map((d) => ({ id: d.id, departmentId: d.departmentId, shiftName: d.shift.name, dayMask: d.dayMask })),
      tolerance: tolerance
        ? { lateMinutes: tolerance.lateMinutes, earlyDepartureMinutes: tolerance.earlyDepartureMinutes, halfDayMinutes: tolerance.halfDayMinutes, absentMinutes: tolerance.absentMinutes, gracePeriodMinutes: tolerance.gracePeriodMinutes }
        : { lateMinutes: 10, earlyDepartureMinutes: 10, halfDayMinutes: 240, absentMinutes: 480, gracePeriodMinutes: 5 },
      counts: {
        totalShifts: shifts.length,
        activeAssignments: assignments.length,
        shiftTypesUsed: new Set(shifts.map((s) => s.type)).size,
        employeesScheduled: new Set(assignments.map((a) => a.employeeId)).size,
      },
    };
  }, { shifts: [], assignments: [], deptAssignments: [], tolerance: { lateMinutes: 10, earlyDepartureMinutes: 10, halfDayMinutes: 240, absentMinutes: 480, gracePeriodMinutes: 5 }, counts: { totalShifts: 0, activeAssignments: 0, shiftTypesUsed: 0, employeesScheduled: 0 } });
}

/* ───────────────────────── overtime ───────────────────────── */

export async function getOvertime() {
  return safe(async () => {
    const org = await currentOrg();
    const orgId = org?.id ?? "none";
    const [records, employees] = await Promise.all([
      db.overtimeRecord.findMany({ where: { organizationId: orgId }, orderBy: { date: "desc" } }),
      db.employee.findMany({ where: { organizationId: orgId } }),
    ]);
    return records.map((o) => ({
      id: o.id,
      employeeName: (employees.find((e) => e.id === o.employeeId)?.firstName ?? "") + " " + (employees.find((e) => e.id === o.employeeId)?.lastName ?? ""),
      date: iso(o.date),
      hours: Math.round(o.hours * 10) / 10,
      rateType: o.rateType,
      status: o.status,
      reason: o.reason ?? "",
    }));
  }, []);
}

/* ───────────────────────── devices ───────────────────────── */

export async function getDevices() {
  return safe(async () => {
    const org = await currentOrg();
    return (await db.attendanceDevice.findMany({
      where: { organizationId: org?.id ?? "none" },
      orderBy: { name: "asc" },
    })).map((d) => ({
      id: d.id,
      name: d.name,
      vendor: d.vendor,
      model: d.model ?? "",
      ipAddress: d.ipAddress ?? "",
      integrationMode: d.integrationMode,
      status: d.status,
      isActive: d.isActive,
      autoSyncEnabled: d.autoSyncEnabled,
      syncIntervalMinutes: d.syncIntervalMinutes,
      lastSyncAt: iso(d.lastSyncAt),
      lastError: d.lastError ?? "",
    }));
  }, []);
}

/* ───────────────────────── reports ───────────────────────── */

export async function getReportsData() {
  return safe(async () => {
    const org = await currentOrg();
    const orgId = org?.id ?? "none";
    const [employees, attendances, payrollRuns] = await Promise.all([
      db.employee.findMany({ where: { organizationId: orgId }, include: { department: true } }),
      db.attendance.findMany({ where: { organizationId: orgId } }),
      db.payrollRun.findMany({ where: { organizationId: orgId }, include: { items: true }, orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }] }),
    ]);
    // department distribution
    const deptMap = new Map<string, number>();
    employees.forEach((e) => {
      const name = e.department?.name ?? "Unassigned";
      deptMap.set(name, (deptMap.get(name) ?? 0) + 1);
    });
    // payroll spend per run (last 6)
    const spend = payrollRuns.slice(-6).map((r) => ({
      label: `${r.periodYear}-${String(r.periodMonth).padStart(2, "0")}`,
      total: money(r.items.reduce((s, i) => s + i.gross, 0)),
      net: money(r.items.reduce((s, i) => s + i.net, 0)),
    }));
    // status distribution
    const statusMap = new Map<string, number>();
    attendances.forEach((a) => statusMap.set(a.status, (statusMap.get(a.status) ?? 0) + 1));
    return {
      departments: [...deptMap.entries()].map(([name, count]) => ({ name, count })),
      statuses: [...statusMap.entries()].map(([name, count]) => ({ name, count })),
      spend,
      totalEmployees: employees.length,
      totalAttendance: attendances.length,
      payrollRuns: payrollRuns.length,
    };
  }, { departments: [], statuses: [], spend: [], totalEmployees: 0, totalAttendance: 0, payrollRuns: 0 });
}

/* ───────────────────────── timecards ───────────────────────── */

export async function getTimeCards() {
  return safe(async () => {
    const org = await currentOrg();
    const orgId = org?.id ?? "none";
    const [attendances, employees] = await Promise.all([
      db.attendance.findMany({ where: { organizationId: orgId }, orderBy: { date: "desc" }, take: 100 }),
      db.employee.findMany({ where: { organizationId: orgId } }),
    ]);
    const byEmp = new Map<string, { name: string; days: number; hours: number; late: number }>();
    attendances.forEach((a) => {
      const cur = byEmp.get(a.employeeId) ?? { name: "", days: 0, hours: 0, late: 0 };
      cur.name = (employees.find((e) => e.id === a.employeeId)?.firstName ?? "") + " " + (employees.find((e) => e.id === a.employeeId)?.lastName ?? "");
      if (a.status !== "Absent" && a.status !== "OnLeave") cur.days++;
      cur.hours += a.workedHours;
      if (a.status === "Late") cur.late++;
      byEmp.set(a.employeeId, cur);
    });
    return [...byEmp.entries()].map(([id, v]) => ({
      id,
      name: v.name,
      days: v.days,
      hours: Math.round(v.hours * 10) / 10,
      late: v.late,
      avg: v.days > 0 ? Math.round((v.hours / v.days) * 10) / 10 : 0,
    }));
  }, []);
}

/* ───────────────────────── documents ───────────────────────── */

export async function getDocuments() {
  return safe(async () => {
    const org = await currentOrg();
    const orgId = org?.id ?? "none";
    const [docs, policies] = await Promise.all([
      db.employeeDocument.findMany({ where: { organizationId: orgId }, orderBy: { uploadedAt: "desc" } }),
      db.hrPolicy.findMany({ where: { organizationId: orgId } }),
    ]);
    return {
      documents: docs.map((d) => ({ id: d.id, title: d.title, category: d.category, fileName: d.fileName ?? "", fileSize: d.fileSize, uploadedAt: iso(d.uploadedAt) })),
      policies: policies.map((p) => ({ id: p.id, category: p.category, title: p.title, content: p.content })),
    };
  }, { documents: [], policies: [] });
}

/* ───────────────────────── messages ───────────────────────── */

export async function getMessages() {
  return safe(async () => {
    const org = await currentOrg();
    const orgId = org?.id ?? "none";
    const convs = await db.hrConversation.findMany({ where: { organizationId: orgId }, include: { messages: { orderBy: { sentAt: "asc" } } }, orderBy: { createdAt: "desc" } });
    return convs.map((c) => ({
      id: c.id,
      participant: c.participant,
      title: c.title ?? "",
      messages: c.messages.map((m) => ({ id: m.id, senderName: m.senderName, content: m.content, isSent: m.isSent, sentAt: iso(m.sentAt) })),
    }));
  }, []);
}

/* ───────────────────────── settings ───────────────────────── */

export async function getSettings() {
  return safe(async () => {
    const org = await currentOrg();
    const orgId = org?.id ?? "none";
    const [branches, users, leaveTypes, notifications, licenses, employees, departments, apiKeys] = await Promise.all([
      db.branch.findMany({ where: { organizationId: orgId } }),
      db.userAccount.findMany({ where: { organizationId: orgId } }),
      db.leaveType.findMany({ where: { organizationId: orgId } }),
      db.notification.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 10 }),
      db.licenseCode.findFirst({ where: { organizationId: orgId } }),
      db.employee.count({ where: { organizationId: orgId } }),
      db.department.findMany({ where: { organizationId: orgId } }),
      db.apiKey.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" } }),
    ]);
    return {
      org: org ? { id: org.id, name: org.name, email: org.email ?? "", country: org.country, currency: org.currency, plan: org.plan } : null,
      branches: branches.map((b) => ({ id: b.id, name: b.name, city: b.city ?? "", address: b.address ?? "", isHeadOffice: b.isHeadOffice })),
      users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, lastLoginAt: iso(u.lastLoginAt) })),
      leaveTypes: leaveTypes.map((t) => ({ id: t.id, name: t.name, daysPerYear: t.daysPerYear, color: t.color })),
      notifications: notifications.map((n) => ({ id: n.id, title: n.title, message: n.message, read: n.read, createdAt: iso(n.createdAt) })),
      license: licenses ? { code: licenses.code, plan: licenses.plan, status: licenses.status, expiresAt: iso(licenses.expiresAt) } : null,
      employeeCount: employees,
      departments: departments.map((d) => ({ id: d.id, name: d.name })),
      apiKeys: apiKeys.map((k) => ({
        id: k.id,
        name: k.name,
        masked: `${k.prefix}${new Array(24).fill("•").join("")}`,
        scopes: k.scopes,
        scopeLabels: k.scopes.split(",").map((s) => s.trim().split(":")[0]),
        isActive: k.isActive,
        lastUsedAt: iso(k.lastUsedAt),
        createdAt: iso(k.createdAt),
        rotatedAt: iso(k.rotatedAt),
      })),
    };
  }, { org: null, branches: [], users: [], leaveTypes: [], notifications: [], license: null, employeeCount: 0, departments: [], apiKeys: [] });
}

/* ───────────────────────── security / billing / super admin ───────────────────────── */

export async function getSecurityData() {
  return safe(async () => {
    const org = await currentOrg();
    const logs = await db.auditLog.findMany({ where: { organizationId: org?.id ?? "none" }, orderBy: { createdAt: "desc" }, take: 50 });
    return logs.map((l) => ({ id: l.id, userName: l.userName, action: l.action, entityType: l.entityType ?? "", details: l.details ?? "", createdAt: iso(l.createdAt) }));
  }, []);
}

export async function getBillingData() {
  return safe(async () => {
    const org = await currentOrg();
    const orgWithUsers = org
      ? await db.organization.findUnique({ where: { id: org.id }, include: { users: true } })
      : null;
    const license = await db.licenseCode.findFirst({ where: { organizationId: org?.id ?? "none" } });
    const employees = await db.employee.count({ where: { organizationId: org?.id ?? "none" } });
    return {
      orgName: org?.name ?? "UkuuHR Demo Ltd",
      plan: license?.plan ?? "Trial",
      status: license?.status ?? "Active",
      licenseCode: license?.code ?? "UKUU-2026-PRO-DEMO",
      expiresAt: iso(license?.expiresAt),
      users: orgWithUsers?.users.length ?? 1,
      employees,
    };
  }, { orgName: "UkuuHR Demo Ltd", plan: "Trial", status: "Active", licenseCode: "—", expiresAt: null, users: 1, employees: 0 });
}

export async function getSuperAdminData() {
  return safe(async () => {
    const [orgs, users, devices, runs] = await Promise.all([
      db.organization.findMany({ include: { _count: { select: { employees: true, users: true } } } }),
      db.userAccount.count(),
      db.attendanceDevice.count(),
      db.payrollRun.count(),
    ]);
    return {
      orgs: orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug ?? "", plan: o.plan, employees: o._count.employees, users: o._count.users })),
      userCount: users,
      deviceCount: devices,
      payrollRunCount: runs,
    };
  }, { orgs: [], userCount: 0, deviceCount: 0, payrollRunCount: 0 });
}

/* ───────────────────────── platform account dashboard (admin portal) ───────────────────────── */

export async function getPlatformAccountData() {
  return safe(async () => {
    const [orgs, users, coupons, devices] = await Promise.all([
      db.organization.findMany({
        include: { _count: { select: { employees: true, users: true } } },
        orderBy: { createdAt: "asc" },
      }),
      db.userAccount.findMany({
        include: { organization: { select: { name: true, slug: true } } },
        orderBy: { createdAt: "asc" },
      }),
      db.coupon.findMany({ orderBy: { createdAt: "desc" } }),
      db.attendanceDevice.count(),
    ]);
    const orgById = new Map((orgs as Array<{ id: string; name: string }>).map((o) => [o.id, o]));
    return {
      orgs: orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug ?? "", plan: o.plan, employees: o._count.employees, users: o._count.users })),
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        lastLoginAt: iso(u.lastLoginAt),
        createdAt: iso(u.createdAt),
        orgName: u.organization?.name ?? (orgById.get(u.organizationId ?? "")?.name ?? "Platform"),
      })),
      coupons: coupons.map((c) => ({
        id: c.id,
        code: c.code,
        discountPercent: c.discountPercent,
        plan: c.plan ?? "All plans",
        status: c.status,
        expiresAt: iso(c.expiresAt),
        description: c.description ?? "",
        createdAt: iso(c.createdAt),
        redeemedAt: iso(c.redeemedAt),
        redeemedByOrgName: c.redeemedByOrgName ?? null,
      })),
      orgCount: orgs.length,
      userCount: users.length,
      activeCouponCount: coupons.filter((c) => c.status === "Active").length,
      couponCount: coupons.length,
      deviceCount: devices,
    };
  }, { orgs: [], users: [], coupons: [], orgCount: 0, userCount: 0, activeCouponCount: 0, couponCount: 0, deviceCount: 0 });
}