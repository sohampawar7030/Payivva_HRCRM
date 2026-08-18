import { query, queryOne } from '../config/db.js';

export const notificationService = {
  async create({ userId, title, message, type = 'info', relatedEntity = null, relatedId = null }) {
    if (!userId) return null;
    const result = await query(
      `INSERT INTO hrcrm_notifications (userId, title, message, type, relatedEntity, relatedId)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, title, message, type, relatedEntity, relatedId]
    );
    return result.insertId;
  },

  async createForRole({ role, title, message, type = 'info', relatedEntity = null, relatedId = null }) {
    const users = await query('SELECT id FROM hrcrm_users WHERE role = ? AND status = ?', [role, 'active']);
    for (const u of users) {
      await this.create({ userId: u.id, title, message, type, relatedEntity, relatedId });
    }
  },

  async listForUser(userId, { limit = 50, unreadOnly = false } = {}) {
    const where = 'userId = ?' + (unreadOnly ? ' AND isRead = 0' : '');
    return query(
      `SELECT * FROM hrcrm_notifications WHERE ${where} ORDER BY createdAt DESC LIMIT ?`,
      [userId, Number(limit)]
    );
  },

  async markRead(userId, notificationId) {
    await query(
      'UPDATE hrcrm_notifications SET isRead = 1 WHERE id = ? AND userId = ?',
      [notificationId, userId]
    );
  },

  async markAllRead(userId) {
    await query('UPDATE hrcrm_notifications SET isRead = 1 WHERE userId = ?', [userId]);
  },

  async unreadCount(userId) {
    const row = await queryOne(
      'SELECT COUNT(*) AS cnt FROM hrcrm_notifications WHERE userId = ? AND isRead = 0',
      [userId]
    );
    return row?.cnt || 0;
  },
};