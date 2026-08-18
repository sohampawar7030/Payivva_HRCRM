import { asyncHandler, ok } from '../utils/asyncHandler.js';
import { emailService } from '../services/emailService.js';
import { auditService } from '../services/auditService.js';
import { notificationService } from '../services/notificationService.js';
import { query } from '../config/db.js';
import { Errors } from '../utils/ApiError.js';
import { EMAIL_CATEGORIES } from '../../shared/constants.js';

export const emailsController = {
  send: asyncHandler(async (req, res) => {
    const { to, subject, message, category, employeeId } = req.body;
    if (!to || !subject) throw Errors.badRequest('recipient and subject required', 'MISSING_FIELDS');
    const result = await emailService.send({
      to,
      subject,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6">${message || ''}</div>`,
      text: message,
      category: category || 'other',
      relatedEntity: employeeId ? 'employee' : null,
      relatedId: employeeId ? Number(employeeId) : null,
    });
    await auditService.log({
      userId: req.user?.id,
      action: 'EMAIL_SEND',
      module: 'email',
      description: `Sent email "${subject}" to ${to} (${result.sent ? 'sent' : 'failed'})`,
      ip: req.ip,
      meta: { category },
    });
    ok(res, result, result.sent ? 'Email sent' : 'Email send attempted (check SMTP configuration)');
  }),

  delayNotification: asyncHandler(async (req, res) => {
    const { employeeIds, salaryMonth, salaryYear, delayReason, customMessage } = req.body;
    if (!employeeIds?.length || !salaryMonth) throw Errors.badRequest('Select employees and salary month', 'MISSING_FIELDS');
    const placeholders = employeeIds.map(() => '?').join(',');
    const employees = await query(
      `SELECT id, name, email FROM employees WHERE id IN (${placeholders})`,
      employeeIds
    );
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthLabel = `${monthNames[Number(salaryMonth) - 1]} ${salaryYear || new Date().getFullYear()}`;
    const results = [];
    for (const emp of employees) {
      const result = await emailService.send({
        to: emp.email,
        subject: `Salary Delay Notification - ${monthLabel}`,
        html: `<p>Dear ${emp.name},</p><p>We regret to inform you that the salary for the month of <b>${monthLabel}</b> will be delayed.</p><p>Reason: ${delayReason || 'Not specified'}</p>${customMessage ? `<p>${customMessage}</p>` : ''}<p>We apologize for the inconvenience. Regards,<br/>Payivva IT Department</p>`,
        category: 'salary_delay',
        relatedEntity: 'employee',
        relatedId: emp.id,
      });
      results.push({ employeeId: emp.id, name: emp.name, email: emp.email, sent: result.sent });
    }
    await auditService.log({
      userId: req.user?.id,
      action: 'EMAIL_SEND',
      module: 'salary_delay',
      description: `Sent salary delay notification for ${monthLabel} to ${results.length} employees`,
      ip: req.ip,
    });
    ok(res, { results }, `Processed ${results.length} salary delay emails`);
  }),

  meeting: asyncHandler(async (req, res) => {
    const { to, subject, message, meetingDate, meetingTime, location } = req.body;
    if (!to || !subject || !meetingDate) throw Errors.badRequest('recipient, subject and meeting date required', 'MISSING_FIELDS');
    const result = await emailService.send({
      to,
      subject: `Meeting Invitation: ${subject}`,
      html: `<div><p><b>Meeting</b></p><p><b>Date:</b> ${meetingDate}${meetingTime ? ` at ${meetingTime}` : ''}</p><p><b>Location:</b> ${location || 'To be announced'}</p>${message ? `<p>${message}</p>` : ''}</div>`,
      category: 'meeting',
    });
    await auditService.log({
      userId: req.user?.id,
      action: 'EMAIL_SEND',
      module: 'meeting',
      description: `Sent meeting invitation "${subject}" to ${to}`,
      ip: req.ip,
    });
    ok(res, result, result.sent ? 'Meeting invitation sent' : 'Email send attempted (check SMTP configuration)');
  }),

  logs: asyncHandler(async (req, res) => {
    const data = await emailService.logs({
      limit: req.query.limit,
      offset: req.query.offset,
      category: req.query.category || null,
      status: req.query.status || null,
    });
    ok(res, data);
  }),

  test: asyncHandler(async (req, res) => {
    const result = await emailService.send({
      to: req.user.email,
      subject: 'Payivva HRCRM - Test email',
      html: '<p>If you are reading this, SMTP configuration is working correctly.</p>',
      category: 'other',
    });
    if (!result.sent) throw Errors.badRequest(`SMTP test failed: ${result.error}`, 'SMTP_TEST_FAILED');
    ok(res, result, 'Test email sent successfully');
  }),
};