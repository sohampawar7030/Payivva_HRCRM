import { query } from '../config/db.js';
import { settingsService } from './settingsService.js';
import { siteService } from './siteService.js';

const PRESENT_STATUSES = ['Present', 'present', 'P'];
const DENIED_STATUSES = ['Denied', 'denied', 'D'];
const LEAVE_STATUSES = ['leave', 'Leave'];

function toLocal(dateStr, tzOffsetMin) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return new Date(d.getTime() + tzOffsetMin * 60000);
}

function sameDay(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function parseShiftTime(timeStr) {
  const [h, m] = String(timeStr || '09:30').split(':').map(Number);
  return { h: h || 0, m: m || 0 };
}

function toMinutes(d) {
  return d.getHours() * 60 + d.getMinutes();
}

function diffMinutes(a, b) {
  return Math.round((b - a) / 60000);
}

function dayKeyFromDate(d, tzMin) {
  if (!d) return null;
  const local = new Date(d.getTime() + tzMin * 60000);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
}

/** Local-timezone day keys inside the on-hold ranges (resume day = working day). */
function buildHoldDayKeys(info, fromDate, toDate) {
  const keys = new Set();
  if (!info || !info.intervals.length) return keys;
  const { intervals, tzMin } = info;
  for (const iv of intervals) {
    const startKey = iv.start ? dayKeyFromDate(iv.start, tzMin) : fromDate;
    const endKey = iv.end ? dayKeyFromDate(iv.end, tzMin) : toDate;
    if (!startKey || !endKey || endKey <= startKey) continue;
    let d = new Date(`${startKey}T00:00:00Z`);
    const last = new Date(`${endKey}T00:00:00Z`);
    const inclusiveEnd = !iv.end; // ongoing hold → include the month's last day
    for (; inclusiveEnd ? d <= last : d < last; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      if (key >= fromDate && key <= toDate) keys.add(key);
    }
  }
  return keys;
}

/**
 * attendanceService — the ONLY layer that touches the existing `attendance` table.
 * The other software writes GPS check-in/check-out rows; HRCRM reads them for
 * summaries, dashboards and salary calculations. HRCRM never writes to this table.
 */
export const attendanceService = {
  PRESENT_STATUSES,
  DENIED_STATUSES,

  async timezoneOffsetMin() {
    const tz = (await settingsService.get('attendanceTimezone', '+05:30')) || '+05:30';
    const match = tz.match(/^([+-])(\d{2}):?(\d{2})$/);
    if (!match) return 330;
    const sign = match[1] === '-' ? -1 : 1;
    return sign * (Number(match[2]) * 60 + Number(match[3]));
  },

  async getShift() {
    const rows = await query(
      `SELECT * FROM hrms_shifts WHERE isDefault = 1 ORDER BY id LIMIT 1`
    );
    return rows[0] || { name: 'General Shift', startTime: '09:30', endTime: '18:30', graceMinutes: 15 };
  },

  /** Raw rows for an employee within a local-date window. */
  async getRawRecords(employeeId, fromDate, toDate) {
    const tzMin = await this.timezoneOffsetMin();
    const tz = `+${String(Math.floor(Math.abs(tzMin) / 60)).padStart(2, '0')}:${String(Math.abs(tzMin) % 60).padStart(2, '0')}`;
    return query(
      `SELECT id, employeeId, siteId, checkin_time, checkout_time, latitude, longitude, distance, status,
              DATE(CONVERT_TZ(checkin_time, '+00:00', ?)) AS localDate
       FROM attendance
       WHERE employeeId = ?
         AND DATE(CONVERT_TZ(checkin_time, '+00:00', ?)) BETWEEN ? AND ?
       ORDER BY checkin_time ASC`,
      [tz, employeeId, tz, fromDate, toDate]
    );
  },

  /** Per-day aggregation for an employee. */
  async getDailyRecords(employeeId, fromDate, toDate, holdKeys = null) {
    const raw = await this.getRawRecords(employeeId, fromDate, toDate);
    const shift = await this.getShift();
    const tzMin = await this.timezoneOffsetMin();
    if (!holdKeys) {
      holdKeys = buildHoldDayKeys(await siteService.getHoldInfoForEmployee(employeeId, tzMin), fromDate, toDate);
    }
    const { h: sh, m: sm } = parseShiftTime(shift.startTime);
    const { h: eh, m: em } = parseShiftTime(shift.endTime);
    const grace = Number(shift.graceMinutes) || 15;
    const shiftStartMin = sh * 60 + sm;
    const shiftEndMin = eh * 60 + em;

    const byDay = new Map();
    for (const row of raw) {
      const key = String(row.localDate);
      if (!byDay.has(key)) {
        byDay.set(key, {
          date: key,
          status: 'absent',
          checkin: null,
          checkout: null,
          checkinTime: null,
          checkoutTime: null,
          totalMinutes: 0,
          lateMinutes: 0,
          earlyExitMinutes: 0,
          overtimeMinutes: 0,
          attempts: 0,
          deniedAttempts: 0,
          isSiteHold: holdKeys.has(key),
          raw: [],
        });
      }
      const day = byDay.get(key);
      day.attempts++;
      const ci = toLocal(row.checkin_time, tzMin);
      const co = toLocal(row.checkout_time, tzMin);

      if (PRESENT_STATUSES.includes(row.status)) {
        if (!day.checkin || (ci && ci < day.checkin)) {
          day.checkin = ci;
          day.checkinTime = row.checkin_time;
        }
        if (co && (!day.checkout || co > day.checkout)) {
          day.checkout = co;
          day.checkoutTime = row.checkout_time;
        }
      } else if (DENIED_STATUSES.includes(row.status)) {
        day.deniedAttempts++;
      }
      day.raw.push(row);
    }

    const result = [];
    for (const day of byDay.values()) {
      if (day.checkin) {
        day.status = 'present';
        if (day.checkout) {
          day.totalMinutes = diffMinutes(day.checkin, day.checkout);
          const ciMin = toMinutes(day.checkin);
          const coMin = toMinutes(day.checkout);
          day.lateMinutes = Math.max(0, ciMin - (shiftStartMin + grace));
          day.earlyExitMinutes = Math.max(0, shiftEndMin - coMin);
          day.overtimeMinutes = Math.max(0, coMin - shiftEndMin);
        } else {
          const now = new Date();
          day.totalMinutes = diffMinutes(day.checkin, now);
          const ciMin = toMinutes(day.checkin);
          day.lateMinutes = Math.max(0, ciMin - (shiftStartMin + grace));
        }
        if (day.lateMinutes > 0) day.status = 'late';
      }
      if (day.isSiteHold && !day.checkin) day.status = 'hold';
      result.push(day);
    }
    result.sort((a, b) => (a.date < b.date ? -1 : 1));
    return result;
  },

  /** Monthly summary consumed by salaryService and dashboards. */
  async getMonthlySummary(employeeId, year, month) {
    const first = `${year}-${String(month).padStart(2, '0')}-01`;
    const last = new Date(year, month, 0);
    const lastStr = `${year}-${String(month).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;

    const tzMin = await this.timezoneOffsetMin();
    const holdKeys = buildHoldDayKeys(await siteService.getHoldInfoForEmployee(employeeId, tzMin), first, lastStr);

    const daily = await this.getDailyRecords(employeeId, first, lastStr, holdKeys);
    const [leaves, specialLeaves] = await Promise.all([
      query(
        `SELECT leaveType, startDate, endDate, days, status FROM hrcrm_leaves
         WHERE employeeId = ? AND status = 'director_approved'
           AND startDate <= ? AND endDate >= ?`,
        [employeeId, lastStr, first]
      ),
      query(
        `SELECT leaveType, startDate, endDate FROM hrcrm_leaves
         WHERE employeeId = ? AND status = 'director_approved'
           AND leaveType IN ('half_day','wfh')
           AND startDate <= ? AND endDate >= ?`,
        [employeeId, lastStr, first]
      ),
    ]);

    const leaveDaysSet = new Set();
    const specialLeaveDays = new Map();
    let leaveDays = 0;
    for (const l of leaves) {
      const s = new Date(l.startDate);
      const e = new Date(l.endDate);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        leaveDaysSet.add(key);
      }
      leaveDays += Number(l.days || 0);
    }
    for (const l of specialLeaves) {
      const s = new Date(l.startDate);
      const e = new Date(l.endDate);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!leaveDaysSet.has(key)) specialLeaveDays.set(key, l.leaveType);
      }
    }

    let presentDays = 0;
    let halfDays = 0;
    let wfhDays = 0;
    let lateDays = 0;
    let overtimeMinutes = 0;
    let totalMinutes = 0;
    const workedDates = new Set();

    for (const day of daily) {
      if (leaveDaysSet.has(day.date)) continue;
      const special = specialLeaveDays.get(day.date);
      if (special) {
        if (special === 'half_day') halfDays += 0.5;
        if (special === 'wfh') wfhDays += 1;
        continue;
      }
      if (day.status === 'hold') continue;
      if (day.status === 'present' || day.status === 'late') {
        presentDays += 1;
        workedDates.add(day.date);
        totalMinutes += day.totalMinutes;
        overtimeMinutes += day.overtimeMinutes;
        if (day.lateMinutes > 0) lateDays += 1;
      }
    }

    const monthlyWorkDays = Number(await settingsService.get('monthlyWorkDays', '26')) || 26;
    const shift = await this.getShift();

    // Hold days = site on-hold days in this month that were not worked and
    // are not leave — these must not count as absent.
    let holdDays = 0;
    const holdRows = [];
    if (holdKeys.size) {
      let d = new Date(`${first}T00:00:00Z`);
      const lastD = new Date(`${lastStr}T00:00:00Z`);
      for (; d <= lastD; d.setUTCDate(d.getUTCDate() + 1)) {
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        if (!holdKeys.has(key)) continue;
        if (leaveDaysSet.has(key) || specialLeaveDays.has(key) || workedDates.has(key)) continue;
        holdDays += 1;
        holdRows.push({
          date: key,
          status: 'hold',
          isWeekend: false,
          isHoliday: false,
          isSiteHold: true,
          isLeave: false,
          isHalfDay: false,
          isWfh: false,
          leaveType: null,
          checkIn: null,
          checkOut: null,
          hours: null,
          shiftName: shift.name || 'General Shift',
          lateMinutes: 0,
        });
      }
    }

    const absentDays = Math.max(0, monthlyWorkDays - presentDays - Math.floor(leaveDays) - halfDays - wfhDays - holdDays);

    const tzMin2 = await this.timezoneOffsetMin();
    const attendanceRows = daily.map((day) => {
      const isLeave = leaveDaysSet.has(day.date);
      const special = specialLeaveDays.get(day.date);
      const isHalfDay = special === 'half_day';
      const isWfh = special === 'wfh';
      return {
        date: day.date,
        status: day.status,
        isWeekend: false,
        isHoliday: false,
        isSiteHold: Boolean(day.isSiteHold),
        isLeave,
        isHalfDay,
        isWfh,
        leaveType: isLeave ? null : special || null,
        checkIn: day.checkin ? toLocal(day.checkinTime, tzMin2) : null,
        checkOut: day.checkout ? toLocal(day.checkoutTime, tzMin2) : null,
        hours: day.totalMinutes ? Number((day.totalMinutes / 60).toFixed(2)) : null,
        shiftName: shift.name || 'General Shift',
        lateMinutes: day.lateMinutes,
      };
    }).concat(holdRows).sort((a, b) => (a.date < b.date ? -1 : 1));

    return {
      year,
      month,
      first,
      last: lastStr,
      presentDays,
      absentDays,
      leaveDays,
      halfDays,
      wfhDays,
      holdDays,
      lateDays,
      overtimeMinutes,
      totalHours: Number((totalMinutes / 60).toFixed(2)),
      workDays: monthlyWorkDays,
      attendanceRows,
    };
  },

  /** Today's check-ins across all employees (admin/IT dashboards). */
  async getTodaySummary() {
    const tzMin = await this.timezoneOffsetMin();
    const tz = `+${String(Math.floor(Math.abs(tzMin) / 60)).padStart(2, '0')}:${String(Math.abs(tzMin) % 60).padStart(2, '0')}`;
    const rows = await query(
      `SELECT a.id, a.employeeId, a.checkin_time, a.checkout_time, a.status,
              e.name, e.employee_id, e.department, e.designation
       FROM attendance a
       JOIN employees e ON e.id = a.employeeId
       WHERE DATE(CONVERT_TZ(a.checkin_time, '+00:00', ?)) = CURDATE() - INTERVAL 0 DAY
       ORDER BY a.checkin_time DESC`,
      [tz]
    );
    const byEmployee = new Map();
    for (const r of rows) {
      if (!byEmployee.has(r.employeeId)) {
        byEmployee.set(r.employeeId, { ...r, checkins: 0, present: false, denied: 0 });
      }
      const d = byEmployee.get(r.employeeId);
      d.checkins++;
      if (PRESENT_STATUSES.includes(r.status)) d.present = true;
      else if (DENIED_STATUSES.includes(r.status)) d.denied++;
    }
    const shift = await this.getShift();
    const grace = Number(shift.graceMinutes) || 15;
    const { h: sh, m: sm } = parseShiftTime(shift.startTime);
    const shiftStartMin = sh * 60 + sm;
    return Array.from(byEmployee.values()).map((d) => {
      const ci = toLocal(d.checkin_time, tzMin);
      const co = toLocal(d.checkout_time, tzMin);
      let hours = null;
      if (ci && co) hours = Number(((co - ci) / 3600000).toFixed(2));
      else if (ci) hours = Number(((Date.now() - ci.getTime()) / 3600000).toFixed(2));
      return {
        id: d.id,
        employeeId: d.employeeId,
        employeeName: d.name,
        employeeCode: d.employee_id,
        department: d.department,
        designation: d.designation,
        checkinTime: d.checkin_time,
        checkoutTime: d.checkout_time,
        checkIn: ci,
        checkOut: co,
        hours,
        present: d.present,
        denied: d.denied,
        checkins: d.checkins,
        isLate: d.present && ci ? toMinutes(ci) > shiftStartMin + grace : false,
      };
    });
  },

  /** Range attendance for an employee (worker/IT/admin view). */
  async getRange(employeeId, fromDate, toDate) {
    return this.getDailyRecords(employeeId, fromDate, toDate);
  },

  /**
   * Site-wise worked days for one employee in a month.
   * Returns per-site day counts + per-date site map (for calendar view).
   */
  async getSiteWork(employeeId, year, month) {
    const first = `${year}-${String(month).padStart(2, '0')}-01`;
    const last = new Date(year, month, 0);
    const lastStr = `${year}-${String(month).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
    const tzMin = await this.timezoneOffsetMin();
    const tz = `+${String(Math.floor(Math.abs(tzMin) / 60)).padStart(2, '0')}:${String(Math.abs(tzMin) % 60).padStart(2, '0')}`;

    const rows = await query(
      `SELECT a.siteId, s.site_name, DATE_FORMAT(CONVERT_TZ(a.checkin_time, '+00:00', ?), '%Y-%m-%d') AS d
       FROM attendance a
       LEFT JOIN sites s ON s.id = a.siteId
       WHERE a.employeeId = ?
         AND a.status IN ('Present', 'present', 'P')
         AND DATE(CONVERT_TZ(a.checkin_time, '+00:00', ?)) BETWEEN ? AND ?
       GROUP BY a.siteId, s.site_name, DATE_FORMAT(CONVERT_TZ(a.checkin_time, '+00:00', ?), '%Y-%m-%d')
       ORDER BY d ASC`,
      [tz, employeeId, tz, first, lastStr, tz]
    );

    const sites = [];
    const bySite = new Map();
    const byDate = {};
    for (const r of rows) {
      const siteId = r.siteId;
      if (!bySite.has(siteId)) {
        const entry = { siteId, siteName: r.site_name || 'Unknown', days: 0, dates: [] };
        bySite.set(siteId, entry);
        sites.push(entry);
      }
      bySite.get(siteId).days += 1;
      bySite.get(siteId).dates.push(r.d);
      byDate[r.d] = { siteId, siteName: r.site_name || 'Unknown' };
    }
    sites.sort((a, b) => b.days - a.days);
    return { sites, byDate, month, year };
  },

  /**
   * Site-wise present days for ALL employees in a month (Director salary analysis).
   * employees[].sites[] = { siteId, siteName, days, dates[] }
   * calendar[] = { employeeId, date, siteId, siteName }
   */
  async getSiteAnalysis(year, month) {
    const first = `${year}-${String(month).padStart(2, '0')}-01`;
    const last = new Date(year, month, 0);
    const lastStr = `${year}-${String(month).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
    const tzMin = await this.timezoneOffsetMin();
    const tz = `+${String(Math.floor(Math.abs(tzMin) / 60)).padStart(2, '0')}:${String(Math.abs(tzMin) % 60).padStart(2, '0')}`;

    const rows = await query(
      `SELECT a.employeeId, e.name AS employee_name, e.employee_id, e.salary, e.wage_per_hour,
              a.siteId, s.site_name, DATE_FORMAT(CONVERT_TZ(a.checkin_time, '+00:00', ?), '%Y-%m-%d') AS d
       FROM attendance a
       JOIN employees e ON e.id = a.employeeId
       LEFT JOIN sites s ON s.id = a.siteId
       WHERE a.status IN ('Present', 'present', 'P')
         AND DATE(CONVERT_TZ(a.checkin_time, '+00:00', ?)) BETWEEN ? AND ?
       ORDER BY e.name ASC, d ASC`,
      [tz, tz, first, lastStr]
    );

    const employees = new Map();
    const calendar = [];
    for (const r of rows) {
      if (!employees.has(r.employeeId)) {
        employees.set(r.employeeId, {
          employeeId: r.employeeId,
          name: r.employee_name,
          employee_id: r.employee_id,
          salary: r.salary,
          wage_per_hour: r.wage_per_hour,
          totalDays: 0,
          sites: new Map(),
        });
      }
      const emp = employees.get(r.employeeId);
      if (!emp.sites.has(r.siteId)) {
        emp.sites.set(r.siteId, { siteId: r.siteId, siteName: r.site_name || 'Unknown', days: 0, dates: [] });
      }
      const site = emp.sites.get(r.siteId);
      site.days += 1;
      site.dates.push(r.d);
      emp.totalDays += 1;
      calendar.push({ employeeId: r.employeeId, date: r.d, siteId: r.siteId, siteName: r.site_name || 'Unknown' });
    }

    const result = Array.from(employees.values()).map((emp) => ({
      employeeId: emp.employeeId,
      name: emp.name,
      employee_id: emp.employee_id,
      salary: emp.salary,
      wage_per_hour: emp.wage_per_hour,
      totalDays: emp.totalDays,
      sites: Array.from(emp.sites.values()).map((s) => ({ ...s })).sort((a, b) => b.days - a.days),
    }));
    result.sort((a, b) => b.totalDays - a.totalDays);
    return { month, year, employees: result, calendar };
  },
};