import { Router } from 'express';
import Joi from 'joi';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate, validators } from '../middleware/validate.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { authController } from '../controllers/authController.js';
import { workersController } from '../controllers/workersController.js';
import { documentsController } from '../controllers/documentsController.js';
import { leavesController } from '../controllers/leavesController.js';
import { attendanceController } from '../controllers/attendanceController.js';
import { salaryController } from '../controllers/salaryController.js';
import { lettersController } from '../controllers/lettersController.js';
import { emailsController } from '../controllers/emailsController.js';
import { notificationsController } from '../controllers/notificationsController.js';
import { auditController } from '../controllers/auditController.js';
import { settingsController } from '../controllers/settingsController.js';
import { dashboardController } from '../controllers/dashboardController.js';
import { siteController } from '../controllers/siteController.js';
import { ROLES } from '../../shared/constants.js';

const { WORKER, IT, DIRECTOR } = ROLES;
const STAFF = [IT, DIRECTOR];
const ALL = [WORKER, IT, DIRECTOR];

const router = Router();

const loginSchema = Joi.object({
  identifier: Joi.string().trim().required().messages({ 'any.required': 'Email / Employee ID is required' }),
  password: Joi.string().required().messages({ 'any.required': 'Password is required' }),
  role: Joi.string().valid(WORKER, IT, DIRECTOR).required().messages({ 'any.only': 'Please select a valid role' }),
});
const onboardingCompleteSchema = Joi.object({
  employeeCode: Joi.string().trim().required(),
  token: Joi.string().trim().required(),
  password: Joi.string().min(8).max(72).required(),
});
const resetSchema = Joi.object({
  token: Joi.string().trim().required(),
  password: Joi.string().min(8).max(72).required(),
});
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(72).required(),
});

const registrationSchema = Joi.object({
  employeeId: Joi.string().trim().min(2).max(50).required(),
  name: Joi.string().trim().min(2).max(255).required(),
  department: Joi.string().trim().max(255).allow('', null),
  designation: Joi.string().trim().max(255).allow('', null),
  joiningDate: Joi.date().allow(null),
  officialEmail: Joi.string().email().max(191).allow('', null).custom(validators.email),
  personalEmail: Joi.string().email().max(191).allow('', null).custom(validators.email),
  employmentType: Joi.string().max(50).allow('', null),
  reportingManager: Joi.string().max(255).allow('', null),
  salary: Joi.number().min(0).allow(null),
  wagePerHour: Joi.number().min(0).allow(null),
  sendCredentials: Joi.boolean().default(true),
});

const sectionSchema = Joi.object({
  section: Joi.string().valid('personal', 'contact', 'education', 'employment', 'skills').required(),
  data: Joi.object().pattern(Joi.string(), Joi.any()),
  education: Joi.array().items(Joi.object({
    qualification: Joi.string().allow('', null),
    institute: Joi.string().allow('', null),
    year: Joi.string().allow('', null),
    percentage: Joi.string().allow('', null),
  })).optional(),
});

const verifySchema = Joi.object({
  level: Joi.string().valid('it', 'director').required(),
  decision: Joi.string().valid('approved', 'rejected').required(),
  remarks: Joi.string().max(1000).allow('', null),
});

const docUploadSchema = Joi.object({
  employeeId: Joi.number().integer().optional(),
  docType: Joi.string().required(),
  originalName: Joi.string().trim().max(255).required(),
  mimeType: Joi.string().required(),
  size: Joi.number().min(0).required(),
  content: Joi.string().required(),
});

const docVerifySchema = Joi.object({
  decision: Joi.string().valid('approved', 'rejected').required(),
  remarks: Joi.string().max(1000).allow('', null),
});

const leaveCreateSchema = Joi.object({
  employeeId: Joi.number().integer().optional(),
  leaveType: Joi.string().valid('casual', 'privilege', 'half_day', 'wfh').required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  halfDay: Joi.string().valid('none', 'first_half', 'second_half').default('none'),
  reason: Joi.string().max(2000).allow('', null),
  comments: Joi.string().max(2000).allow('', null),
  supportingDocName: Joi.string().max(255).allow('', null),
  supportingDocContent: Joi.string().allow('', null),
});

const leaveReviewSchema = Joi.object({
  level: Joi.string().valid('it', 'director').required(),
  decision: Joi.string().valid('approved', 'rejected').required(),
  remarks: Joi.string().max(1000).allow('', null),
});

const leaveDatesSchema = Joi.object({
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
});

const salaryCalcSchema = Joi.object({
  employeeId: Joi.number().integer().required(),
  year: Joi.number().integer().min(2020).max(2100).required(),
  month: Joi.number().integer().min(1).max(12).required(),
});

const payrollEditSchema = Joi.object({
  basicSalary: Joi.number().min(0).empty('').allow(null).default(0),
  hra: Joi.number().min(0).empty('').allow(null).default(0),
  da: Joi.number().min(0).empty('').allow(null).default(0),
  allowances: Joi.number().min(0).empty('').allow(null).default(0),
  overtimeAmount: Joi.number().min(0).empty('').allow(null).default(0),
  absentDeduction: Joi.number().min(0).empty('').allow(null).default(0),
  lateDeduction: Joi.number().min(0).empty('').allow(null).default(0),
  pf: Joi.number().min(0).empty('').allow(null).default(0),
  esic: Joi.number().min(0).empty('').allow(null).default(0),
  professionalTax: Joi.number().min(0).empty('').allow(null).default(0),
  otherDeductions: Joi.number().min(0).empty('').allow(null).default(0),
});

const letterSchema = Joi.object({
  employeeId: Joi.number().integer().required(),
  letterType: Joi.string().valid('offer', 'joining', 'appointment', 'increment', 'promotion').required(),
  title: Joi.string().max(255).allow('', null),
  extra: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
});

const siteStatusSchema = Joi.object({
  status: Joi.string().valid('running', 'stopped', 'on_hold').required().messages({ 'any.only': 'Status must be running, stopped or on_hold' }),
  notes: Joi.string().max(1000).allow('', null),
});

// ===== Auth (public) =====
router.post('/auth/login', authRateLimiter, validate(loginSchema), authController.login);
router.get('/auth/onboarding', authController.onboardingInfo);
router.post('/auth/onboarding/complete', validate(onboardingCompleteSchema), authController.completeOnboarding);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', validate(resetSchema), authController.resetPassword);
router.post('/auth/logout', authenticate, authController.logout);
router.get('/auth/me', authenticate, authController.me);
router.post('/auth/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);

// ===== Dashboards =====
router.get('/dashboard/worker', authenticate, requireRole(WORKER), dashboardController.worker);
router.get('/dashboard/it', authenticate, requireRole(IT), dashboardController.it);
router.get('/dashboard/admin', authenticate, requireRole(DIRECTOR), dashboardController.admin);

// ===== Workers / profiles =====
router.get('/workers', authenticate, requireRole(...STAFF), workersController.list);
router.get('/workers/:id', authenticate, requireRole(...STAFF), workersController.get);
router.post('/workers', authenticate, requireRole(IT, DIRECTOR), validate(registrationSchema), workersController.create);
router.get('/workers/:id/verification-history', authenticate, requireRole(...STAFF), workersController.verificationHistory);
router.post('/workers/:id/verify', authenticate, requireRole(...STAFF), validate(verifySchema), workersController.verify);
router.post('/workers/:id/reopen', authenticate, requireRole(...STAFF), workersController.reopen);

router.get('/me/profile', authenticate, requireRole(...ALL), workersController.myProfile);
router.put('/me/profile/:section', authenticate, requireRole(...ALL), validate(sectionSchema), workersController.updateSection);
router.post('/me/profile/submit', authenticate, requireRole(...ALL), workersController.submitProfile);
  router.post('/me/profile/assets', authenticate, requireRole(...ALL), workersController.updateAssets);
  router.put('/profile/:id/section', authenticate, requireRole(...STAFF), validate(sectionSchema), workersController.updateSection);
  router.post('/profile/:id/submit', authenticate, requireRole(...STAFF), workersController.submitProfile);
  router.post('/profile/:id/assets', authenticate, requireRole(...STAFF), workersController.updateAssets);

// ===== Documents =====
router.get('/documents', authenticate, requireRole(...STAFF), documentsController.listAll);
router.get('/documents/employee/:employeeId', authenticate, requireRole(...ALL), documentsController.listForEmployee);
router.post('/documents/upload', authenticate, requireRole(...ALL), validate(docUploadSchema), documentsController.upload);
router.put('/documents/:id/verify', authenticate, requireRole(...STAFF), validate(docVerifySchema), documentsController.verify);
router.get('/documents/:id/download', authenticate, requireRole(...ALL), documentsController.download);

// ===== Leaves =====
router.get('/leaves', authenticate, requireRole(...STAFF), leavesController.list);
router.get('/leaves/active', authenticate, requireRole(...STAFF), leavesController.activeOnLeave);
router.get('/leaves/mine', authenticate, requireRole(WORKER), leavesController.my);
router.get('/leaves/balances/:employeeId?', authenticate, requireRole(...ALL), leavesController.balances);
router.get('/leaves/:id', authenticate, requireRole(...ALL), leavesController.get);
router.post('/leaves', authenticate, requireRole(...ALL), validate(leaveCreateSchema), leavesController.create);
router.put('/leaves/:id/review', authenticate, requireRole(...STAFF), validate(leaveReviewSchema), leavesController.review);
router.put('/leaves/:id/dates', authenticate, requireRole(...STAFF), validate(leaveDatesSchema), leavesController.adjustDates);
router.post('/leaves/:employeeId/unblock', authenticate, requireRole(IT, DIRECTOR), leavesController.unblock);
router.delete('/leaves/:employeeId/unblock', authenticate, requireRole(IT, DIRECTOR), leavesController.cancelUnblock);
router.post('/leaves/:id/cancel', authenticate, requireRole(...ALL), leavesController.cancel);

// ===== Attendance =====
router.get('/attendance/today', authenticate, requireRole(...STAFF), attendanceController.today);
router.get('/attendance/mine', authenticate, requireRole(WORKER), attendanceController.mySummary);
router.get('/attendance/employee/:employeeId', authenticate, requireRole(...STAFF), attendanceController.employeeSummary);
router.get('/attendance/range/:employeeId', authenticate, requireRole(...ALL), attendanceController.range);

// ===== Salary =====
router.get('/salary/config', authenticate, requireRole(...STAFF), salaryController.config);
router.put('/salary/config', authenticate, requireRole(DIRECTOR), salaryController.updateConfig);
router.post('/salary/calculate', authenticate, requireRole(DIRECTOR), validate(salaryCalcSchema), salaryController.calculate);
router.post('/salary/calculate-all', authenticate, requireRole(DIRECTOR), salaryController.calculateAll);
router.get('/salary/payrolls', authenticate, requireRole(...STAFF), salaryController.list);
router.put('/salary/payrolls/:id', authenticate, requireRole(DIRECTOR), validate(payrollEditSchema), salaryController.updatePayroll);
router.get('/salary/mine', authenticate, requireRole(WORKER), salaryController.my);
  router.get('/salary/status', authenticate, requireRole(...STAFF), salaryController.status);
  router.get('/salary/site-analysis', authenticate, requireRole(DIRECTOR), salaryController.siteAnalysis);
router.post('/salary/:id/finalize', authenticate, requireRole(DIRECTOR), salaryController.finalize);
router.post('/salary/:id/generate-slip', authenticate, requireRole(...STAFF), salaryController.generateSlip);
router.get('/salary/:id/slip', authenticate, requireRole(...ALL), salaryController.downloadSlip);
router.post('/salary/:id/send-slip', authenticate, requireRole(...STAFF), salaryController.sendSlipEmail);

// ===== Letters =====
router.get('/letters', authenticate, requireRole(...STAFF), lettersController.list);
router.get('/letters/mine', authenticate, requireRole(WORKER), lettersController.my);
router.post('/letters/preview', authenticate, requireRole(...STAFF), lettersController.previewPdf);
router.get('/letters/:id', authenticate, requireRole(...ALL), lettersController.get);
router.get('/letters/:id/pdf', authenticate, requireRole(...ALL), lettersController.downloadPdf);
router.post('/letters', authenticate, requireRole(...STAFF), validate(letterSchema), lettersController.generate);
router.post('/letters/:id/send', authenticate, requireRole(...STAFF), lettersController.sendEmail);
router.delete('/letters/:id', authenticate, requireRole(...STAFF), lettersController.delete);

// ===== Emails =====
router.get('/emails/logs', authenticate, requireRole(...STAFF), emailsController.logs);
router.post('/emails/send', authenticate, requireRole(...STAFF), emailsController.send);
router.post('/emails/salary-delay', authenticate, requireRole(IT, DIRECTOR), emailsController.delayNotification);
router.post('/emails/meeting', authenticate, requireRole(...STAFF), emailsController.meeting);
router.post('/emails/test', authenticate, requireRole(...STAFF), emailsController.test);

// ===== Notifications =====
router.get('/notifications', authenticate, requireRole(...ALL), notificationsController.list);
router.get('/notifications/unread-count', authenticate, requireRole(...ALL), notificationsController.unreadCount);
router.put('/notifications/:id/read', authenticate, requireRole(...ALL), notificationsController.markRead);
router.put('/notifications/read-all', authenticate, requireRole(...ALL), notificationsController.markAllRead);

// ===== Audit logs =====
router.get('/audit-logs', authenticate, requireRole(DIRECTOR), auditController.list);

// ===== Sites (attendance hold control) =====
router.get('/sites', authenticate, requireRole(...STAFF), siteController.list);
router.put('/sites/:id/status', authenticate, requireRole(DIRECTOR), validate(siteStatusSchema), siteController.setStatus);

// ===== Settings =====
router.get('/settings', authenticate, requireRole(...ALL), settingsController.getAll);
router.put('/settings', authenticate, requireRole(DIRECTOR), settingsController.update);
router.put('/settings/company', authenticate, requireRole(DIRECTOR), settingsController.updateCompany);
router.put('/settings/smtp', authenticate, requireRole(DIRECTOR), settingsController.updateSmtp);
router.put('/settings/salary-config', authenticate, requireRole(DIRECTOR), settingsController.updateSalaryConfig);
router.get('/settings/departments', authenticate, requireRole(...ALL), settingsController.departments);
router.get('/settings/designations', authenticate, requireRole(...ALL), settingsController.designations);
router.get('/settings/shifts', authenticate, requireRole(...ALL), settingsController.shifts);
router.get('/settings/reference', authenticate, requireRole(...ALL), settingsController.reference);
router.get('/settings/user-access', authenticate, requireRole(DIRECTOR), settingsController.userAccess);
router.put('/settings/user-access', authenticate, requireRole(DIRECTOR), settingsController.updateUserAccess);

export default router;