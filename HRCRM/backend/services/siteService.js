import { query, queryOne } from '../config/db.js';
import { Errors } from '../utils/ApiError.js';
import { auditService } from './auditService.js';
import { notificationService } from './notificationService.js';

const LEGACY_RUNNING = ['Running', 'running', 'Ongoing', 'ongoing', 'Active', 'active'];
const STATUSES = ['running', 'on_hold', 'stopped'];
const PAUSED = ['on_hold', 'stopped'];

/**
 * siteService — site status control ("Running" / "Stopped" / "On Hold").
 *
 * The `sites` table belongs to the other software; HRCRM never writes to it.
 * HRCRM keeps its own insert-only override log (hrcrm_site_status_history).
 * Effective status = latest HRCRM override, or the legacy `project_status`
 * when no override exists. While a site is on hold or stopped, attendance
 * for its workers is not counted as absent (see attendanceService).
 */
export const siteService = {
  async list() {
    const rows = await query(
      `SELECT s.id, s.site_name, s.site_code, s.city, s.state,
              s.project_status AS legacyStatus,
              h.status AS hrcrmStatus, h.notes, h.changedAt,
              u.name AS changedByName,
              (SELECT COUNT(*) FROM employees e WHERE e.siteId = s.id) AS workerCount
       FROM sites s
       LEFT JOIN hrcrm_site_status_history h
         ON h.id = (SELECT h2.id FROM hrcrm_site_status_history h2 WHERE h2.siteId = s.id ORDER BY h2.id DESC LIMIT 1)
       LEFT JOIN hrcrm_users u ON u.id = h.changedBy
       ORDER BY s.site_name ASC`
    );
    return rows.map((r) => ({
      ...r,
      status: r.hrcrmStatus || (LEGACY_RUNNING.includes(r.legacyStatus) ? 'running' : 'on_hold'),
      statusSource: r.hrcrmStatus ? 'hrcrm' : 'legacy',
    }));
  },

  async getById(siteId) {
    return queryOne(
      `SELECT s.id, s.site_name, s.site_code, s.project_status AS legacyStatus
       FROM sites s WHERE s.id = ?`,
      [siteId]
    );
  },

  async setStatus(siteId, status, notes, actor = null) {
    if (!STATUSES.includes(status)) throw Errors.badRequest('Invalid site status', 'INVALID_STATUS');
    const site = await this.getById(siteId);
    if (!site) throw Errors.notFound('Site not found');

    const result = await query(
      `INSERT INTO hrcrm_site_status_history (siteId, status, notes, changedBy)
       VALUES (?, ?, ?, ?)`,
      [siteId, status, notes || null, actor?.id || null]
    );

    const paused = PAUSED.includes(status);
    const label = status === 'running' ? 'RUNNING' : status === 'stopped' ? 'STOPPED' : 'ON HOLD';
    await auditService.log({
      userId: actor?.id,
      action: 'SITE_STATUS',
      module: 'site',
      entityId: siteId,
      description: `Site "${site.site_name}" (${site.site_code}) set to ${label}`,
      ip: actor?.ip,
    });

    if (paused) {
      await notificationService.createForRole({
        role: 'it',
        title: status === 'stopped' ? 'Site stopped' : 'Site on hold',
        message: `Site "${site.site_name}" is ${status === 'stopped' ? 'stopped' : 'on hold'}. Attendance is paused for its workers.`,
        type: 'info',
        relatedEntity: 'site',
        relatedId: siteId,
      });
    } else {
      const workers = await query(
        `SELECT u.id FROM hrcrm_users u
         JOIN employees e ON e.id = u.employeeId
         WHERE e.siteId = ? AND u.role = 'worker' AND u.status = 'active'`,
        [siteId]
      );
      for (const w of workers) {
        await notificationService.create({
          userId: w.id,
          title: 'Site running again',
          message: `Site "${site.site_name}" is running again. Attendance is active — check in as usual.`,
          type: 'info',
          relatedEntity: 'site',
          relatedId: siteId,
        });
      }
    }

    return { siteId, status, historyId: result.insertId, site };
  },

  /**
   * Hold info for a worker's site: effective status + on-hold day ranges
   * (local-timezone date keys). `intervals[].start`/`end` are Date objects;
   * `end === null` means the pause is still ongoing.
   */
  async getHoldInfoForEmployee(employeeId, tzMin) {
    const emp = await queryOne(
      `SELECT e.siteId, s.project_status AS legacyStatus
       FROM employees e
       LEFT JOIN sites s ON s.id = e.siteId
       WHERE e.id = ?`,
      [employeeId]
    );
    if (!emp?.siteId) return null;

    const history = await query(
      `SELECT status, changedAt FROM hrcrm_site_status_history
       WHERE siteId = ? ORDER BY id ASC`,
      [emp.siteId]
    );

    const current = history.length ? history[history.length - 1].status : null;
    const legacyHold = !LEGACY_RUNNING.includes(emp.legacyStatus);
    const effective = current || (legacyHold ? 'on_hold' : 'running');

    const intervals = [];
    let state = 'running';
    let start = null;
    for (const h of history) {
      if (PAUSED.includes(h.status) && state === 'running') {
        start = toDate(h.changedAt);
        state = 'paused';
      } else if (h.status === 'running' && state === 'paused' && start) {
        intervals.push({ start, end: toDate(h.changedAt) });
        state = 'running';
        start = null;
      }
    }
    if (state === 'paused' && start) intervals.push({ start, end: null });
    if (!history.length && legacyHold) intervals.push({ start: null, end: null });

    return { siteId: emp.siteId, status: effective, intervals, tzMin };
  },

  /** True when the worker's site is currently paused (on hold / stopped). */
  async isSiteOnHold(employeeId) {
    const info = await this.getHoldInfoForEmployee(employeeId, 0);
    return Boolean(info && PAUSED.includes(info.status));
  },
};

function toDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
