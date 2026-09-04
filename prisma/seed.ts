/* UKUU HR — demo seed. Mirrors the reference repo's DbSeeder:
   1 demo org, 8 employees, 30 days of attendance, leave, payroll,
   shifts, devices, holidays, documents, policies, messages, audit log. */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function daysAgo(n: number, hour = 9, min = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, min, 0, 0);
  return d;
}

async function main() {
  console.log("Seeding UKUU HR demo data…");

  // ── Organization + user ──
  const org = await db.organization.upsert({
    where: { slug: "ukuuhr-demo" },
    update: {},
    create: {
      name: "UkuuHR Demo Ltd",
      slug: "ukuuhr-demo",
      email: "admin@ukuuhr.demo",
      country: "Zambia",
      currency: "ZMW",
      plan: "Professional",
    },
  });

  await db.userAccount.upsert({
    where: { email: "admin@ukuuhr.demo" },
    update: {},
    create: {
      organizationId: org.id,
      name: "Chungu Chama",
      email: "admin@ukuuhr.demo",
      passwordHash: "demo", // mock auth — not used in production
      role: "SuperAdmin",
    },
  });

  // ── Departments ──
  const deptNames = [
    ["Executive", "#7B2FBE"],
    ["Product", "#7B2FBE"],
    ["Finance", "#2563EB"],
    ["Operations", "#14a37f"],
    ["Customer Care", "#e85d75"],
    ["Engineering", "#d89c11"],
    ["Human Resources", "#6c63ff"],
  ] as const;
  const depts: Record<string, string> = {};
  for (const [name, color] of deptNames) {
    let d = await db.department.findFirst({ where: { organizationId: org.id, name } });
    if (!d) d = await db.department.create({ data: { organizationId: org.id, name, color } });
    depts[name] = d.id;
  }

  // ── 8 Employees ──
  const seedEmployees = [
    { code: "UKU-001", first: "Chungu", last: "Chama", email: "chungu@ukuuhr.demo", phone: "+260 977 100 001", position: "Chief Executive Officer", dept: "Executive", type: "Full-time", status: "Active", hire: daysAgo(900), salary: 45000, rating: 4.8, nrc: "123456/78/1", tpin: "1000123456", bank: "ZANACO", acct: "6020000012345", branch: "Cairo Road" },
    { code: "UKU-002", first: "Amara", last: "Nkole", email: "amara@ukuuhr.demo", phone: "+260 977 100 002", position: "Product Manager", dept: "Product", type: "Full-time", status: "Active", hire: daysAgo(620), salary: 22000, rating: 4.6, nrc: "223344/55/6", tpin: "1000234567", bank: "Stanbic", acct: "9130000023456", branch: "Northmead" },
    { code: "UKU-003", first: "Thandi", last: "Mumba", email: "thandi@ukuuhr.demo", phone: "+260 977 100 003", position: "Finance Manager", dept: "Finance", type: "Full-time", status: "Active", hire: daysAgo(480), salary: 24000, rating: 4.4, nrc: "334455/66/7", tpin: "1000345678", bank: "Zanaco", acct: "6020000034567", branch: "Cairo Road" },
    { code: "UKU-004", first: "Kito", last: "Mwamba", email: "kito@ukuuhr.demo", phone: "+260 977 100 004", position: "Operations Lead", dept: "Operations", type: "Full-time", status: "Active", hire: daysAgo(390), salary: 18500, rating: 4.2, nrc: "445566/77/8", tpin: "1000456789", bank: "FNB", acct: "7100000045678", branch: "Lusaka" },
    { code: "UKU-005", first: "Ruth", last: "Mwape", email: "ruth@ukuuhr.demo", phone: "+260 977 100 005", position: "Customer Care Lead", dept: "Customer Care", type: "Full-time", status: "Active", hire: daysAgo(300), salary: 14000, rating: 4.5, nrc: "556677/88/9", tpin: "1000567890", bank: "Atlas Mara", acct: "6230000056789", branch: "Cairo Road" },
    { code: "UKU-006", first: "Joseph", last: "Mwila Phiri", email: "joseph@ukuuhr.demo", phone: "+260 977 100 006", position: "Senior Engineer", dept: "Engineering", type: "Full-time", status: "Active", hire: daysAgo(520), salary: 26000, rating: 4.7, nrc: "667788/99/1", tpin: "1000678901", bank: "Stanbic", acct: "9130000067890", branch: "Northmead" },
    { code: "UKU-007", first: "Grace", last: "Mwape", email: "grace@ukuuhr.demo", phone: "+260 977 100 007", position: "Software Engineer", dept: "Engineering", type: "Full-time", status: "Probation", hire: daysAgo(120), salary: 16000, rating: 4.0, nrc: "778899/00/2", tpin: "1000789012", bank: "Zanaco", acct: "6020000078901", branch: "Cairo Road" },
    { code: "UKU-008", first: "Bwalya", last: "Tembo", email: "bwalya@ukuuhr.demo", phone: "+260 977 100 008", position: "HR Officer", dept: "Human Resources", type: "Part-time", status: "Active", hire: daysAgo(210), salary: 12500, rating: 4.1, nrc: "889900/11/3", tpin: "1000890123", bank: "FNB", acct: "7100000089012", branch: "Lusaka" },
  ] as const;

  const empIds: string[] = [];
  for (const e of seedEmployees) {
    const emp = await db.employee.upsert({
      where: { employeeCode: e.code },
      update: {},
      create: {
        organizationId: org.id,
        employeeCode: e.code,
        firstName: e.first,
        lastName: e.last,
        email: e.email,
        phone: e.phone,
        position: e.position,
        departmentId: depts[e.dept],
        employmentType: e.type,
        status: e.status,
        hireDate: e.hire,
        salary: e.salary,
        rating: e.rating,
        nrc: e.nrc,
        tpin: e.tpin,
        bankName: e.bank,
        bankAccountNumber: e.acct,
        bankBranch: e.branch,
        basicSalary: e.salary,
        probationEndDate: e.status === "Probation" ? daysAgo(-150) : null,
      },
    });
    empIds.push(emp.id);
  }

  // ── Shift + tolerance ──
  const dayShift = await db.shift.upsert({
    where: { id: "shift-day" },
    update: {},
    create: {
      id: "shift-day",
      organizationId: org.id,
      name: "Day Shift",
      type: "Fixed",
      startTime: "08:00",
      endTime: "17:00",
      color: "#7B2FBE",
    },
  });
  await db.shift.upsert({
    where: { id: "shift-night" },
    update: {},
    create: {
      id: "shift-night",
      organizationId: org.id,
      name: "Night Shift",
      type: "Overnight",
      startTime: "20:00",
      endTime: "04:00",
      color: "#2563EB",
    },
  });
  await db.shift.upsert({
    where: { id: "shift-flex" },
    update: {},
    create: {
      id: "shift-flex",
      organizationId: org.id,
      name: "Flexible",
      type: "Flexible",
      startTime: "07:00",
      endTime: "15:30",
      color: "#14a37f",
    },
  });
  await db.attendanceTolerance.upsert({
    where: { id: "tol-main" },
    update: {},
    create: {
      id: "tol-main",
      organizationId: org.id,
      lateMinutes: 10,
      earlyDepartureMinutes: 10,
      halfDayMinutes: 240,
      absentMinutes: 480,
      gracePeriodMinutes: 5,
    },
  });
  for (const id of empIds) {
    await db.employeeShiftAssignment.upsert({
      where: { id: `assign-${id}` },
      update: {},
      create: { id: `assign-${id}`, organizationId: org.id, employeeId: id, shiftId: dayShift.id, isPrimary: true },
    });
  }

  // ── 30 days of attendance (weekdays) ──
  const statuses = ["Present", "Present", "Present", "Late", "Present", "Absent", "OnLeave"] as const;
  let attCount = 0;
  for (let day = 29; day >= 0; day--) {
    const date = daysAgo(day, 0, 0);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue; // weekends off
    empIds.forEach((id, i) => {
      const status = statuses[(i + day) % statuses.length];
      const checkIn = daysAgo(day, 8, 45 + ((i * 7) % 40));
      if (status === "Absent") {
        db.attendance.create({
          data: { organizationId: org.id, employeeId: id, date, status: "Absent", workedHours: 0, source: "Device" },
        }).catch(() => {});
      } else if (status === "OnLeave") {
        db.attendance.create({
          data: { organizationId: org.id, employeeId: id, date, status: "OnLeave", workedHours: 0, source: "Manual" },
        }).catch(() => {});
      } else {
        const late = status === "Late" ? 14 : 0;
        checkIn.setHours(8, 55 + late, 0, 0);
        const checkOut = new Date(checkIn);
        checkOut.setHours(17, 2, 0, 0);
        const hours = (checkOut.getTime() - checkIn.getTime()) / 3600000 - 1; // minus lunch
        db.attendance.create({
          data: {
            organizationId: org.id,
            employeeId: id,
            date,
            checkIn,
            checkOut,
            workedHours: Math.round(hours * 10) / 10,
            status,
            shiftName: dayShift.name,
            source: i % 3 === 0 ? "Device" : i % 3 === 1 ? "CSV" : "API",
          },
        }).catch(() => {});
      }
      attCount++;
    });
  }
  console.log(`  …${attCount} attendance rows`);

  // ── Leave types + requests ──
  for (const [name, days, color] of [
    ["Annual", 20, "#7B2FBE"],
    ["Sick", 10, "#14a37f"],
    ["Maternity", 120, "#e85d75"],
    ["Study", 15, "#2563EB"],
  ] as const) {
    await db.leaveType.upsert({
      where: { id: `lt-${name}` },
      update: {},
      create: { id: `lt-${name}`, organizationId: org.id, name, daysPerYear: days, color },
    });
  }
  const leaveSeeds = [
    { emp: 1, type: "Annual", start: 7, end: 11, status: "Pending", reason: "Family visit to Copperbelt" },
    { emp: 4, type: "Sick", start: 2, end: 3, status: "Pending", reason: "Malaria recovery" },
    { emp: 6, type: "Annual", start: 14, end: 18, status: "Approved", reason: "Annual vacation" },
    { emp: 3, type: "Annual", start: -20, end: -16, status: "Approved", reason: "Personal leave" },
    { emp: 7, type: "Sick", start: -9, end: -8, status: "Approved", reason: "Medical appointment" },
  ] as const;
  for (const l of leaveSeeds) {
    await db.leaveRequest.create({
      data: {
        organizationId: org.id,
        employeeId: empIds[l.emp - 1],
        type: l.type,
        startDate: daysAgo(l.start),
        endDate: daysAgo(l.end),
        daysUsed: Math.max(1, l.start - l.end + 1),
        status: l.status,
        reason: l.reason,
        reviewedAt: l.status === "Approved" ? daysAgo(1) : null,
        reviewedBy: l.status === "Approved" ? "Chungu Chama" : null,
      },
    });
  }

  // ── Holidays ──
  for (const [name, day, month] of [
    ["New Year's Day", 1, 0],
    ["International Women's Day", 8, 2],
    ["Good Friday", 18, 3],
    ["Labour Day", 1, 4],
    ["Africa Freedom Day", 25, 4],
    ["Heroes' Day", 7, 6],
    ["Unity Day", 8, 6],
    ["Farmers' Day", 4, 7],
    ["Youth Day", 12, 7],
    ["Independence Day", 24, 9],
    ["Christmas Day", 25, 11],
  ] as const) {
    const d = new Date();
    d.setMonth(month, day);
    await db.leaveHoliday.upsert({
      where: { id: `hol-${name.replace(/[^a-z]/gi, "")}` },
      update: {},
      create: { id: `hol-${name.replace(/[^a-z]/gi, "")}`, organizationId: org.id, name, date: d, country: "Zambia" },
    });
  }

  // ── Payroll: previous month approved + current month draft ──
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = prev.getMonth() + 1;
  const prevYear = prev.getFullYear();

  const runPrev = await db.payrollRun.create({
    data: {
      organizationId: org.id,
      periodMonth: prevMonth,
      periodYear: prevYear,
      status: "Approved",
      approvedAt: daysAgo(3),
    },
  });
  const runCur = await db.payrollRun.create({
    data: { organizationId: org.id, periodMonth: curMonth, periodYear: curYear, status: "Draft" },
  });

  for (let i = 0; i < seedEmployees.length; i++) {
    const e = seedEmployees[i];
    const gross = e.salary;
    const nAPSA = Math.min(gross * 0.05, 9870);
    const nhima = gross * 0.01;
    const taxable = gross - nAPSA;
    let paye = 0;
    if (taxable > 4800) paye += Math.min(taxable - 4800, 2100) * 0.2;
    if (taxable > 6900) paye += Math.min(taxable - 6900, 2000) * 0.3;
    if (taxable > 8900) paye += (taxable - 8900) * 0.375;
    const net = gross - nAPSA - nhima - paye;
    for (const run of [runPrev, runCur]) {
      await db.payrollItem.create({
        data: {
          payrollRunId: run.id,
          employeeId: empIds[i],
          employeeCode: e.code,
          employeeName: `${e.first} ${e.last}`,
          basicSalary: gross,
          gross: Math.round(gross * 100) / 100,
          nAPSA: Math.round(nAPSA * 100) / 100,
          nhima: Math.round(nhima * 100) / 100,
          paye: Math.round(paye * 100) / 100,
          net: Math.round(net * 100) / 100,
          workedHours: 176,
          overtimeHours: i % 3 === 0 ? 4.2 : 0,
          overtimePay: i % 3 === 0 ? 350 : 0,
        },
      });
    }
  }

  // ── Devices ──
  const devices = [
    { name: "Main Entrance", vendor: "Hikvision", model: "DS-K1T671", ip: "192.168.1.50", status: "Online" },
    { name: "Factory Gate", vendor: "ZKTeco", model: "MBAs-VLite", ip: "192.168.1.51", status: "Online" },
    { name: "Warehouse", vendor: "Suprema", model: "BioStation A2", ip: "192.168.1.52", status: "Offline" },
    { name: "Head Office", vendor: "Dahua", model: "DHI-ASR1201A", ip: "192.168.1.53", status: "Online" },
  ] as const;
  for (const d of devices) {
    await db.attendanceDevice.upsert({
      where: { id: `dev-${d.name.replace(/\s/g, "-").toLowerCase()}` },
      update: {},
      create: {
        id: `dev-${d.name.replace(/\s/g, "-").toLowerCase()}`,
        organizationId: org.id,
        name: d.name,
        vendor: d.vendor,
        model: d.model,
        ipAddress: d.ip,
        port: 80,
        integrationMode: "REST",
        status: d.status,
        lastSyncAt: d.status === "Online" ? daysAgo(0, 8, 30) : null,
      },
    });
  }

  // ── Documents / policies / messages / audit / license ──
  await db.employeeDocument.createMany({
    data: [
      { organizationId: org.id, employeeId: empIds[0], category: "Contract", title: "Employment Contract", fileName: "contract-chungu.pdf", fileType: "application/pdf", fileSize: 245760 },
      { organizationId: org.id, employeeId: empIds[1], category: "ID", title: "National ID (NRC)", fileName: "nrc-amara.pdf", fileType: "application/pdf", fileSize: 183500 },
      { organizationId: org.id, employeeId: empIds[5], category: "Payslip", title: "Payslip — July", fileName: "payslip-joseph.pdf", fileType: "application/pdf", fileSize: 92160 },
      { organizationId: org.id, employeeId: null, category: "Policy", title: "Remote Work Policy", fileName: "remote-work-policy.pdf", fileType: "application/pdf", fileSize: 310272 },
      { organizationId: org.id, employeeId: null, category: "Policy", title: "Code of Conduct", fileName: "code-of-conduct.pdf", fileType: "application/pdf", fileSize: 402432 },
    ],
  });
  await db.hrPolicy.createMany({
    data: [
      { organizationId: org.id, category: "Attendance", title: "Clock-in & Clock-out Policy", content: "All employees must clock in within the 5-minute grace period of their shift start. Late arrivals beyond 10 minutes are flagged." },
      { organizationId: org.id, category: "Leave", title: "Annual Leave Policy", content: "Employees accrue 20 days of annual leave per year. Requests must be submitted at least 2 weeks in advance." },
      { organizationId: org.id, category: "Payroll", title: "Payroll Cycle", content: "Payroll runs on the last working day of the month. Statutory deductions follow ZRA 2025 PAYE brackets, NAPSA 5% capped at ZMW 9,870, and NHIMA 1%." },
    ],
  });
  const conv = await db.hrConversation.create({
    data: { organizationId: org.id, participant: "Thandi Mumba", title: "Payroll questions" },
  });
  await db.hrMessage.createMany({
    data: [
      { conversationId: conv.id, senderName: "Thandi Mumba", content: "Hi Chungu — is the July payroll run approved?", isSent: false },
      { conversationId: conv.id, senderName: "Chungu Chama", content: "Yes, approved yesterday. Payslips are being emailed today.", isSent: true },
    ],
  });
  await db.auditLog.createMany({
    data: [
      { organizationId: org.id, userName: "Chungu Chama", action: "LOGIN", entityType: "UserAccount", details: "Signed in successfully" },
      { organizationId: org.id, userName: "Chungu Chama", action: "PAYROLL_APPROVE", entityType: "PayrollRun", details: "Approved July 2026 payroll run" },
      { organizationId: org.id, userName: "Chungu Chama", action: "ATTENDANCE_CORRECT", entityType: "Attendance", details: "Corrected Thandi Mumba check-in to 08:57" },
      { organizationId: org.id, userName: "System", action: "DEVICE_SYNC", entityType: "AttendanceDevice", details: "Main Entrance synced 214 events" },
    ],
  });
  await db.licenseCode.create({
    data: { organizationId: org.id, code: "UKUU-2026-PRO-DEMO", plan: "Professional", status: "Active", activatedAt: daysAgo(120), expiresAt: daysAgo(-245) },
  });

  console.log("✅ Seed complete — UkuuHR Demo Ltd ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());