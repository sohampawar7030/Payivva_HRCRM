import { query, queryOne, withTransaction } from '../config/db.js';
import { attendanceService } from './attendanceService.js';
import { settingsService } from './settingsService.js';
import { pdfService } from './pdfService.js';
import { emailService } from './emailService.js';
import { auditService } from './auditService.js';
import { notificationService } from './notificationService.js';
import { Errors } from '../utils/ApiError.js';

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * salaryService — configurable salary calculation.
 * Inputs: employee master (employees.salary / wage_per_hour) + attendanceService
 * (existing `attendance` table) + hrcrm_salary_config rules.
 * No formula is hard-coded; every rule is stored in hrcrm_salary_config and
 * editable by the Director.
 */
export const salaryService = {
  async getConfig() {
    return settingsService.getSalaryConfig();
  },

  async updateConfig(entries, userId) {
    return settingsService.setSalaryConfig(entries, userId);
  },

  async calculateForEmployee(employeeId, year, month, actor = null) {
    const employee = await queryOne(
      `SELECT e.*, c.companyName, c.currency
       FROM employees e
       LEFT JOIN hrms_company_settings c ON c.id = 1
       WHERE e.id = ?`,
      [employeeId]
    );
    if (!employee) throw Errors.notFound('Employee not found');

    const config = await this.getConfig();
    const summary = await attendanceService.getMonthlySummary(employeeId, year, month);

    const monthlySalary = num(employee.salary);
    const monthlyWorkDays = num(config.monthlyWorkDays, 26) || 26;
    const perDayRate = monthlySalary > 0 ? monthlySalary / monthlyWorkDays : 0;
    const perHourRate =
      num(employee.wage_per_hour) > 0
        ? num(employee.wage_per_hour)
        : monthlySalary > 0
          ? monthlySalary / (monthlyWorkDays * 8)
          : 0;

    const basicPercent = num(config.basicPercent, 50);
    const hraPercent = num(config.hraPercent, 20);
    const daPercent = num(config.daPercent, 10);

    const basicSalary = (monthlySalary * basicPercent) / 100;
    const hra = (monthlySalary * hraPercent) / 100;
    const da = (monthlySalary * daPercent) / 100;
    const allowances = Math.max(0, monthlySalary - basicSalary - hra - da);

    const overtimeAmount =
      config.allowOvertime === 'true'
        ? summary.overtimeMinutes * (num(config.overtimeRatePerHour) || perHourRate) * (1 / 60)
        : 0;

    const grossSalary = basicSalary + hra + da + allowances + overtimeAmount;

    const absentDeduction =
      (summary.absentDays * perDayRate * num(config.absentDeductionPercent, 100)) / 100 +
      (summary.halfDays * perDayRate * num(config.halfDayDeductionPercent, 50)) / 100;
    const lateDeduction =
      config.allowLateDeduction === 'true' ? summary.lateDays * num(config.lateDeductionAmount, 0) : 0;

    const pf = config.includePf === 'true' ? (grossSalary * num(config.pfPercent, 12)) / 100 : 0;
    const esic =
      config.includeEsic === 'true' && monthlySalary <= 21000
        ? (grossSalary * num(config.esicPercent, 0.75)) / 100
        : 0;
    const professionalTax = num(config.professionalTaxAmount, 0);

    const totalDeductions = absentDeduction + lateDeduction + pf + esic + professionalTax;
    const netSalary = Math.max(0, grossSalary - totalDeductions);

    return {
      employeeId,
      year,
      month,
      presentDays: summary.presentDays,
      absentDays: summary.absentDays,
      leaveDays: summary.leaveDays,
      halfDays: summary.halfDays,
      wfhDays: summary.wfhDays,
      holdDays: summary.holdDays || 0,
      lateDays: summary.lateDays,
      overtimeMinutes: summary.overtimeMinutes,
      totalHours: summary.totalHours,
      basicSalary: round2(basicSalary),
      hra: round2(hra),
      da: round2(da),
      allowances: round2(allowances),
      overtimeAmount: round2(overtimeAmount),
      grossSalary: round2(grossSalary),
      absentDeduction: round2(absentDeduction),
      lateDeduction: round2(lateDeduction),
      pf: round2(pf),
      esic: round2(esic),
      professionalTax: round2(professionalTax),
      otherDeductions: 0,
      totalDeductions: round2(totalDeductions),
      netSalary: round2(netSalary),
      perDayRate: round2(perDayRate),
      monthlyWorkDays,
      config,
      summary,
      employee: {
        id: employee.id,
        name: employee.name,
        employee_id: employee.employee_id,
        department: employee.department,
        designation: employee.designation,
        joining_date: employee.joining_date,
        salary: monthlySalary,
        wage_per_hour: num(employee.wage_per_hour),
        bankName: employee.bankName,
        accountNumber: employee.accountNumber,
        ifscCode: employee.ifscCode,
        branch: employee.branch,
      },
    };
  },

  async saveDraft(employeeId, year, month, actor) {
    const calc = await this.calculateForEmployee(employeeId, year, month, actor);
    await withTransaction(async (conn) => {
      const cols = [
        'employeeId', 'month', 'year', 'presentDays', 'absentDays', 'leaveDays', 'halfDays',
        'wfhDays', 'lateDays', 'overtimeMinutes', 'totalHours', 'basicSalary', 'hra', 'da',
        'allowances', 'overtimeAmount', 'grossSalary', 'absentDeduction', 'lateDeduction',
        'pf', 'esic', 'professionalTax', 'otherDeductions', 'totalDeductions', 'netSalary',
        'status', 'calculatedById', 'calculatedAt',
      ];
      const placeholders = cols.map(() => '?').join(', ');
      const values = [
        calc.employeeId, calc.month, calc.year, calc.presentDays, calc.absentDays,
        calc.leaveDays, calc.halfDays, calc.wfhDays, calc.lateDays, calc.overtimeMinutes,
        calc.totalHours, calc.basicSalary, calc.hra, calc.da, calc.allowances,
        calc.overtimeAmount, calc.grossSalary, calc.absentDeduction, calc.lateDeduction,
        calc.pf, calc.esic, calc.professionalTax, calc.otherDeductions,
        calc.totalDeductions, calc.netSalary, 'draft', actor?.id || null, new Date(),
      ];
      await conn.query(
        `INSERT INTO hrcrm_payrolls (${cols.join(', ')})
         VALUES (${placeholders})
         ON DUPLICATE KEY UPDATE
           presentDays = VALUES(presentDays), absentDays = VALUES(absentDays),
           leaveDays = VALUES(leaveDays), halfDays = VALUES(halfDays),
           wfhDays = VALUES(wfhDays), lateDays = VALUES(lateDays),
           overtimeMinutes = VALUES(overtimeMinutes), totalHours = VALUES(totalHours),
           basicSalary = VALUES(basicSalary), hra = VALUES(hra), da = VALUES(da),
           allowances = VALUES(allowances), overtimeAmount = VALUES(overtimeAmount),
           grossSalary = VALUES(grossSalary), absentDeduction = VALUES(absentDeduction),
           lateDeduction = VALUES(lateDeduction), pf = VALUES(pf), esic = VALUES(esic),
           professionalTax = VALUES(professionalTax), otherDeductions = VALUES(otherDeductions),
           totalDeductions = VALUES(totalDeductions), netSalary = VALUES(netSalary),
           status = 'draft', calculatedById = VALUES(calculatedById), calculatedAt = VALUES(calculatedAt)`,
        values
      );
    });
    return calc;
  },

  async getPayroll(employeeId, year, month) {
    return queryOne(
      `SELECT p.*, CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END AS slipGenerated
       FROM hrcrm_payrolls p
       LEFT JOIN hrcrm_salary_slips s ON s.payrollId = p.id
       WHERE p.employeeId = ? AND p.year = ? AND p.month = ?`,
      [employeeId, year, month]
    );
  },

  async listPayrolls({ year, month, status = null, employeeId = null, limit = 200, offset = 0 }) {
    const where = [];
    const params = [];
    if (year) { where.push('p.year = ?'); params.push(year); }
    if (month) { where.push('p.month = ?'); params.push(month); }
    if (status) { where.push('p.status = ?'); params.push(status); }
    if (employeeId) { where.push('p.employeeId = ?'); params.push(employeeId); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await query(
      `SELECT p.*, e.name AS employeeName, e.employee_id AS employeeCode, e.department, e.designation,
              CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END AS slipGenerated
       FROM hrcrm_payrolls p
       JOIN employees e ON e.id = p.employeeId
       LEFT JOIN hrcrm_salary_slips s ON s.payrollId = p.id
       ${whereSql}
       ORDER BY p.year DESC, p.month DESC, e.name ASC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM hrcrm_payrolls p ${whereSql}`, params);
    return { rows, total };
  },

  async finalize(payrollId, actor) {
    await withTransaction(async (conn) => {
      const [rows] = await conn.query('SELECT * FROM hrcrm_payrolls WHERE id = ?', [payrollId]);
      const p = rows[0];
      if (!p) throw Errors.notFound('Payroll not found');
      await conn.query(
        `UPDATE hrcrm_payrolls SET status = 'finalized', finalizedById = ?, finalizedAt = NOW() WHERE id = ?`,
        [actor?.id || null, payrollId]
      );
    });
    await auditService.log({
      userId: actor?.id,
      action: 'FINALIZE',
      module: 'payroll',
      entityId: payrollId,
      description: `Finalized payroll #${payrollId}`,
      ip: actor?.ip,
    });
    return this.getPayrollById(payrollId);
  },

  async updatePayroll(payrollId, values, actor) {
    const p = await this.getPayrollById(payrollId);
    if (!p) throw Errors.notFound('Payroll not found');
    if (p.status !== 'draft') throw Errors.badRequest('Only draft payrolls can be edited', 'NOT_DRAFT');

    const grossSalary = round2(
      Number(values.basicSalary) + Number(values.hra) + Number(values.da) + Number(values.allowances) + Number(values.overtimeAmount)
    );
    const totalDeductions = round2(
      Number(values.absentDeduction) + Number(values.lateDeduction) + Number(values.pf) +
      Number(values.esic) + Number(values.professionalTax) + Number(values.otherDeductions)
    );
    const netSalary = round2(Math.max(0, grossSalary - totalDeductions));

    await query(
      `UPDATE hrcrm_payrolls SET
         basicSalary = ?, hra = ?, da = ?, allowances = ?, overtimeAmount = ?,
         absentDeduction = ?, lateDeduction = ?, pf = ?, esic = ?, professionalTax = ?, otherDeductions = ?,
         grossSalary = ?, totalDeductions = ?, netSalary = ?,
         calculatedById = ?, calculatedAt = NOW()
       WHERE id = ?`,
      [
        values.basicSalary, values.hra, values.da, values.allowances, values.overtimeAmount,
        values.absentDeduction, values.lateDeduction, values.pf, values.esic, values.professionalTax, values.otherDeductions,
        grossSalary, totalDeductions, netSalary,
        actor?.id || null, payrollId,
      ]
    );

    await auditService.log({
      userId: actor?.id,
      action: 'UPDATE',
      module: 'payroll',
      entityId: payrollId,
      description: `Director manually edited payroll #${payrollId} for ${p.employeeName} (${p.month}/${p.year}) — net ₹${netSalary}`,
      ip: actor?.ip,
    });
    return this.getPayrollById(payrollId);
  },

  async getPayrollById(id) {
    return queryOne(
      `SELECT p.*, e.name AS employeeName, e.employee_id AS employeeCode, e.department, e.designation, e.email,
              CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END AS slipGenerated
       FROM hrcrm_payrolls p JOIN employees e ON e.id = p.employeeId
       LEFT JOIN hrcrm_salary_slips s ON s.payrollId = p.id
       WHERE p.id = ?`,
      [id]
    );
  },

  async generateSlip(payrollId, actor) {
    const p = await this.getPayrollById(payrollId);
    if (!p) throw Errors.notFound('Payroll not found');
    const company = (await settingsService.getCompany()) || {};
    const pdfContent = await pdfService.generateSalarySlip({
      employee: p,
      company,
      p,
      config: await this.getConfig(),
      currency: company.currency || '₹',
    });
    await withTransaction(async (conn) => {
      await conn.query(
        `INSERT INTO hrcrm_salary_slips (payrollId, employeeId, pdfContent, generatedAt)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE pdfContent = VALUES(pdfContent), generatedAt = VALUES(generatedAt)`,
        [payrollId, p.employeeId, pdfContent]
      );
    });
    await auditService.log({
      userId: actor?.id,
      action: 'GENERATE',
      module: 'salary_slip',
      entityId: payrollId,
      description: `Generated salary slip for ${p.employeeName} (${p.month}/${p.year})`,
      ip: actor?.ip,
    });
    await notificationService.create({
      userId: actor?.id,
      title: 'Salary slip generated',
      message: `Salary slip for ${p.employeeName} (${p.month}/${p.year}) generated`,
      type: 'payroll',
      relatedEntity: 'payroll',
      relatedId: payrollId,
    });
    return { payrollId, employeeId: p.employeeId, pdfContent };
  },

  async sendSlipEmail(payrollId, actor) {
    const p = await this.getPayrollById(payrollId);
    if (!p) throw Errors.notFound('Payroll not found');
    const slip = await queryOne('SELECT * FROM hrcrm_salary_slips WHERE payrollId = ?', [payrollId]);
    if (!slip) throw Errors.badRequest('Salary slip not generated yet', 'SLIP_NOT_GENERATED');
    const company = (await settingsService.getCompany()) || {};
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const result = await emailService.send({
      to: p.email,
      subject: `Salary Slip - ${monthNames[p.month - 1]} ${p.year}`,
      html: `<p>Dear ${p.employeeName},</p><p>Please find attached your salary slip for <b>${monthNames[p.month - 1]} ${p.year}</b>.</p><p>Regards,<br/>${company.companyName || 'Payivva HRCRM'}</p>`,
      category: 'salary_slip',
      attachments: [{ filename: `Salary_Slip_${p.employeeCode}_${p.month}_${p.year}.pdf`, content: slip.pdfContent }],
      relatedEntity: 'payroll',
      relatedId: payrollId,
    });
    if (result.sent) {
      await query('UPDATE hrcrm_salary_slips SET sentById = ?, sentAt = NOW() WHERE payrollId = ?', [actor?.id || null, payrollId]);
      await query("UPDATE hrcrm_payrolls SET status = 'paid' WHERE id = ?", [payrollId]);
    }
    await auditService.log({
      userId: actor?.id,
      action: 'EMAIL_SEND',
      module: 'salary_slip',
      entityId: payrollId,
      description: `Emailed salary slip to ${p.email} (${result.sent ? 'sent' : 'failed'})`,
      ip: actor?.ip,
    });
    return result;
  },

  async processingStatus(year, month) {
    const employees = await query('SELECT id FROM employees WHERE emp_status = ?', ['Active']);
    const total = employees.length;
    const payrolls = await query(
      'SELECT COUNT(*) AS cnt FROM hrcrm_payrolls WHERE year = ? AND month = ?',
      [year, month]
    );
    const drafts = await query(
      'SELECT COUNT(*) AS cnt FROM hrcrm_payrolls WHERE year = ? AND month = ? AND status = ?',
      [year, month, 'draft']
    );
    const finalized = await query(
      'SELECT COUNT(*) AS cnt FROM hrcrm_payrolls WHERE year = ? AND month = ? AND status = ?',
      [year, month, 'finalized']
    );
    const paid = await query(
      'SELECT COUNT(*) AS cnt FROM hrcrm_payrolls WHERE year = ? AND month = ? AND status = ?',
      [year, month, 'paid']
    );
    return {
      totalEmployees: total,
      processed: payrolls[0]?.cnt || 0,
      pending: Math.max(0, total - (payrolls[0]?.cnt || 0)),
      draft: drafts[0]?.cnt || 0,
      finalized: finalized[0]?.cnt || 0,
      paid: paid[0]?.cnt || 0,
    };
  },
};

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}