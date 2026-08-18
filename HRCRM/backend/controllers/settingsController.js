import { asyncHandler, ok } from '../utils/asyncHandler.js';
import { settingsService } from '../services/settingsService.js';
import { auditService } from '../services/auditService.js';
import { query } from '../config/db.js';
import { Errors } from '../utils/ApiError.js';

export const settingsController = {
  getAll: asyncHandler(async (req, res) => {
    const settings = await settingsService.getAll();
    const company = await settingsService.getCompany();
    const smtp = await settingsService.getSmtp();
    const salaryConfig = await settingsService.getSalaryConfig();
    ok(res, { settings, company, smtp: smtp ? { ...smtp, password: smtp.password ? '••••••••' : '' } : null, salaryConfig });
  }),

  update: asyncHandler(async (req, res) => {
    await settingsService.setMany(req.body);
    await auditService.log({
      userId: req.user?.id,
      action: 'UPDATE',
      module: 'settings',
      description: `${req.user?.email} updated system settings`,
      ip: req.ip,
    });
    ok(res, null, 'Settings updated');
  }),

  updateCompany: asyncHandler(async (req, res) => {
    const company = await settingsService.updateCompany(req.body);
    await auditService.log({
      userId: req.user?.id,
      action: 'UPDATE',
      module: 'company_settings',
      description: `${req.user?.email} updated company information`,
      ip: req.ip,
    });
    ok(res, { company }, 'Company information updated');
  }),

  updateSmtp: asyncHandler(async (req, res) => {
    const smtp = await settingsService.updateSmtp(req.body);
    await auditService.log({
      userId: req.user?.id,
      action: 'UPDATE',
      module: 'smtp_settings',
      description: `${req.user?.email} updated SMTP configuration`,
      ip: req.ip,
    });
    ok(res, { smtp: { ...smtp, password: '••••••••' } }, 'SMTP settings updated');
  }),

  updateSalaryConfig: asyncHandler(async (req, res) => {
    const config = await settingsService.setSalaryConfig(req.body, req.user?.id);
    await auditService.log({
      userId: req.user?.id,
      action: 'UPDATE',
      module: 'salary_config',
      description: `${req.user?.email} updated salary calculation configuration`,
      ip: req.ip,
    });
    ok(res, { config }, 'Salary configuration updated');
  }),

  departments: asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT d.*, e.name AS headName FROM hrms_departments d LEFT JOIN employees e ON e.id = d.headEmployeeId ORDER BY d.name`
    );
    ok(res, { rows });
  }),

  designations: asyncHandler(async (req, res) => {
    const rows = await query('SELECT * FROM hrms_designations ORDER BY name');
    ok(res, { rows });
  }),

  shifts: asyncHandler(async (req, res) => {
    const rows = await query('SELECT * FROM hrms_shifts ORDER BY isDefault DESC, name');
    ok(res, { rows });
  }),

  userAccess: asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT u.id, u.email, u.role, u.status, u.name, u.lastLoginAt,
              e.employee_id AS employeeCode, e.name AS employeeName
       FROM hrcrm_users u
       LEFT JOIN employees e ON e.id = u.employeeId
       ORDER BY u.createdAt DESC`
    );
    ok(res, { rows });
  }),

  updateUserAccess: asyncHandler(async (req, res) => {
    const { userId, status, role } = req.body;
    if (!userId) throw Errors.badRequest('userId required');
    await query('UPDATE hrcrm_users SET status = COALESCE(?, status), role = COALESCE(?, role) WHERE id = ?', [status || null, role || null, userId]);
    await auditService.log({
      userId: req.user?.id,
      action: 'UPDATE',
      module: 'user_access',
      entityId: userId,
      description: `${req.user?.email} updated access of user #${userId} (status=${status || '-'}, role=${role || '-'})`,
      ip: req.ip,
    });
    ok(res, null, 'User access updated');
  }),

  reference: asyncHandler(async (req, res) => {
    const [departments, designations, shifts, assets] = await Promise.all([
      query('SELECT * FROM hrms_departments ORDER BY name'),
      query('SELECT * FROM hrms_designations ORDER BY name'),
      query('SELECT * FROM hrms_shifts ORDER BY isDefault DESC, name'),
      query('SELECT DISTINCT component FROM employee_inventory ORDER BY component'),
    ]);
    ok(res, { departments, designations, shifts, assetHistory: assets });
  }),
};