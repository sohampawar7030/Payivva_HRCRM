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

async function getOrGenerateUniqueEmployeeCode(emp, customCode) {
  if (customCode && String(customCode).trim()) return String(customCode).trim();
  if (emp && emp.employee_id && String(emp.employee_id).trim()) return String(emp.employee_id).trim();

  const name = (emp && emp.name) ? emp.name : 'Employee';
  const parts = String(name).trim().split(/\s+/);
  const firstChar = (parts[0] || 'E')[0].toUpperCase();
  const lastChar = (parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] || parts[0][0] || 'M')).toUpperCase();

  let attempts = 0;
  while (attempts < 100) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const code = `PAYIVVA_${firstChar}${lastChar}${randomDigits}`;
    const existing = await queryOne('SELECT id FROM employees WHERE employee_id = ?', [code]);
    if (!existing) {
      return code;
    }
    attempts++;
  }
  return `PAYIVVA_${firstChar}${lastChar}${Math.floor(1000 + Math.random() * 9000)}`;
}

function fillTemplate(template, e, company, extra = {}) {
  const vars = {
    employee_name: extra.employeeName || e.name || e.employeeName || '',
    employee_id: extra.employeeCode || e.employee_id || e.employeeCode || '',
    designation: extra.designation || e.designation || '',
    department: extra.department || e.department || '',
    work_location: extra.workLocation || 'Pune & PAN INDIA As per project requirement',
    joining_date: fmtDate(extra.joiningDate || e.joining_date),
    salary: extra.salary != null ? Number(extra.salary).toLocaleString('en-IN') : '27,000',
    effective_date: fmtDate(extra.effectiveDate) || fmtDate(new Date()),
    company_name: company.companyName || 'PAYIVVA TECHNOLOGIES (OPC) PRIVATE LIMITED',
    company_address: company.address || 'House No. 105, Green Park, Venkatesh Properties, Undri, Pune - 411060',
    company_city: [company.city, company.state].filter(Boolean).join(', '),
    company_pincode: company.pincode || '',
    company_phone: company.contactPhone || '+91 8380009994 / +91 8380009995',
    company_email: company.contactEmail || '',
    company_website: company.website || 'www.payivvatechnologies.in',
    signatory: 'Authorized Signatory',
    currency: extra.currency || 'Rs.',
    new_designation: extra.newDesignation || '',
    new_salary: extra.newSalary != null ? Number(extra.newSalary).toLocaleString('en-IN') : '',
    increment_amount: extra.incrementAmount != null ? Number(extra.incrementAmount).toLocaleString('en-IN') : '',
  };
  return template.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (m, key) => vars[key] ?? m);
}

const TEMPLATES = {
  offer: ({ e, company, extra }) => {
    const terms = Array.isArray(extra.termsOfEmployment) && extra.termsOfEmployment.length > 0
      ? extra.termsOfEmployment
      : [
          'Employment is full-time.',
          'You are expected to maintain confidentiality of all company and client information.',
          'You may be assigned to projects at different client locations as required.',
          'You must comply with all company policies and professional standards.',
          'This offer is subject to verification of the documents submitted.',
        ];
    const termsHtml = terms.map((t) => `<li>${t}</li>`).join('');

    const baseHtml = fillTemplate(
      `<div style="font-family: 'Times New Roman', Times, serif; color: #000; max-width: 800px; margin: 0 auto; line-height: 1.5;">
        <div style="text-align: center; margin-bottom: 15px;">
          <img src="/imp_doc/company_logo.png" alt="Company Logo" style="height: 70px; margin-bottom: 5px;" />
        </div>
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #b8860b; font-size: 20px; margin: 0 0 8px 0; font-family: 'Times New Roman', Times, serif;">OFFER OF APPOINTMENT</h2>
          <div style="font-weight: bold; font-size: 13px; font-family: 'Times New Roman', Times, serif;">PAYIVVA TECHNOLOGIES (OPC) PRIVATE LIMITED</div>
          <div style="font-size: 11px; color: #333; font-family: 'Times New Roman', Times, serif;">House No. 105, Green Park, Venkatesh Properties, Undri, Pune - 411060</div>
          <div style="font-size: 11px; color: #333; font-family: 'Times New Roman', Times, serif;">www.payivvatechnologies.in | +91 8380009994 / +91 8380009995</div>
        </div>

        <p style="margin-bottom: 12px;">Date: ${fmtDate(new Date())}</p>
        <p style="margin-bottom: 12px;">Dear Mr./Ms. {{employee_name}},</p>
        <p style="margin-bottom: 20px;">We are pleased to offer you the position of “<b>{{designation}}</b>” with PAYIVVA TECHNOLOGIES (OPC) PRIVATE LIMITED. We are confident that your skills and dedication will contribute to the continued success of our organization.</p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #000;" border="1" cellpadding="8">
          <tr><td style="width: 35%; font-weight: bold; border: 1px solid #000;">Employee ID</td><td style="font-weight: bold; border: 1px solid #000;">{{employee_id}}</td></tr>
          <tr><td style="font-weight: bold; border: 1px solid #000;">Employee Name</td><td style="font-weight: bold; border: 1px solid #000;">{{employee_name}}</td></tr>
          <tr><td style="font-weight: bold; border: 1px solid #000;">Designation</td><td style="font-weight: bold; border: 1px solid #000;">{{designation}}</td></tr>
          <tr><td style="font-weight: bold; border: 1px solid #000;">Work Location</td><td style="font-weight: bold; border: 1px solid #000;">{{work_location}}</td></tr>
          <tr><td style="font-weight: bold; border: 1px solid #000;">Department</td><td style="font-weight: bold; border: 1px solid #000;">{{department}}</td></tr>
          <tr><td style="font-weight: bold; border: 1px solid #000;">Joining Date</td><td style="font-weight: bold; border: 1px solid #000;">{{joining_date}}</td></tr>
          <tr><td style="font-weight: bold; border: 1px solid #000;">Monthly Salary</td><td style="font-weight: bold; border: 1px solid #000;">Rs. {{salary}}/-</td></tr>
        </table>

        <h4 style="color: #2b6cb0; margin-bottom: 10px; font-family: 'Times New Roman', Times, serif;">Terms of Employment</h4>
        <ul style="margin-top: 0; padding-left: 20px; margin-bottom: 20px;">
          ${termsHtml}
        </ul>

        <p style="margin-bottom: 20px;">Please sign below as your acceptance of this offer.</p>

        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000;" border="1" cellpadding="10">
          <tr>
            <td style="width: 50%; vertical-align: top; border: 1px solid #000;">
              <div style="font-weight: bold; margin-bottom: 15px;">For PAYIVVA TECHNOLOGIES</div>
              <img src="/imp_doc/digital_sign.png" alt="Digital Signature" style="height: 45px; display: block; margin-bottom: 5px;" />
              <div style="font-weight: bold; font-size: 12px;">Authorized Signatory</div>
            </td>
            <td style="width: 50%; vertical-align: top; border: 1px solid #000;">
              <div style="font-weight: bold; margin-bottom: 45px;">Accepted By</div>
              <div style="font-weight: bold; font-size: 13px;">{{employee_name}}</div>
            </td>
          </tr>
        </table>
      </div>`,
      e, company, extra
    );
    return baseHtml;
  },
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

    const empCode = await getOrGenerateUniqueEmployeeCode(employee, extra.employeeCode);
    const empName = extra.employeeName || employee.name || 'Candidate';
    const designation = extra.designation || employee.designation || 'Technician';
    const workLocation = extra.workLocation || 'Pune & PAN INDIA As per project requirement';
    const department = extra.department || employee.department || 'Operations';
    const joiningDate = extra.joiningDate || employee.joining_date;
    const salary = extra.salary != null ? extra.salary : (employee.salary || 27000);

    const effective = {
      ...extra,
      employeeName: empName,
      employeeCode: empCode,
      designation,
      workLocation,
      department,
      joiningDate,
      salary,
      joiningDateStr: fmtDate(joiningDate),
      effectiveDate: extra.effectiveDate || new Date().toISOString(),
      newDesignation: extra.newDesignation || designation,
      newSalary: extra.newSalary ?? salary,
      incrementAmount: extra.incrementAmount ?? (extra.newSalary && salary ? extra.newSalary - salary : 0),
      currency,
    };

    const build = TEMPLATES[letterType];
    if (!build) throw Errors.badRequest('Unknown letter type', 'INVALID_LETTER_TYPE');
    const bodyHtml = build({ e: employee, company, extra: effective });
    const titleFinal = title || LETTER_TYPE_LABELS[letterType];
    const pdfContent = await pdfService.generateLetter({ employee, letterType, title: titleFinal, bodyHtml, extra: effective });

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

    // Automatically send MNC-grade email with PDF attachment to employee
    try {
      if (employee.email) {
        emailService.sendLetterIssuedEmail(result, employee.email).catch((err) => {
          console.error('[letterService] Auto email send failed:', err.message);
        });
      }
    } catch (err) {
      console.error('[letterService] Auto email send error:', err.message);
    }

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

  async preview({ employeeId, letterType = 'offer', title = null, extra = {} }) {
    const employee = (employeeId ? await queryOne(`SELECT e.* FROM employees e WHERE e.id = ?`, [employeeId]) : null) || {
      id: employeeId || 0,
      name: extra.employeeName || 'Candidate',
      employee_id: extra.employeeCode || 'PAYIVVA_EMP',
      designation: extra.designation || 'Technician',
      department: extra.department || 'Operations',
      joining_date: extra.joiningDate || new Date().toISOString(),
      salary: extra.salary || 27000,
    };

    const company = (await queryOne('SELECT * FROM hrms_company_settings ORDER BY id LIMIT 1')) || {};
    const currency = company.currency || '₹';

    const empCode = extra.employeeCode || employee.employee_id || 'PAYIVVA_EMP';
    const empName = extra.employeeName || employee.name || 'Candidate';
    const designation = extra.designation || employee.designation || 'Technician';
    const workLocation = extra.workLocation || 'Pune & PAN INDIA As per project requirement';
    const department = extra.department || employee.department || 'Operations';
    const joiningDate = extra.joiningDate || employee.joining_date;
    const salary = extra.salary != null ? extra.salary : (employee.salary || 27000);

    const effective = {
      ...extra,
      employeeName: empName,
      employeeCode: empCode,
      designation,
      workLocation,
      department,
      joiningDate,
      salary,
      joiningDateStr: fmtDate(joiningDate),
      currency,
    };

    const titleFinal = title || LETTER_TYPE_LABELS[letterType] || 'OFFER OF APPOINTMENT';
    const pdfBase64 = await pdfService.generateLetter({ employee, letterType, title: titleFinal, bodyHtml: '', extra: effective });
    return { pdfBase64 };
  },

  async delete(letterId, { actor } = {}) {
    const letter = await this.get(letterId);
    if (!letter) throw Errors.notFound('Letter not found');
    await query('DELETE FROM hrcrm_letters WHERE id = ?', [letterId]);
    await auditService.log({
      userId: actor?.id,
      action: 'LETTER_DELETE',
      module: 'letter',
      entityId: letterId,
      description: `Permanently deleted letter #${letterId} (${letter.title})`,
      ip: actor?.ip,
    });
    return { deleted: true, id: letterId };
  },
};