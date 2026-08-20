import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Errors } from '../utils/ApiError.js';
import { getPool } from '../config/db.js';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, employeeId: user.employeeId || null },
    env.jwt.secret,
    { expiresIn: env.jwt.accessExpires }
  );
}

export function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, type: 'refresh' },
    env.jwt.secret,
    { expiresIn: env.jwt.refreshExpires }
  );
}

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw Errors.unauthorized('Authentication required');

    let payload;
    try {
      payload = jwt.verify(token, env.jwt.secret);
    } catch {
      throw Errors.unauthorized('Invalid or expired token');
    }

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT u.id, u.employeeId, u.email, u.role, u.status, u.name,
              e.name AS employeeName, e.employee_id AS employeeCode, e.department, e.designation
       FROM hrcrm_users u
       LEFT JOIN employees e ON e.id = u.employeeId
       WHERE u.id = ?`,
      [payload.sub]
    );
    const user = rows[0];
    if (!user) throw Errors.unauthorized('Account no longer exists');
    if (user.status === 'inactive') throw Errors.forbidden('Account is deactivated');

    // Worker on approved leave → session blocked for the leave duration
    // (auto-unblocks when the leave ends).
    if (user.role === 'worker' && user.employeeId) {
      const [lv] = await pool.query(
        `SELECT 1 FROM hrcrm_leaves
         WHERE employeeId = ? AND status = 'director_approved'
           AND startDate <= CURDATE() AND endDate >= CURDATE()
           AND NOT EXISTS (
             SELECT 1 FROM employees WHERE id = ? AND emergency_unblock_until >= CURDATE()
           )
         LIMIT 1`,
        [user.employeeId, user.employeeId]
      );
      if (lv && lv.length > 0) {
        throw Errors.forbidden(
          'Your account is temporarily blocked while you are on approved leave. According to company policy you cannot log in during your leave. Enjoy your holidays! If you face any problem, contact IT Department: Mr. Soham Pawar (+91 7030806080, sohampawar1030@gmail.com)'
        );
      }
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(Errors.forbidden('You do not have permission to perform this action'));
  }
  next();
};

export const requireAnyRole = (...roles) => requireRole(...roles);

export function isSelfOrRole(req, employeeId, ...roles) {
  if (roles.includes(req.user.role)) return true;
  return req.user.role === 'worker' && req.user.employeeId === Number(employeeId);
}