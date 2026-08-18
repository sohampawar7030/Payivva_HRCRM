import { asyncHandler, ok } from '../utils/asyncHandler.js';
import { attendanceService } from '../services/attendanceService.js';
import { Errors } from '../utils/ApiError.js';

export const attendanceController = {
  mySummary: asyncHandler(async (req, res) => {
    if (!req.user.employeeId) throw Errors.badRequest('No employee linked', 'NO_EMPLOYEE');
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const summary = await attendanceService.getMonthlySummary(req.user.employeeId, year, month);
    ok(res, summary);
  }),

  employeeSummary: asyncHandler(async (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const summary = await attendanceService.getMonthlySummary(Number(req.params.employeeId), year, month);
    ok(res, summary);
  }),

  range: asyncHandler(async (req, res) => {
    const employeeId = Number(req.params.employeeId);
    if (req.user.role === 'worker' && employeeId !== req.user.employeeId) {
      throw Errors.forbidden('Access denied');
    }
    const from = req.query.from;
    const to = req.query.to;
    if (!from || !to) throw Errors.badRequest('from and to dates are required', 'INVALID_RANGE');
    const rows = await attendanceService.getRange(employeeId, from, to);
    ok(res, { rows });
  }),

  today: asyncHandler(async (req, res) => {
    const rows = await attendanceService.getTodaySummary();
    ok(res, { rows });
  }),
};