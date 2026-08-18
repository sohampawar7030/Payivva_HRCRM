import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';
import { query, queryOne, withTransaction } from '../config/db.js';
import { env } from '../config/env.js';
import { Errors } from '../utils/ApiError.js';
import { signAccessToken, signRefreshToken } from '../middleware/auth.js';
import { auditService } from './auditService.js';
import { emailService } from './emailService.js';
import { notificationService } from './notificationService.js';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const authService = {
  async login({ identifier, password, role }, ctx = {}) {
    const idLower = String(identifier || '').trim().toLowerCase();
    const user = await queryOne(
      `SELECT u.*, e.name AS employeeName, e.employee_id AS employeeCode, e.department, e.designation,
              e.email AS employeeEmail
       FROM hrcrm_users u
       LEFT JOIN employees e ON e.id = u.employeeId
       WHERE (LOWER(u.email) = ? OR e.employee_id = ?)
       LIMIT 1`,
      [idLower, String(identifier || '').trim()]
    );
    if (!user) throw Errors.unauthorized('Invalid credentials');

    if (user.role !== role) {
      throw Errors.unauthorized(`This account is not registered as ${role}`);
    }

    if (user.status === 'inactive') throw Errors.forbidden('Account is deactivated. Contact IT Department.');
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      throw Errors.unauthorized('Account temporarily locked due to failed attempts. Try again later.');
    }

    const valid = await bcrypt.compare(String(password || ''), user.password);
    if (!valid) {
      const failed = (user.failedLoginAttempts || 0) + 1;
      if (failed >= MAX_FAILED) {
        await query(
          'UPDATE hrcrm_users SET failedLoginAttempts = ?, lockedUntil = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?',
          [failed, LOCK_MINUTES, user.id]
        );
      } else {
        await query('UPDATE hrcrm_users SET failedLoginAttempts = ? WHERE id = ?', [failed, user.id]);
      }
      throw Errors.unauthorized('Invalid credentials');
    }

    await query(
      `UPDATE hrcrm_users SET failedLoginAttempts = 0, lockedUntil = NULL, lastLoginAt = NOW(), status = CASE WHEN status = 'pending_onboarding' THEN 'active' ELSE status END
       WHERE id = ?`,
      [user.id]
    );

    await auditService.log({
      userId: user.id,
      action: 'LOGIN',
      module: 'auth',
      entityId: user.employeeId,
      description: `${user.email} logged in (${user.role})`,
      ip: ctx.ip || null,
    });

    const payload = {
      id: user.id,
      role: user.role,
      employeeId: user.employeeId,
      employeeCode: user.employeeCode,
      name: user.employeeName || user.name,
      email: user.email,
      employeeEmail: user.employeeEmail,
      department: user.department,
      designation: user.designation,
      status: user.status,
      accessToken: signAccessToken(user),
      refreshToken: signRefreshToken(user),
    };
    return payload;
  },

  async onboarding(employeeCode, token) {
    const user = await queryOne(
      `SELECT u.*, e.name AS employeeName, e.employee_id AS employeeCode
       FROM hrcrm_users u
       JOIN employees e ON e.id = u.employeeId
       WHERE e.employee_id = ? AND u.onboardingToken = ?`,
      [employeeCode, token]
    );
    if (!user) throw Errors.badRequest('Invalid onboarding link', 'INVALID_ONBOARDING_LINK');
    if (user.onboardingTokenExpiresAt && new Date(user.onboardingTokenExpiresAt) < new Date()) {
      throw Errors.badRequest('Onboarding link has expired. Contact IT Department.', 'ONBOARDING_EXPIRED');
    }
    if (user.status === 'active' && user.password) {
      throw Errors.badRequest('Onboarding already completed. Please login.', 'ALREADY_ONBOARDED');
    }
    return {
      employeeCode: user.employeeCode,
      employeeName: user.employeeName || user.name,
      email: user.email,
    };
  },

  async completeOnboarding({ employeeCode, token, password }) {
    return withTransaction(async (conn) => {
      const [rows] = await conn.query(
        `SELECT u.* FROM hrcrm_users u
         JOIN employees e ON e.id = u.employeeId
         WHERE e.employee_id = ? AND u.onboardingToken = ?`,
        [employeeCode, token]
      );
      const user = rows[0];
      if (!user) throw Errors.badRequest('Invalid onboarding link', 'INVALID_ONBOARDING_LINK');
      if (user.onboardingTokenExpiresAt && new Date(user.onboardingTokenExpiresAt) < new Date()) {
        throw Errors.badRequest('Onboarding link has expired. Contact IT Department.', 'ONBOARDING_EXPIRED');
      }
      if (user.status === 'active') {
        throw Errors.badRequest('Onboarding already completed. Please login.', 'ALREADY_ONBOARDED');
      }
      const hash = await bcrypt.hash(password, 10);
      await conn.query(
        `UPDATE hrcrm_users SET password = ?, status = 'active', onboardingToken = NULL, onboardingTokenExpiresAt = NULL
         WHERE id = ?`,
        [hash, user.id]
      );
      await conn.query(
        `INSERT INTO hrcrm_verification (employeeId, profileStatus, itStatus, directorStatus)
         VALUES (?, 'not_started', 'pending', 'pending')
         ON DUPLICATE KEY UPDATE profileStatus = profileStatus`,
        [user.employeeId]
      );
      await conn.query(
        `INSERT INTO hrcrm_verification_history (employeeId, action, actorId, actorRole, remarks)
         VALUES (?, 'onboarding_completed', ?, 'worker', 'Worker completed onboarding')`,
        [user.employeeId, user.id]
      );
      return { success: true };
    });
  },

  async forgotPassword({ identifier }, ctx = {}) {
    const idLower = String(identifier || '').trim().toLowerCase();
    const user = await queryOne(
      `SELECT u.* FROM hrcrm_users u
       LEFT JOIN employees e ON e.id = u.employeeId
       WHERE LOWER(u.email) = ? OR e.employee_id = ? LIMIT 1`,
      [idLower, String(identifier || '').trim()]
    );
    if (!user) {
      return { sent: false, message: 'If an account exists, a reset link will be sent.' };
    }
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await query(
      `INSERT INTO hrcrm_password_reset_tokens (userId, tokenHash, expiresAt) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
      [user.id, tokenHash]
    );
    const base = env.apiBaseUrl || ctx.origin || 'http://localhost:5173';
    const link = `${base}/reset-password?token=${token}`;
    const sent = await emailService.send({
      to: user.email,
      subject: 'Reset your Payivva HRCRM password',
      html: `<p>Hello,</p><p>Click the link below to reset your Payivva HRCRM password. The link is valid for 1 hour.</p><p><a href="${link}">${link}</a></p><p>If you did not request this, you can ignore this email.</p>`,
      category: 'credentials',
    });
    return { sent: sent.sent, message: 'If an account exists, a reset link will be sent.' };
  },

  async resetPassword({ token, password }) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    return withTransaction(async (conn) => {
      const [rows] = await conn.query(
        `SELECT * FROM hrcrm_password_reset_tokens WHERE tokenHash = ? AND usedAt IS NULL AND expiresAt > NOW()`,
        [tokenHash]
      );
      const rec = rows[0];
      if (!rec) throw Errors.badRequest('Invalid or expired reset token', 'INVALID_RESET_TOKEN');
      const hash = await bcrypt.hash(password, 10);
      await conn.query('UPDATE hrcrm_users SET password = ? WHERE id = ?', [hash, rec.userId]);
      await conn.query('UPDATE hrcrm_password_reset_tokens SET usedAt = NOW() WHERE id = ?', [rec.id]);
      return { success: true };
    });
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await queryOne('SELECT * FROM hrcrm_users WHERE id = ?', [userId]);
    if (!user) throw Errors.notFound('User not found');
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw Errors.badRequest('Current password is incorrect', 'WRONG_PASSWORD');
    const hash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE hrcrm_users SET password = ? WHERE id = ?', [hash, userId]);
    await auditService.log({
      userId,
      action: 'CHANGE_PASSWORD',
      module: 'auth',
      description: 'Password changed',
    });
    return { success: true };
  },
};