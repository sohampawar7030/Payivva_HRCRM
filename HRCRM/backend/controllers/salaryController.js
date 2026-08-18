import { asyncHandler, ok } from '../utils/asyncHandler.js';
import { salaryService } from '../services/salaryService.js';
import { Errors } from '../utils/ApiError.js';

export const salaryController = {
  config: asyncHandler(async (req, res) => {
    const config = await salaryService.getConfig();
    ok(res, { config });
  }),

  updateConfig: asyncHandler(async (req, res) => {
    const config = await salaryService.updateConfig(req.body, req.user.id);
    ok(res, { config }, 'Salary configuration updated');
  }),

  calculate: asyncHandler(async (req, res) => {
    const { employeeId, year, month } = req.body;
    if (!employeeId || !year || !month) throw Errors.badRequest('employeeId, year and month required', 'MISSING_PARAMS');
    const calc = await salaryService.saveDraft(Number(employeeId), Number(year), Number(month), { ...req.user, ip: req.ip });
    ok(res, calc, 'Payroll calculated (draft)');
  }),

  calculateAll: asyncHandler(async (req, res) => {
    const { year, month } = req.body;
    if (!year || !month) throw Errors.badRequest('year and month required', 'MISSING_PARAMS');
    const { query } = await import('../config/db.js');
    const employees = await query('SELECT id FROM employees WHERE emp_status = ?', ['Active']);
    const results = [];
    for (const e of employees) {
      const calc = await salaryService.saveDraft(e.id, Number(year), Number(month), { ...req.user, ip: req.ip });
      results.push({ employeeId: e.id, netSalary: calc.netSalary, grossSalary: calc.grossSalary });
    }
    ok(res, { processed: results.length, results }, `Calculated payroll for ${results.length} employees`);
  }),

  list: asyncHandler(async (req, res) => {
    const data = await salaryService.listPayrolls({
      year: req.query.year || null,
      month: req.query.month || null,
      status: req.query.status || null,
      employeeId: req.query.employeeId || null,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    ok(res, data);
  }),

  updatePayroll: asyncHandler(async (req, res) => {
    const payroll = await salaryService.updatePayroll(Number(req.params.id), req.body, { ...req.user, ip: req.ip });
    ok(res, payroll, 'Payroll amounts updated');
  }),

  my: asyncHandler(async (req, res) => {
    if (!req.user.employeeId) throw Errors.badRequest('No employee linked', 'NO_EMPLOYEE');
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const payroll = await salaryService.getPayroll(req.user.employeeId, year, month);
    ok(res, payroll);
  }),

  finalize: asyncHandler(async (req, res) => {
    const payroll = await salaryService.finalize(Number(req.params.id), { ...req.user, ip: req.ip });
    ok(res, payroll, 'Payroll finalized');
  }),

  generateSlip: asyncHandler(async (req, res) => {
    const slip = await salaryService.generateSlip(Number(req.params.id), { ...req.user, ip: req.ip });
    ok(res, { payrollId: slip.payrollId }, 'Salary slip generated');
  }),

  downloadSlip: asyncHandler(async (req, res) => {
    const payroll = await salaryService.getPayrollById(Number(req.params.id));
    if (!payroll) throw Errors.notFound('Payroll not found');
    if (req.user.role === 'worker' && payroll.employeeId !== req.user.employeeId) {
      throw Errors.forbidden('Access denied');
    }
    const { queryOne } = await import('../config/db.js');
    const slip = await queryOne('SELECT pdfContent FROM hrcrm_salary_slips WHERE payrollId = ?', [payroll.id]);
    if (!slip) throw Errors.badRequest('Salary slip not generated yet', 'SLIP_NOT_GENERATED');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Salary_Slip_${payroll.employeeCode}_${payroll.month}_${payroll.year}.pdf"`);
    res.send(Buffer.from(slip.pdfContent || '', 'base64'));
  }),

  sendSlipEmail: asyncHandler(async (req, res) => {
    const result = await salaryService.sendSlipEmail(Number(req.params.id), { ...req.user, ip: req.ip });
    ok(res, result, result.sent ? 'Salary slip emailed' : 'Email send attempted (check SMTP configuration)');
  }),

  status: asyncHandler(async (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const data = await salaryService.processingStatus(year, month);
    ok(res, data);
  }),
};