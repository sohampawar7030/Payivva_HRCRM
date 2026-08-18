import { query, queryOne, withTransaction } from '../config/db.js';
import { pdfService } from './pdfService.js';
import { emailService } from './emailService.js';
import { auditService } from './auditService.js';
import { notificationService } from './notificationService.js';
import { Errors } from '../utils/ApiError.js';
import { LETTER_TYPE_LABELS } from '../../shared/constants.js';

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fillTemplate(template, e, company, extra = {}) {
  const vars = {
    employee_name: e.name || e.employeeName || '',
    employee_id: e.employee_id || e.employeeCode || '',
    designation: e.designation || '',
    department: e.department || '',
    joining_date: fmtDate(e.joining_date) || extra.joiningDate || '',
    salary: extra.salary != null ? Number(extra.salary).toLocaleString('en-IN') : '',
    effective_date: fmtDate(extra.effectiveDate) || fmtDate(new Date()),
    company_name: company.companyName || 'Payivva Technologies',
    company_address: company.address || '',
    company_city: [company.city, company.state].filter(Boolean).join(', '),
    company_pincode: company.pincode || '',
    company_phone: company.contactPhone || '',
    company_email: company.contactEmail || '',
    company_website: company.website || '',
    signatory: company.signaturePath ? 'Authorized Signatory' : 'Authorized Signatory',
    currency: extra.currency || '₹',
    new_designation: extra.newDesignation || '',
    new_salary: extra.newSalary != null ? Number(extra.newSalary).toLocaleString('en-IN') : '',
    increment_amount: extra.incrementAmount != null ? Number(extra.incrementAmount).toLocaleString('en-IN') : '',
  };
  return template.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (m, key) => vars[key] ?? m);
}

const TEMPLATES = {
  offer: ({ e, company, extra }) => fillTemplate(
    `Dear {{employee_name}},
    <br/><br/>We are pleased to offer you the position of <b>{{designation}}</b> in the <b>{{department}}</b> department at <b>{{company_name}}</b>. We were impressed with your skills and experience, and we are confident that you will be a valuable addition to our team.
    <br/><br/>Your compensation package will be <b>{{currency}} {{salary}}</b> per month. Your date of joining will be <b>{{joining_date}}</b>.
    <br/><br/>Please find enclosed the terms and conditions of your employment. Kindly sign and return the offer letter along with the required documents before your joining date.
    <br/><br/>We look forward to welcoming you to the Payivva family.
    <br/><br/>Sincerely,`,
    e, company, extra),
  joining: ({ e, company, extra }) => fillTemplate(
    `Dear {{employee_name}},
    <br/><br/>Congratulations! We are pleased to confirm your joining at <b>{{company_name}}</b> as <b>{{designation}}</b> in the <b>{{department}}</b> department with effect from <b>{{effective_date}}</b>.
    <br/><br/>Your Employee ID is <b>{{employee_id}}</b>. Please report to the office on your joining date at the scheduled time and carry the required documents for verification.
    <br/><br/>We are excited to have you on board and look forward to a long and productive association.
    <br/><br/>Sincerely,`,
    e, company, extra),
  appointment: ({ e, company, extra }) => fillTemplate(
    `Dear {{employee_name}},
    <br/><br/>Further to your joining on <b>{{joining_date}}</b>, we are pleased to confirm your appointment at <b>{{company_name}}</b> as <b>{{designation}}</b> in the <b>{{department}}</b> department.
    <br/><br/>Your terms of employment, compensation and responsibilities are as discussed during onboarding. This appointment is subject to the policies of the company and satisfactory performance of your duties.
    <br/><br/>We are confident that your association with us will be mutually rewarding.
    <br/><br/>Sincerely,`,
    e, company, extra),
  increment: ({ e, company, extra }) => fillTemplate(
    `Dear {{employee_name}},
    <br/><br/>We are pleased to inform you that, based on your performance and contribution, your salary has been revised with effect from <b>{{effective_date}}</b>.
    <br/><br/>Your revised monthly salary will be <b>{{currency}} {{new_salary}}</b> as against your earlier salary of <b>{{currency}} {{salary}}</b>, an increment of <b>{{currency}} {{increment_amount}}</b> per month.
    <br/><br/>We appreciate your continued dedication and look forward to your sustained contribution to the growth of {{company_name}}.
    <br/><br/>Sincerely,`,
    e, company, extra),
  promotion: ({ e, company, extra }) => fillTemplate(
    `Dear {{employee_name}},
    <br/><br/>We are delighted to announce your promotion to the position of <b>{{new_designation}}</b> with effect from <b>{{effective_date}}</b>.
    <br/><br/>In recognition of your consistent performance and valuable contribution, you will now report under the {{department}} department. Your revised compensation will be <b>{{currency}} {{new_salary}}</b> per month.
    <br/><br/>We congratulate you on this achievement and wish you continued success with {{company_name}}.
    <br/><br/>Sincerely,`,
    e, company, extra),
};

export const letterService = {
  async generate({ employeeId, letterType, title = null, extra = {}, actor }) {
    const employee = await queryOne(
      `SELECT e.* FROM employees e WHERE e.id = ?`,
      [employeeId]
    );
    if (!employee) throw Errors.notFound('Employee not found');

    const company = (await queryOne('SELECT * FROM hrms_company_settings ORDER BY id LIMIT 1')) || {};
    const currency = company.currency || '₹';

    const effective = {
      joiningDate: extra.joiningDate || employee.joining_date,
      salary: extra.salary ?? employee.salary,
      effectiveDate: extra.effectiveDate || new Date().toISOString(),
      newDesignation: extra.newDesignation || employee.designation,
      newSalary: extra.newSalary ?? extra.salary ?? employee.salary,
      incrementAmount: extra.incrementAmount ?? (extra.newSalary && extra.salary ? extra.newSalary - extra.salary : 0),
      currency,
    };

    const build = TEMPLATES[letterType];
    if (!build) throw Errors.badRequest('Unknown letter type', 'INVALID_LETTER_TYPE');
    const bodyHtml = build({ e: employee, company, extra: effective });
    const titleFinal = title || LETTER_TYPE_LABELS[letterType];
    const pdfContent = await pdfService.generateLetter({ employee, letterType, title: titleFinal, bodyHtml });

    const result = await withTransaction(async (conn) => {
      const [ins] = await conn.query(
        `INSERT INTO hrcrm_letters (employeeId, letterType, title, content, pdfContent, version, status, generatedById)
         VALUES (?, ?, ?, ?, ?, 1, 'generated', ?)`,
        [employeeId, letterType, titleFinal, bodyHtml, pdfContent, actor?.id || null]
      );
      return ins.insertId;
    });

    await auditService.log({
      userId: actor?.id,
      action: 'GENERATE',
      module: 'letter',
      entityId: result,
      description: `${actor?.name || 'User'} generated ${titleFinal} for ${employee.name}`,
      ip: actor?.ip,
    });
    await notificationService.create({
      userId: actor?.id,
      title: 'Letter generated',
      message: `${titleFinal} generated for ${employee.name}`,
      type: 'letter',
      relatedEntity: 'letter',
      relatedId: result,
    });

    return this.get(result);
  },

  async get(id) {
    const row = await queryOne(
      `SELECT l.*, e.name AS employeeName, e.employee_id AS employeeCode
       FROM hrcrm_letters l LEFT JOIN employees e ON e.id = l.employeeId
       WHERE l.id = ?`,
      [id]
    );
    if (!row) throw Errors.notFound('Letter not found');
    return row;
  },

  async list({ employeeId = null, letterType = null, limit = 100, offset = 0 }) {
    const where = [];
    const params = [];
    if (employeeId) { where.push('l.employeeId = ?'); params.push(employeeId); }
    if (letterType) { where.push('l.letterType = ?'); params.push(letterType); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await query(
      `SELECT l.*, e.name AS employeeName, e.employee_id AS employeeCode
       FROM hrcrm_letters l LEFT JOIN employees e ON e.id = l.employeeId
       ${whereSql} ORDER BY l.createdAt DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM hrcrm_letters l ${whereSql}`, params);
    return { rows, total };
  },

  async sendEmail(letterId, { to, actor }) {
    const letter = await this.get(letterId);
    if (!letter) throw Errors.notFound('Letter not found');
    const result = await emailService.send({
      to: to || null,
      subject: letter.title,
      html: `<div style="font-family:Arial,sans-serif">${letter.content}</div>`,
      category: 'letter',
      attachments: [{ filename: `${letter.title.replace(/\s+/g, '_')}_v${letter.version}.pdf`, content: letter.pdfContent }],
      relatedEntity: 'letter',
      relatedId: letter.id,
    });
    if (result.sent) {
      await query('UPDATE hrcrm_letters SET status = ?, sentById = ?, sentAt = NOW() WHERE id = ?', ['sent', actor?.id || null, letterId]);
    }
    await auditService.log({
      userId: actor?.id,
      action: 'EMAIL_SEND',
      module: 'letter',
      entityId: letterId,
      description: `Emailed ${letter.title} to ${result.sent ? 'recipients' : 'failed'}`,
      ip: actor?.ip,
    });
    return result;
  },
};