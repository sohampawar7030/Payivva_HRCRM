import { asyncHandler, ok } from '../utils/asyncHandler.js';
import { leaveService } from '../services/leaveService.js';
import { Errors } from '../utils/ApiError.js';

export const leavesController = {
  create: asyncHandler(async (req, res) => {
    const employeeId = Number(req.body.employeeId || req.user.employeeId);
    if (!['it', 'director'].includes(req.user.role) && req.user.employeeId !== employeeId) {
      throw Errors.forbidden('You can only create leave for yourself');
    }
    const leave = await leaveService.create({
      ...req.body,
      employeeId,
      actor: { ...req.user, ip: req.ip },
    });
    ok(res, leave, 'Leave request submitted', 201);
  }),

  list: asyncHandler(async (req, res) => {
    const data = await leaveService.list({
      employeeId: req.query.employeeId || null,
      status: req.query.status || null,
      leaveType: req.query.leaveType || null,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    ok(res, data);
  }),

  my: asyncHandler(async (req, res) => {
    if (!req.user.employeeId) throw Errors.badRequest('No employee linked', 'NO_EMPLOYEE');
    const data = await leaveService.list({ employeeId: req.user.employeeId });
    ok(res, data);
  }),

  get: asyncHandler(async (req, res) => {
    const leave = await leaveService.get(Number(req.params.id));
    if (req.user.role === 'worker' && leave.employeeId !== req.user.employeeId) {
      throw Errors.forbidden('Access denied');
    }
    ok(res, leave);
  }),

  balances: asyncHandler(async (req, res) => {
    const employeeId = Number(req.params.employeeId || req.user.employeeId);
    if (req.user.role === 'worker' && employeeId !== req.user.employeeId) {
      throw Errors.forbidden('Access denied');
    }
    const rows = await leaveService.getBalances(employeeId, Number(req.query.year) || new Date().getFullYear());
    ok(res, { rows });
  }),

  review: asyncHandler(async (req, res) => {
    const leave = await leaveService.review(Number(req.params.id), {
      level: req.body.level,
      decision: req.body.decision,
      remarks: req.body.remarks,
      actor: { ...req.user, ip: req.ip },
    });
    ok(res, leave, `Leave ${req.body.decision} at ${req.body.level} level`);
  }),

  cancel: asyncHandler(async (req, res) => {
    const leave = await leaveService.get(Number(req.params.id));
    if (req.user.role === 'worker' && leave.employeeId !== req.user.employeeId) {
      throw Errors.forbidden('Access denied');
    }
    await leaveService.cancel(Number(req.params.id), { ...req.user, ip: req.ip });
    ok(res, null, 'Leave request cancelled');
  }),

  activeOnLeave: asyncHandler(async (req, res) => {
    const rows = await leaveService.listActiveOnLeave();
    ok(res, { rows });
  }),

  adjustDates: asyncHandler(async (req, res) => {
    const leave = await leaveService.adjustDates(Number(req.params.id), req.body, { ...req.user, ip: req.ip });
    ok(res, leave, 'Leave dates updated');
  }),

  unblock: asyncHandler(async (req, res) => {
    const data = await leaveService.unblock(Number(req.params.employeeId), { ...req.user, ip: req.ip });
    ok(res, data, 'Worker login unblocked (both apps)');
  }),

  cancelUnblock: asyncHandler(async (req, res) => {
    const data = await leaveService.cancelUnblock(Number(req.params.employeeId), { ...req.user, ip: req.ip });
    ok(res, data, 'Worker login blocked again');
  }),
};