import { query } from '../config/db.js';
import { settingsService } from './settingsService.js';

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
      `SELECT id, employeeId, checkin_time, checkout_time, latitude, longitude, distance, status,
              DATE(CONVERT_TZ(checkin_time, '+00:00', ?)) AS localDate
       FROM attendance
       WHERE employeeId = ?
         AND DATE(CONVERT_TZ(checkin_time, '+00:00', ?)) BETWEEN ? AND ?
       ORDER BY checkin_time ASC`,
      [tz, employeeId, tz, fromDate, toDate]
    );
  },

  /** Per-day aggregation for an employee. */
  async getDailyRecords(employeeId, fromDate, toDate) {
    const raw = await this.getRawRecords(employeeId, fromDate, toDate);
    const shift = await this.getShift();
    const tzMin = await this.timezoneOffsetMin();
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

    const daily = await this.getDailyRecords(employeeId, first, lastStr);
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

    for (const day of daily) {
      if (leaveDaysSet.has(day.date)) continue;
      const special = specialLeaveDays.get(day.date);
      if (special) {
        if (special === 'half_day') halfDays += 0.5;
        if (special === 'wfh') wfhDays += 1;
        continue;
      }
      if (day.status === 'present' || day.status === 'late') {
        presentDays += 1;
        totalMinutes += day.totalMinutes;
        overtimeMinutes += day.overtimeMinutes;
        if (day.lateMinutes > 0) lateDays += 1;
      }
    }

    const monthlyWorkDays = Number(await settingsService.get('monthlyWorkDays', '26')) || 26;
    const absentDays = Math.max(0, monthlyWorkDays - presentDays - Math.floor(leaveDays) - halfDays - wfhDays);

    const shift = await this.getShift();
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
    });

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
};