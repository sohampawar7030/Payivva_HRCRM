import { asyncHandler, ok } from '../utils/asyncHandler.js';
import { employeeService } from '../services/employeeService.js';
import { Errors } from '../utils/ApiError.js';

export const workersController = {
  list: asyncHandler(async (req, res) => {
    const data = await employeeService.listWorkers({
      search: req.query.search,
      status: req.query.status,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    ok(res, data);
  }),

  get: asyncHandler(async (req, res) => {
    const data = await employeeService.getWorker(Number(req.params.id), {
      sensitive: ['it', 'director'].includes(req.user.role),
    });
    ok(res, data);
  }),

  create: asyncHandler(async (req, res) => {
    const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
    const data = await employeeService.createRegistration(
      { ...req.body, sendCredentials: req.body.sendCredentials !== false, frontendUrl: origin },
      { ...req.user, ip: req.ip }
    );
    ok(res, data, 'Worker registration created', 201);
  }),

  myProfile: asyncHandler(async (req, res) => {
    if (!req.user.employeeId) throw Errors.badRequest('No employee linked to this account', 'NO_EMPLOYEE');
    const data = await employeeService.getFullProfile(req.user.employeeId, { sensitive: true });
    data.canEdit = await employeeService.canEditProfile(req.user.employeeId, req.user.role);
    ok(res, data);
  }),

  updateSection: asyncHandler(async (req, res) => {
    const employeeId = Number(req.params.id || req.user.employeeId);
    if (!['it', 'director'].includes(req.user.role) && req.user.employeeId !== employeeId) {
      throw Errors.forbidden('You can only update your own profile');
    }
    const canEdit = await employeeService.canEditProfile(employeeId, req.user.role);
    if (!canEdit && req.body.section !== 'skills') {
      throw Errors.badRequest(
        'Profile is under verification. An admin must reopen it before editing.',
        'PROFILE_LOCKED'
      );
    }
    await employeeService.updateProfile(employeeId, req.body, { ...req.user, ip: req.ip });
    ok(res, null, 'Profile section saved');
  }),

  submitProfile: asyncHandler(async (req, res) => {
    const employeeId = Number(req.params.id || req.user.employeeId);
    if (!['it', 'director'].includes(req.user.role) && req.user.employeeId !== employeeId) {
      throw Errors.forbidden('You can only submit your own profile');
    }
    await employeeService.submitProfile(employeeId, { ...req.user, ip: req.ip });
    ok(res, null, 'Profile submitted for verification');
  }),

  verify: asyncHandler(async (req, res) => {
    const { level, decision } = req.body;
    const data = await employeeService.verifyEmployee(
      Number(req.params.id),
      { level, decision, remarks: req.body.remarks },
      { ...req.user, ip: req.ip }
    );
    ok(res, data, `Profile ${decision} at ${level} level`);
  }),

  reopen: asyncHandler(async (req, res) => {
    await employeeService.reopenProfile(Number(req.params.id), { ...req.user, ip: req.ip });
    ok(res, null, 'Profile reopened for editing');
  }),

  verificationHistory: asyncHandler(async (req, res) => {
    const { query } = await import('../config/db.js');
    const rows = await query(
      `SELECT h.*, u.name AS actorName, u.role AS actorRoleLabel
       FROM hrcrm_verification_history h
       LEFT JOIN hrcrm_users u ON u.id = h.actorId
       WHERE h.employeeId = ?
       ORDER BY h.createdAt DESC`,
      [Number(req.params.id)]
    );
    ok(res, { rows });
  }),

  updateAssets: asyncHandler(async (req, res) => {
    const employeeId = Number(req.params.id || req.user.employeeId);
    if (!['it', 'director'].includes(req.user.role) && req.user.employeeId !== employeeId) {
      throw Errors.forbidden('You can only update your own assets');
    }
    const canEdit = await employeeService.canEditProfile(employeeId, req.user.role);
    if (!canEdit) {
      throw Errors.badRequest('Profile is under verification. An admin must reopen it before editing.', 'PROFILE_LOCKED');
    }
    const result = await employeeService.updateAssets(employeeId, req.body, { ...req.user, ip: req.ip });
    ok(res, result, 'Assets saved');
  }),
};