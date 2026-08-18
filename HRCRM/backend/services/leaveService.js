import { query, queryOne, withTransaction } from '../config/db.js';
import { Errors } from '../utils/ApiError.js';
import { auditService } from './auditService.js';
import { notificationService } from './notificationService.js';
import { emailService } from './emailService.js';
import { salaryService } from './salaryService.js';
import { LEAVE_TYPE_LABELS } from '../../shared/constants.js';

function parseDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export const leaveService = {
  async create({ employeeId, leaveType, startDate, endDate, halfDay = 'none', reason, comments, supportingDocName, supportingDocContent, actor }) {
    const s = parseDate(startDate);
    const e = parseDate(endDate);
    if (!s || !e) throw Errors.badRequest('Valid start and end dates are required', 'INVALID_DATES');
    if (e < s) throw Errors.badRequest('End date cannot be before start date', 'INVALID_DATES');

    let days = Math.round((e - s) / 86400000) + 1;
    if (leaveType === 'half_day') {
      days = 0.5;
      if (e > s) throw Errors.badRequest('Half day leave can only be a single day', 'INVALID_HALF_DAY');
    } else if (leaveType === 'wfh') {
      // WFH days count as full working days
    }

    const balance = await this.getBalances(employeeId);
    const bal = balance.find((b) => b.leaveType === leaveType);
    if (bal && Number(bal.remaining) < days) {
      throw Errors.badRequest(
        `Insufficient ${LEAVE_TYPE_LABELS[leaveType]} balance (remaining: ${bal.remaining}, requested: ${days})`,
        'INSUFFICIENT_BALANCE'
      );
    }

    const result = await withTransaction(async (conn) => {
      const [ins] = await conn.query(
        `INSERT INTO hrcrm_leaves
           (employeeId, leaveType, startDate, endDate, halfDay, days, reason, comments, supportingDocName, supportingDocContent, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_it')`,
        [employeeId, leaveType, s, e, halfDay, days, reason || null, comments || null, supportingDocName || null, supportingDocContent || null]
      );
      if (bal) {
        await conn.query(
          `UPDATE hrcrm_leave_balances SET used = used + ? WHERE id = ?`,
          [days, bal.id]
        );
      }
      return ins.insertId;
    });

    const employee = await queryOne('SELECT name, email FROM employees WHERE id = ?', [employeeId]);
    await notificationService.createForRole({
      role: 'it',
      title: 'New leave request',
      message: `${employee?.name} requested ${days} day(s) of ${LEAVE_TYPE_LABELS[leaveType]}`,
      type: 'leave',
      relatedEntity: 'leave',
      relatedId: result,
    });
    await auditService.log({
      userId: actor?.id,
      action: 'CREATE',
      module: 'leave',
      entityId: result,
      description: `${employee?.name} requested ${days} day(s) of ${LEAVE_TYPE_LABELS[leaveType]}`,
      ip: actor?.ip,
    });
    return this.get(result);
  },

  async get(id) {
    const row = await queryOne(
      `SELECT l.*, e.name AS employeeName, e.employee_id AS employeeCode, e.email, e.department,
              u.name AS itReviewerName, d.name AS directorReviewerName
       FROM hrcrm_leaves l
       JOIN employees e ON e.id = l.employeeId
       LEFT JOIN hrcrm_users u ON u.id = l.itReviewedById
       LEFT JOIN hrcrm_users d ON d.id = l.directorReviewedById
       WHERE l.id = ?`,
      [id]
    );
    if (!row) throw Errors.notFound('Leave request not found');
    return row;
  },

  async list({ employeeId = null, status = null, leaveType = null, limit = 200, offset = 0 }) {
    const where = [];
    const params = [];
    if (employeeId) { where.push('l.employeeId = ?'); params.push(employeeId); }
    if (status) { where.push('l.status = ?'); params.push(status); }
    if (leaveType) { where.push('l.leaveType = ?'); params.push(leaveType); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await query(
      `SELECT l.*, e.name AS employeeName, e.employee_id AS employeeCode, e.department
       FROM hrcrm_leaves l JOIN employees e ON e.id = l.employeeId
       ${whereSql} ORDER BY l.createdAt DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM hrcrm_leaves l ${whereSql}`, params);
    return { rows, total };
  },

  async cancel(id, actor) {
    const leave = await queryOne('SELECT * FROM hrcrm_leaves WHERE id = ?', [id]);
    if (!leave) throw Errors.notFound('Leave request not found');
    if (!['pending_it', 'it_approved', 'pending_director', 'draft'].includes(leave.status)) {
      throw Errors.badRequest('This leave request can no longer be cancelled', 'NOT_CANCELLABLE');
    }
    await withTransaction(async (conn) => {
      await conn.query("UPDATE hrcrm_leaves SET status = 'cancelled' WHERE id = ?", [id]);
      await conn.query(
        `UPDATE hrcrm_leave_balances SET used = GREATEST(0, used - ?) WHERE employeeId = ? AND leaveType = ? AND year = YEAR(?)`,
        [Number(leave.days), leave.employeeId, leave.leaveType, leave.startDate]
      );
    });
    await auditService.log({
      userId: actor?.id,
      action: 'CANCEL',
      module: 'leave',
      entityId: id,
      description: `Leave request #${id} cancelled`,
      ip: actor?.ip,
    });
    return { success: true };
  },

  async review(id, { level, decision, remarks, actor }) {
    const leave = await queryOne('SELECT * FROM hrcrm_leaves WHERE id = ?', [id]);
    if (!leave) throw Errors.notFound('Leave request not found');
    if (['cancelled', 'director_approved', 'director_rejected'].includes(leave.status)) {
      throw Errors.badRequest(`Leave request already ${leave.status.replace('_', ' ')}`, 'NOT_REVIEWABLE');
    }
    if (level === 'it' && !['pending_it', 'draft'].includes(leave.status)) {
      throw Errors.badRequest('Leave is not in IT review stage', 'WRONG_STAGE');
    }
    if (level === 'director' && leave.status !== 'it_approved') {
      throw Errors.badRequest('Leave must be IT approved before Director review', 'WRONG_STAGE');
    }

    const colPrefix = level === 'it' ? 'it' : 'director';
    const status =
      level === 'it'
        ? decision === 'approved' ? 'pending_director' : 'it_rejected'
        : decision === 'approved' ? 'director_approved' : 'director_rejected';

    await withTransaction(async (conn) => {
      await conn.query(
        `UPDATE hrcrm_leaves SET status = ?, ${colPrefix}Status = ?, ${colPrefix}ReviewedById = ?, ${colPrefix}ReviewedAt = NOW(), ${colPrefix}Remarks = ?
         WHERE id = ?`,
        [status, decision, actor?.id || null, remarks || null, id]
      );
      if (level === 'director' && decision === 'rejected') {
        await conn.query(
          `UPDATE hrcrm_leave_balances SET used = GREATEST(0, used - ?) WHERE employeeId = ? AND leaveType = ? AND year = YEAR(?)`,
          [Number(leave.days), leave.employeeId, leave.leaveType, leave.startDate]
        );
      }
    });

    const worker = await queryOne(
      `SELECT u.id, e.email, e.name FROM hrcrm_users u JOIN employees e ON e.id = u.employeeId WHERE u.employeeId = ?`,
      [leave.employeeId]
    );
    if (worker) {
      await notificationService.create({
        userId: worker.id,
        title: decision === 'approved' ? 'Leave approved' : 'Leave rejected',
        message: `Your ${LEAVE_TYPE_LABELS[leave.leaveType]} (${leave.startDate} to ${leave.endDate}) was ${decision} by ${level === 'it' ? 'IT' : 'Director'}${decision === 'rejected' ? ` - ${remarks || 'No reason provided'}` : ''}`,
        type: 'leave',
        relatedEntity: 'leave',
        relatedId: id,
      });
    }
    if (decision === 'rejected' && worker?.email) {
      await emailService.send({
        to: worker.email,
        subject: `Leave request ${level === 'it' ? 'rejected by IT' : 'rejected by Director'}`,
        html: `<p>Dear ${worker.name},</p><p>Your ${LEAVE_TYPE_LABELS[leave.leaveType]} request (${leave.startDate} to ${leave.endDate}) was rejected by the ${level === 'it' ? 'IT Department' : 'Director'}.</p><p>Reason: ${remarks || 'Not specified'}</p>`,
        category: 'leave_notification',
        relatedEntity: 'leave',
        relatedId: id,
      });
    }
    if (decision === 'approved' && level === 'it') {
      await notificationService.createForRole({
        role: 'director',
        title: 'Leave awaiting Director approval',
        message: `${worker?.name || ''} leave request #${id} is awaiting your approval`,
        type: 'leave',
        relatedEntity: 'leave',
        relatedId: id,
      });
    }

    await this.recalcDraftPayrolls(leave);

    await auditService.log({
      userId: actor?.id,
      action: decision === 'approved' ? 'VERIFY_APPROVE' : 'VERIFY_REJECT',
      module: 'leave',
      entityId: id,
      description: `${actor?.name} ${decision} leave #${id} at ${level} level`,
      ip: actor?.ip,
    });
    return this.get(id);
  },

  /** Recompute draft payrolls for months overlapping the leave, so leaveDays stay in sync. */
  async recalcDraftPayrolls(leave) {
    const months = new Set();
    const s = new Date(leave.startDate);
    const e = new Date(leave.endDate);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      months.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
    }
    for (const key of months) {
      const [y, m] = key.split('-').map(Number);
      const existing = await queryOne(
        `SELECT id FROM hrcrm_payrolls WHERE employeeId = ? AND year = ? AND month = ? AND status = 'draft'`,
        [leave.employeeId, y, m]
      );
      if (existing) {
        await salaryService.saveDraft(leave.employeeId, y, m);
      }
    }
  },

  async getBalances(employeeId, year = new Date().getFullYear()) {
    const rows = await query(
      `SELECT * FROM hrcrm_leave_balances WHERE employeeId = ? AND year = ?`,
      [employeeId, year]
    );
    const map = {};
    for (const r of rows) {
      map[r.leaveType] = r;
    }
    for (const t of ['casual', 'privilege', 'half_day', 'wfh']) {
      if (!map[t]) {
        map[t] = { leaveType: t, total: 0, used: 0, year };
      }
    }
    return Object.values(map).map((b) => ({
      ...b,
      remaining: Number(Number(b.total - b.used).toFixed(1)),
    }));
  },
};