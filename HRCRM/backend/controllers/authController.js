import { asyncHandler, ok } from '../utils/asyncHandler.js';
import { authService } from '../services/authService.js';
import { auditService } from '../services/auditService.js';

export const authController = {
  login: asyncHandler(async (req, res) => {
    const data = await authService.login(req.body, { ip: req.ip });
    ok(res, data, 'Login successful');
  }),

  logout: asyncHandler(async (req, res) => {
    await auditService.log({
      userId: req.user?.id,
      action: 'LOGOUT',
      module: 'auth',
      description: `${req.user?.email} logged out`,
      ip: req.ip,
    });
    ok(res, null, 'Logged out');
  }),

  me: asyncHandler(async (req, res) => {
    ok(res, req.user, 'Current user');
  }),

  onboardingInfo: asyncHandler(async (req, res) => {
    const data = await authService.onboarding(req.query.employee, req.query.token);
    ok(res, data, 'Onboarding link valid');
  }),

  completeOnboarding: asyncHandler(async (req, res) => {
    await authService.completeOnboarding(req.body);
    ok(res, null, 'Onboarding completed. You can now login.');
  }),

  forgotPassword: asyncHandler(async (req, res) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    const data = await authService.forgotPassword(req.body, { origin });
    ok(res, data, 'Request processed');
  }),

  resetPassword: asyncHandler(async (req, res) => {
    await authService.resetPassword(req.body);
    ok(res, null, 'Password reset successful. You can now login.');
  }),

  changePassword: asyncHandler(async (req, res) => {
    await authService.changePassword(req.user.id, req.body);
    ok(res, null, 'Password changed');
  }),
};