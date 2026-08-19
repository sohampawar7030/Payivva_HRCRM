import { asyncHandler, ok } from '../utils/asyncHandler.js';
import { query } from '../config/db.js';
import { attendanceService } from '../services/attendanceService.js';
import { leaveService } from '../services/leaveService.js';
import { salaryService } from '../services/salaryService.js';
import { documentService } from '../services/documentService.js';
import { employeeService } from '../services/employeeService.js';
import { siteService } from '../services/siteService.js';
import { Errors } from '../utils/ApiError.js';

export const dashboardController = {
  admin: asyncHandler(async (req, res) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const totalEmployees = await query('SELECT COUNT(*) AS cnt FROM employees');
    const activeEmployees = await query("SELECT COUNT(*) AS cnt FROM employees WHERE emp_status = 'Active'");
    const pendingVerifications = await query(
      `SELECT COUNT(*) AS cnt FROM hrcrm_verification WHERE profileStatus IN ('submitted','it_approved','it_rejected','director_rejected')`
    );
    const pendingLeaves = await query(`SELECT COUNT(*) AS cnt FROM hrcrm_leaves WHERE status IN ('pending_it','pending_director')`);
    const pendingDocs = await query(`SELECT COUNT(*) AS cnt FROM hrcrm_documents WHERE verificationStatus = 'pending'`);
    const incompleteProfiles = await query(
      `SELECT COUNT(*) AS cnt FROM employees e LEFT JOIN hrcrm_verification v ON v.employeeId = e.id
       WHERE v.profileStatus IS NULL OR v.profileStatus IN ('not_started','incomplete')`
    );
    const fullyVerified = await query(`SELECT COUNT(*) AS cnt FROM hrcrm_verification WHERE profileStatus = 'fully_verified'`);
    const salaryStatus = await query(
      'SELECT status, COUNT(*) AS cnt FROM hrcrm_payrolls WHERE year = ? AND month = ? GROUP BY status',
      [year, month]
    );
    const recentEmployees = await query(
      'SELECT id, employee_id, name, department, designation, joining_date FROM employees ORDER BY id DESC LIMIT 5'
    );
    const upcomingBirthdays = await query(
      `SELECT id, name, employee_id, dob, DATE_FORMAT(dob, '%m-%d') AS mday FROM employees
       WHERE dob IS NOT NULL AND emp_status = 'Active'
       ORDER BY (DATE_FORMAT(dob, '%m-%d') >= DATE_FORMAT(NOW(), '%m-%d')) DESC, DATE_FORMAT(dob, '%m-%d') ASC
       LIMIT 5`
    );
    const recentActivities = await query(
      `SELECT l.id, l.action, l.module, l.description, l.createdAt, u.name AS actorName, u.role AS actorRole
       FROM hrms_audit_logs l LEFT JOIN hrcrm_users u ON u.id = l.userId
       ORDER BY l.createdAt DESC LIMIT 8`
    );
    const todayAttendance = await attendanceService.getTodaySummary();
    const monthlySummary = await monthlyAttendanceSummary();
    const sites = await siteService.list();

    const payrollCounts = { draft: 0, finalized: 0, paid: 0 };
    for (const s of salaryStatus) payrollCounts[s.status] = s.cnt;

    ok(res, {
      stats: {
        totalEmployees: totalEmployees[0]?.cnt || 0,
        activeEmployees: activeEmployees[0]?.cnt || 0,
        fullyVerified: fullyVerified[0]?.cnt || 0,
        pendingVerifications: pendingVerifications[0]?.cnt || 0,
        pendingLeaves: pendingLeaves[0]?.cnt || 0,
        pendingDocs: pendingDocs[0]?.cnt || 0,
        incompleteProfiles: incompleteProfiles[0]?.cnt || 0,
        todayPresent: todayAttendance.filter((a) => a.present).length,
        todayCheckedIn: todayAttendance.length,
        ...monthlySummary,
        sitesOnHold: sites.filter((s) => s.status === 'on_hold').length,
        payroll: { ...payrollCounts, month, year },
      },
      todayAttendance,
      recentEmployees,
      upcomingBirthdays,
      recentActivities,
    });
  }),

  it: asyncHandler(async (req, res) => {
    const totalEmployees = await query('SELECT COUNT(*) AS cnt FROM employees');
    const pendingRegistrations = await query(`SELECT COUNT(*) AS cnt FROM hrcrm_users WHERE status = 'pending_onboarding'`);
    const pendingDocs = await query(`SELECT COUNT(*) AS cnt FROM hrcrm_documents WHERE verificationStatus = 'pending'`);
    const pendingLeaves = await query(`SELECT COUNT(*) AS cnt FROM hrcrm_leaves WHERE status = 'pending_it'`);
    const pendingProfiles = await query(`SELECT COUNT(*) AS cnt FROM hrcrm_verification WHERE profileStatus = 'submitted'`);
    const recentRegistrations = await query(
      `SELECT e.id, e.employee_id, e.name, e.department, e.designation, e.joining_date, u.status AS accountStatus
       FROM employees e LEFT JOIN hrcrm_users u ON u.employeeId = e.id ORDER BY e.id DESC LIMIT 6`
    );
    const recentDocs = await query(
      `SELECT d.id, d.docType, d.originalName, d.verificationStatus, d.uploadedAt, e.name AS employeeName
       FROM hrcrm_documents d JOIN employees e ON e.id = d.employeeId ORDER BY d.uploadedAt DESC LIMIT 6`
    );
    const emailActivity = await query(
      `SELECT category, status, COUNT(*) AS cnt FROM hrcrm_email_logs GROUP BY category, status ORDER BY MAX(sentAt) DESC LIMIT 10`
    );
    const todayAttendance = await attendanceService.getTodaySummary();

    ok(res, {
      stats: {
        totalEmployees: totalEmployees[0]?.cnt || 0,
        pendingRegistrations: pendingRegistrations[0]?.cnt || 0,
        pendingDocs: pendingDocs[0]?.cnt || 0,
        pendingLeaves: pendingLeaves[0]?.cnt || 0,
        pendingProfiles: pendingProfiles[0]?.cnt || 0,
        todayCheckedIn: todayAttendance.length,
        todayPresent: todayAttendance.filter((a) => a.present).length,
      },
      todayAttendance,
      recentRegistrations,
      recentDocs,
      emailActivity,
    });
  }),

  worker: asyncHandler(async (req, res) => {
    if (!req.user.employeeId) throw Errors.badRequest('No employee linked to this account', 'NO_EMPLOYEE');
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const profile = await employeeService.getFullProfile(req.user.employeeId);
    const [leaveRows] = await Promise.all([
      leaveService.getBalances(req.user.employeeId, year),
    ]);
    const leaveRequests = await leaveService.list({ employeeId: req.user.employeeId, limit: 5 });
    const attendance = await attendanceService.getMonthlySummary(req.user.employeeId, year, month);
    const siteWork = await attendanceService.getSiteWork(req.user.employeeId, year, month);
    const payroll = await salaryService.getPayroll(req.user.employeeId, year, month);
    const letters = await (await import('../services/letterService.js')).letterService.list({ employeeId: req.user.employeeId, limit: 5 });
    const documents = await documentService.listForEmployee(req.user.employeeId);
    const upcomingLeaves = await query(
      `SELECT * FROM hrcrm_leaves WHERE employeeId = ? AND status = 'director_approved' AND endDate >= CURDATE() ORDER BY startDate ASC LIMIT 3`,
      [req.user.employeeId]
    );

    ok(res, {
      profileCompletion: profile.profileCompletion,
      verification: profile.verification,
      canEdit: await employeeService.canEditProfile(req.user.employeeId, 'worker'),
      leaveBalances: leaveRows,
      leaveRequests: leaveRequests.rows,
      attendance: { presentDays: attendance.presentDays, absentDays: attendance.absentDays, leaveDays: attendance.leaveDays, halfDays: attendance.halfDays, holdDays: attendance.holdDays || 0, lateDays: attendance.lateDays, totalHours: attendance.totalHours },
      siteWork,
      payroll,
      letters: letters.rows,
      documents: documents.map((d) => ({ id: d.id, docType: d.docType, originalName: d.originalName, verificationStatus: d.verificationStatus, version: d.version })),
      upcomingLeaves,
    });
  }),
};

async function monthlyAttendanceSummary() {
  const rows = await query(
    `SELECT DATE_FORMAT(CONVERT_TZ(checkin_time, '+00:00', '+05:30'), '%Y-%m') AS ym,
            COUNT(DISTINCT employeeId) AS checkedIn
     FROM attendance
     WHERE CONVERT_TZ(checkin_time, '+00:00', '+05:30') >= DATE_FORMAT(NOW(), '%Y-%m-01')
     GROUP BY ym`
  );
  const checkedIn = rows[0]?.checkedIn || 0;
  const total = await query('SELECT COUNT(*) AS cnt FROM employees WHERE emp_status = ?', ['Active']);
  return { monthlyCheckedIn: checkedIn, monthlyNotCheckedIn: Math.max(0, (total[0]?.cnt || 0) - checkedIn) };
}