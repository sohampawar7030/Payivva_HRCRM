import { query, queryOne } from '../config/db.js';

export const settingsService = {
  async getAll() {
    const rows = await query('SELECT settingKey, settingValue FROM hrcrm_settings');
    const map = {};
    for (const r of rows) map[r.settingKey] = r.settingValue;
    return map;
  },

  async get(key, fallback = null) {
    const row = await queryOne('SELECT settingValue FROM hrcrm_settings WHERE settingKey = ?', [key]);
    return row ? row.settingValue : fallback;
  },

  async set(key, value) {
    await query(
      `INSERT INTO hrcrm_settings (settingKey, settingValue) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue)`,
      [key, value]
    );
  },

  async setMany(entries) {
    for (const [k, v] of Object.entries(entries)) {
      if (v !== undefined && v !== null) await this.set(k, String(v));
    }
  },

  async getCompany() {
    return (await queryOne('SELECT * FROM hrms_company_settings ORDER BY id LIMIT 1')) || null;
  },

  async updateCompany(data) {
    const existing = await this.getCompany();
    if (!existing) {
      await query(
        `INSERT INTO hrms_company_settings (companyName, logoPath, address, city, state, pincode, contactPhone, contactEmail, website, currency)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.companyName || 'Payivva Technologies', data.address || '', data.city || '', data.state || '', data.pincode || '', data.contactPhone || '', data.contactEmail || '', data.website || '', data.currency || '₹']
      );
      return this.getCompany();
    }
    await query(
      `UPDATE hrms_company_settings SET
        companyName = ?, address = ?, city = ?, state = ?, pincode = ?,
        contactPhone = ?, contactEmail = ?, website = ?, currency = ?
       WHERE id = ?`,
      [
        data.companyName ?? existing.companyName,
        data.address ?? existing.address,
        data.city ?? existing.city,
        data.state ?? existing.state,
        data.pincode ?? existing.pincode,
        data.contactPhone ?? existing.contactPhone,
        data.contactEmail ?? existing.contactEmail,
        data.website ?? existing.website,
        data.currency ?? existing.currency,
        existing.id,
      ]
    );
    return this.getCompany();
  },

  async getSmtp() {
    return (await queryOne('SELECT * FROM hrms_smtp_settings ORDER BY id LIMIT 1')) || null;
  },

  async updateSmtp(data) {
    const existing = await this.getSmtp();
    const secure = data.secure === true || data.secure === 1 || data.secure === '1';
    if (!existing) {
      await query(
        `INSERT INTO hrms_smtp_settings (host, port, username, password, secure, fromName, fromEmail, isActive)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [data.host, Number(data.port) || 465, data.username, data.password || '', secure, data.fromName || 'Payivva HRCRM', data.fromEmail || data.username]
      );
    } else {
      await query(
        `UPDATE hrms_smtp_settings SET host = ?, port = ?, username = ?, secure = ?, fromName = ?, fromEmail = ?, isActive = 1
         ${data.password ? ', password = ?' : ''}
         WHERE id = ?`,
        data.password
          ? [data.host ?? existing.host, Number(data.port) || existing.port, data.username ?? existing.username, secure, data.fromName ?? existing.fromName, data.fromEmail ?? existing.fromEmail, data.password, existing.id]
          : [data.host ?? existing.host, Number(data.port) || existing.port, data.username ?? existing.username, secure, data.fromName ?? existing.fromName, data.fromEmail ?? existing.fromEmail, existing.id]
      );
    }
    emailService._transporter = null;
    return this.getSmtp();
  },

  async getSalaryConfig() {
    const rows = await query('SELECT cfgKey, cfgValue FROM hrcrm_salary_config');
    const map = {};
    for (const r of rows) map[r.cfgKey] = r.cfgValue;
    return map;
  },

  async setSalaryConfig(entries, userId) {
    for (const [k, v] of Object.entries(entries)) {
      await query(
        `INSERT INTO hrcrm_salary_config (cfgKey, cfgValue, updatedBy) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE cfgValue = VALUES(cfgValue), updatedBy = VALUES(updatedBy)`,
        [k, String(v), userId]
      );
    }
    return this.getSalaryConfig();
  },
};

import { emailService } from './emailService.js';