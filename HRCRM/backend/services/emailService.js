import nodemailer from 'nodemailer';
import { queryOne, query } from '../config/db.js';
import path from 'path';
import fs from 'fs';

export const emailService = {
  _transporter: null,
  _config: null,

  async getConfig() {
    try {
      const row = await queryOne(
        'SELECT * FROM hrms_smtp_settings WHERE isActive = 1 ORDER BY id LIMIT 1'
      );
      if (row && row.host && row.username !== 'yourdomain.com' && row.password !== 'YOUR_SMTP_PASSWORD') {
        return row;
      }
    } catch (err) {
      // fallback
    }

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      return {
        id: 999,
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true' ? 1 : 0,
        username: process.env.SMTP_USER,
        password: process.env.SMTP_PASS,
        fromEmail: process.env.SMTP_USER,
        fromName: 'PAYIVVA TECHNOLOGIES (OPC) PRIVATE LIMITED',
      };
    }

    return null;
  },

  async getTransporter(force = false) {
    const config = await this.getConfig();
    if (!config) return null;
    if (this._transporter && !force && this._config?.id === config.id) return this._transporter;
    this._config = config;
    this._transporter = nodemailer.createTransport({
      host: config.host,
      port: Number(config.port) || 587,
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
    const senderEmail = config?.fromEmail || 'sohamsp1030@gmail.com';
    const senderName = config?.fromName || 'PAYIVVA TECHNOLOGIES (OPC) PRIVATE LIMITED';

    const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
    const result = { sent: false, failed: false, error: null, messageIds: [] };

    if (!recipients.length) {
      result.error = 'No valid recipient email provided';
      return result;
    }

    for (const recipient of recipients) {
      try {
        const transporter = await this.getTransporter();
        if (!transporter) {
          throw new Error('SMTP not configured');
        }

        const mailOptions = {
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
        };

        const info = await transporter.sendMail(mailOptions);
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

  // ===== MNC-GRADE HTML EMAIL WRAPPER TEMPLATE =====
  _buildMncEmailWrapper({ title, recipientName, headerBadge, bodyHtml, actionButton = null }) {
    const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 0; color: #1e293b; }
    .container { max-width: 650px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
    .header { background: #0f172a; padding: 30px 40px; text-align: center; color: #ffffff; border-bottom: 4px solid #b8860b; }
    .company-title { font-size: 18px; font-weight: bold; letter-spacing: 1px; color: #f8fafc; margin-top: 10px; text-transform: uppercase; }
    .company-sub { font-size: 11px; color: #94a3b8; margin-top: 4px; }
    .badge { display: inline-block; background: #b8860b; color: #ffffff; font-size: 12px; font-weight: bold; padding: 6px 16px; border-radius: 20px; text-transform: uppercase; margin-top: 15px; letter-spacing: 0.5px; }
    .content { padding: 40px; line-height: 1.7; font-size: 15px; color: #334155; }
    .greeting { font-size: 18px; font-weight: bold; color: #0f172a; margin-bottom: 16px; }
    .highlight-box { background: #f8fafc; border-left: 4px solid #2563eb; padding: 18px 20px; border-radius: 6px; margin: 24px 0; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; font-weight: bold; text-decoration: none; padding: 14px 32px; border-radius: 6px; margin-top: 24px; text-align: center; font-size: 15px; }
    .footer { background: #f8fafc; padding: 24px 40px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .footer a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size: 24px; font-weight: bold; color: #e2e8f0;">PAYIVVA TECHNOLOGIES</div>
      <div class="company-title">PAYIVVA TECHNOLOGIES (OPC) PRIVATE LIMITED</div>
      <div class="company-sub">House No. 105, Green Park, Venkatesh Properties, Undri, Pune - 411060</div>
      ${headerBadge ? `<div class="badge">${headerBadge}</div>` : ''}
    </div>

    <div class="content">
      <div class="greeting">Dear ${recipientName || 'Valued Team Member'},</div>
      ${bodyHtml}
      ${actionButton ? `<div style="text-align: center;"><a href="${actionButton.url}" class="btn">${actionButton.text}</a></div>` : ''}
    </div>

    <div class="footer">
      <div><strong>PAYIVVA TECHNOLOGIES (OPC) PRIVATE LIMITED</strong></div>
      <div>Undri, Pune - 411060, Maharashtra, India</div>
      <div style="margin-top: 8px;">
        <a href="https://www.payivvatechnologies.in">www.payivvatechnologies.in</a> | Contact: +91 8380009994 / +91 8380009995
      </div>
      <div style="margin-top: 12px; color: #94a3b8; font-size: 11px;">
        Confidentiality Notice: This is an automated corporate notification from Payivva HRCRM.
      </div>
    </div>
  </div>
</body>
</html>
    `;
  },

  // ===== TRIGGER 1: WORKER ACCOUNT ONBOARDING EMAIL =====
  async sendWorkerOnboardingEmail({ workerName, workerCode, email, loginUrl }) {
    if (!email) return;
    const url = loginUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;

    const html = this._buildMncEmailWrapper({
      title: 'Welcome to PAYIVVA TECHNOLOGIES - Account Profile Setup',
      recipientName: workerName,
      headerBadge: 'ACTION REQUIRED: ONBOARDING & PROFILE SETUP',
      bodyHtml: `
        <p>Congratulations and welcome to <strong>PAYIVVA TECHNOLOGIES (OPC) PRIVATE LIMITED</strong>!</p>
        <p>Your official employee record has been initialized in our corporate HRCRM system with Employee ID: <strong>${workerCode}</strong>.</p>
        <div class="highlight-box">
          <div style="font-weight: bold; color: #1e40af; margin-bottom: 6px;">Next Onboarding Step:</div>
          <div>Your final account registration is pending. Please click the button below to set your account password, log in, and complete your profile verification details.</div>
        </div>
        <p>If you have any questions regarding your onboarding process, feel free to reach out to our IT Department or HR Team.</p>
      `,
      actionButton: {
        text: '🔑 Set Password & Complete Profile',
        url,
      },
    });

    return this.send({
      to: email,
      subject: `Welcome to PAYIVVA TECHNOLOGIES - Complete Your Account Profile (${workerCode})`,
      html,
      category: 'onboarding',
    });
  },

  // ===== TRIGGER 2: DOCUMENT VERIFICATION APPROVED EMAIL =====
  async sendVerificationApprovedEmail({ workerName, workerCode, email, level = 'it' }) {
    if (!email) return;
    const levelLabel = level === 'it' ? 'IT Department' : 'Director Office';

    const html = this._buildMncEmailWrapper({
      title: 'Document Verification Approved - PAYIVVA TECHNOLOGIES',
      recipientName: workerName,
      headerBadge: `VERIFICATION APPROVED BY ${levelLabel.toUpperCase()}`,
      bodyHtml: `
        <p>We are pleased to inform you that your profile verification and submitted official documents have been <strong>officially verified and APPROVED</strong> by the <strong>${levelLabel}</strong>.</p>
        <div class="highlight-box" style="border-left-color: #16a34a; background: #f0fdf4;">
          <div style="font-weight: bold; color: #15803d; margin-bottom: 6px;">Status Update:</div>
          <div>Employee ID: <strong>${workerCode}</strong> - Profile Verification Status: <strong>APPROVED (${levelLabel})</strong></div>
        </div>
        <p>You may log into your Payivva HRCRM portal at any time to review your profile, view assigned assets, and check corporate company letters.</p>
      `,
      actionButton: {
        text: '🌐 Log In to Worker Portal',
        url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`,
      },
    });

    return this.send({
      to: email,
      subject: `Document Verification Approved by ${levelLabel} - PAYIVVA TECHNOLOGIES (${workerCode})`,
      html,
      category: 'verification_approval',
    });
  },

  // ===== TRIGGER 3: LETTER ISSUED EMAIL WITH PDF ATTACHMENT =====
  async sendLetterIssuedEmail(letterId, recipientEmail = null) {
    const letter = await queryOne(
      `SELECT l.*, e.name AS employeeName, e.email AS employeeEmail, e.employee_id AS employeeCode
       FROM hrcrm_letters l LEFT JOIN employees e ON e.id = l.employeeId
       WHERE l.id = ?`,
      [letterId]
    );

    if (!letter) return { sent: false, error: 'Letter record not found' };

    const targetEmail = recipientEmail || letter.employeeEmail;
    if (!targetEmail) return { sent: false, error: 'No recipient email associated with this employee' };

    const extra = typeof letter.extra === 'string' ? JSON.parse(letter.extra) : (letter.extra || {});
    const empName = letter.employeeName || extra.employeeName || 'Team Member';
    const letterTitle = letter.title || 'Official Company Document';

    const html = this._buildMncEmailWrapper({
      title: `${letterTitle} - PAYIVVA TECHNOLOGIES`,
      recipientName: empName,
      headerBadge: 'OFFICIAL COMPANY DOCUMENT ISSUED',
      bodyHtml: `
        <p>Congratulations! <strong>PAYIVVA TECHNOLOGIES (OPC) PRIVATE LIMITED</strong> has officially issued your <strong>${letterTitle}</strong>.</p>
        <div class="highlight-box">
          <div style="font-weight: bold; color: #1e40af; margin-bottom: 8px;">Document Summary:</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr><td style="padding: 4px 0; color: #64748b;">Document Title:</td><td style="font-weight: bold;">${letterTitle}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Employee ID:</td><td style="font-weight: bold;">${letter.employeeCode || extra.employeeCode || '-'}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Designation:</td><td style="font-weight: bold;">${extra.designation || '-'}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Department:</td><td style="font-weight: bold;">${extra.department || '-'}</td></tr>
          </table>
        </div>
        <p>Your official signed document is attached to this email in PDF format. You can also view and download this document anytime by logging into your <strong>Payivva HRCRM Worker Portal</strong> under <em>Company Letters</em>.</p>
      `,
      actionButton: {
        text: '📂 View Letters in Worker Portal',
        url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`,
      },
    });

    const attachments = letter.pdfContent
      ? [{ filename: `${letterTitle.replace(/\s+/g, '_')}_v${letter.version}.pdf`, content: letter.pdfContent }]
      : [];

    const result = await this.send({
      to: targetEmail,
      subject: `Official Document Issued: ${letterTitle} - PAYIVVA TECHNOLOGIES`,
      html,
      category: 'official_letter',
      attachments,
      relatedEntity: 'letter',
      relatedId: letterId,
    });

    if (result.sent) {
      await query('UPDATE hrcrm_letters SET status = ?, sentTo = ?, sentAt = NOW() WHERE id = ?', ['sent', targetEmail, letterId]);
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