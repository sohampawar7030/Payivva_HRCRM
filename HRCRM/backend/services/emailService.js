import nodemailer from 'nodemailer';
import { queryOne, query } from '../config/db.js';

export const emailService = {
  _transporter: null,
  _config: null,

  async getConfig() {
    const row = await queryOne(
      'SELECT * FROM hrms_smtp_settings WHERE isActive = 1 ORDER BY id LIMIT 1'
    );
    if (!row || !row.host || row.username === 'yourdomain.com' || row.password === 'YOUR_SMTP_PASSWORD') {
      return null;
    }
    return row;
  },

  async getTransporter(force = false) {
    const config = await this.getConfig();
    if (!config) return null;
    if (this._transporter && !force && this._config?.id === config.id) return this._transporter;
    this._config = config;
    this._transporter = nodemailer.createTransport({
      host: config.host,
      port: Number(config.port) || 465,
      secure: config.secure === 1 || config.secure === true,
      auth: {
        user: config.username,
        pass: config.password,
      },
    });
    return this._transporter;
  },

  async send({ to, subject, html = '', text = '', category = null, attachments = [], relatedEntity = null, relatedId = null }) {
    const config = await this.getConfig();
    const senderEmail = config?.fromEmail || 'no-reply@payivvatechnologies.in';
    const senderName = config?.fromName || 'Payivva HRCRM';

    const recipients = Array.isArray(to) ? to : [to];
    const result = { sent: false, failed: false, error: null, messageIds: [] };

    for (const recipient of recipients) {
      try {
        const transporter = await this.getTransporter();
        if (!transporter) {
          throw new Error('SMTP not configured (set real credentials in Email Settings)');
        }
        const info = await transporter.sendMail({
          from: `"${senderName}" <${senderEmail}>`,
          to: recipient,
          subject,
          html,
          text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
          attachments: attachments.map((a) => ({
            filename: a.filename,
            content: Buffer.from(a.content, 'base64'),
            contentType: a.contentType || 'application/pdf',
          })),
        });
        result.sent = true;
        result.messageIds.push(info.messageId);
        await this._log(recipient, senderEmail, senderName, subject, category, 'sent', null, relatedEntity, relatedId);
      } catch (err) {
        result.failed = true;
        result.error = err.message;
        await this._log(recipient, senderEmail, senderName, subject, category, 'failed', err.message, relatedEntity, relatedId);
      }
    }
    return result;
  },

  async _log(recipient, senderEmail, senderName, subject, category, status, error, relatedEntity, relatedId) {
    try {
      await query(
        `INSERT INTO hrcrm_email_logs (recipient, senderEmail, senderName, subject, category, status, error, relatedEntity, relatedId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [recipient, senderEmail, senderName, subject, category, status, error, relatedEntity, relatedId]
      );
    } catch (err) {
      console.error('[email] failed to log:', err.message);
    }
  },

  async logs({ limit = 100, offset = 0, category = null, status = null }) {
    const where = [];
    const params = [];
    if (category) { where.push('category = ?'); params.push(category); }
    if (status) { where.push('status = ?'); params.push(status); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await query(
      `SELECT * FROM hrcrm_email_logs ${whereSql} ORDER BY sentAt DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM hrcrm_email_logs ${whereSql}`, params);
    return { rows, total };
  },

  isConfigured() {
    return this.getConfig().then(Boolean);
  },
};