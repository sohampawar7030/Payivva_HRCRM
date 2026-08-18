import { query } from '../config/db.js';

export const auditService = {
  async log({ userId, action, module, entityId = null, description = '', ip = null, meta = null }) {
    try {
      await query(
        `INSERT INTO hrms_audit_logs (userId, action, module, entityId, description, ip, meta)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId ?? null, action, module, entityId ?? null, description, ip ?? null, meta ? JSON.stringify(meta) : null]
      );
    } catch (err) {
      console.error('[audit] failed to write log:', err.message);
    }
  },

  async list({ limit = 100, offset = 0, module = null, action = null, userId = null }) {
    const where = [];
    const params = [];
    if (module) { where.push('module = ?'); params.push(module); }
    if (action) { where.push('action = ?'); params.push(action); }
    if (userId) { where.push('userId = ?'); params.push(userId); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await query(
      `SELECT l.*, u.email AS userEmail, u.role AS userRole
       FROM hrms_audit_logs l
       LEFT JOIN hrcrm_users u ON u.id = l.userId
       ${whereSql}
       ORDER BY l.createdAt DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    const [{ total }] = await query(
      `SELECT COUNT(*) AS total FROM hrms_audit_logs l ${whereSql}`,
      params
    );
    return { rows, total };
  },
};