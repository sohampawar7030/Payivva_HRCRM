import { randomBytes, createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getPool, query, queryOne } from '../config/db.js';
import { env } from '../config/env.js';
import { statements } from './schema.js';

const DEFAULT_SETTINGS = {
  attendanceTimezone: '+05:30',
  monthlyWorkDays: '26',
  leaveCasualTotal: '12',
  leavePrivilegeTotal: '12',
  leaveHalfDayMax: '2',
  leaveWfhTotal: '4',
  maxDocumentSizeMb: '2',
  allowedDocumentTypes: 'pdf,jpg,jpeg,png',
};

const DEFAULT_SALARY_CONFIG = {
  monthlyWorkDays: '26',
  basicPercent: '50',
  hraPercent: '20',
  daPercent: '10',
  overtimeRatePerHour: '0',
  allowOvertime: 'false',
  absentDeductionPercent: '100',
  lateDeductionAmount: '0',
  allowLateDeduction: 'false',
  halfDayDeductionPercent: '50',
  includePf: 'false',
  pfPercent: '12',
  includeEsic: 'false',
  esicPercent: '0.75',
  professionalTaxAmount: '0',
  currency: '₹',
};

async function upsert(table, keyCol, keyVal, valueCol, value) {
  await query(
    `INSERT INTO ${table} (${keyCol}, ${valueCol}) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE ${valueCol} = VALUES(${valueCol})`,
    [keyVal, value]
  );
}

async function ensureAttendanceIndex(conn) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance'
       AND INDEX_NAME = 'idx_attendance_employee_time'`
  );
  if (!rows[0].cnt) {
    await conn.query('CREATE INDEX idx_attendance_employee_time ON attendance (employeeId, checkin_time)');
    console.log('  + created index attendance(employeeId, checkin_time)');
  } else {
    console.log('  = attendance index already present');
  }
}

async function seedDefaults(conn) {
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    await upsert('hrcrm_settings', 'settingKey', k, 'settingValue', v);
  }
  for (const [k, v] of Object.entries(DEFAULT_SALARY_CONFIG)) {
    await upsert('hrcrm_salary_config', 'cfgKey', k, 'cfgValue', v);
  }
  console.log('  = settings & salary config defaults ensured');
}

async function seedAdmin(conn) {
  const existing = await queryOne('SELECT id FROM hrcrm_users WHERE role = ? LIMIT 1', ['director']);
  if (existing) {
    console.log('  = director account already exists (id=' + existing.id + ')');
    return;
  }
  let password = env.adminBootstrap.password;
  let generated = false;
  if (!password) {
    password = randomBytes(6).toString('base64url');
    generated = true;
  }
  const hash = await bcrypt.hash(password, 10);
  await query(
    `INSERT INTO hrcrm_users (employeeId, email, password, role, status, name)
     VALUES (NULL, ?, ?, 'director', 'active', ?)`,
    [env.adminBootstrap.email, hash, env.adminBootstrap.name]
  );
  console.log(`  + created director account: ${env.adminBootstrap.email}`);
  console.log(`    password: ${password}  ${generated ? '(GENERATED - change it after first login!)' : ''}`);
  const credFile = 'docs/admin-credentials.txt';
  const fs = await import('node:fs');
  fs.writeFileSync(credFile, `Director login\nEmail: ${env.adminBootstrap.email}\nPassword: ${password}\n`);
  console.log(`    credentials saved to ${credFile} (gitignored)`);
}

async function seedLeaveBalances(conn) {
  const year = new Date().getFullYear();
  const [employees] = await conn.query('SELECT id FROM employees');
  for (const e of employees) {
    for (const type of ['casual', 'privilege', 'half_day', 'wfh']) {
      const total =
        type === 'casual'
          ? Number(DEFAULT_SETTINGS.leaveCasualTotal)
          : type === 'privilege'
            ? Number(DEFAULT_SETTINGS.leavePrivilegeTotal)
            : type === 'half_day'
              ? Number(DEFAULT_SETTINGS.leaveHalfDayMax)
              : Number(DEFAULT_SETTINGS.leaveWfhTotal);
      await conn.query(
        `INSERT INTO hrcrm_leave_balances (employeeId, leaveType, year, total, used)
         VALUES (?, ?, ?, ?, 0)
         ON DUPLICATE KEY UPDATE total = VALUES(total)`,
        [e.id, type, year, total]
      );
    }
  }
  console.log('  = leave balances ensured for ' + employees.length + ' employees');
}

async function linkExistingPasswords(conn) {
  const [legacy] = await conn.query(
    `SELECT u.email, u.password FROM users u WHERE u.email IN (SELECT email FROM employees)`
  );
  const byEmail = new Map(legacy.map((r) => [String(r.email).toLowerCase(), r.password]));
  const [employees] = await conn.query('SELECT id, email FROM employees');
  let linked = 0;
  for (const e of employees) {
    const hash = byEmail.get(String(e.email).toLowerCase());
    if (!hash) continue;
    const [existingUser] = await conn.query(
      'SELECT id FROM hrcrm_users WHERE employeeId = ?',
      [e.id]
    );
    if (!existingUser.length) {
      const uname = String(e.email).split('@')[0];
      await conn.query(
        `INSERT INTO hrcrm_users (employeeId, email, password, role, status, name, onboardingToken, onboardingTokenExpiresAt)
         VALUES (?, ?, ?, 'worker', 'pending_onboarding', ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
        [e.id, e.email, hash, uname, randomBytes(32).toString('hex')]
      );
      linked++;
    }
  }
  if (linked) console.log(`  + linked ${linked} existing employee passwords from legacy users table (bcrypt import)`);
}

async function main() {
  console.log('=== PAYIVVA HRCRM database setup ===');
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    console.log('Connected. Applying HRCRM-only schema (existing tables untouched)...');
    for (const sql of statements) {
      await conn.query(sql);
    }
    console.log('  ' + statements.length + ' HRCRM tables ensured (CREATE TABLE IF NOT EXISTS)');
    await ensureAttendanceIndex(conn);
    await seedDefaults(conn);
    await seedAdmin(conn);
    await seedLeaveBalances(conn);
    await linkExistingPasswords(conn);
    console.log('=== Setup complete ===');
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('Setup failed:', e.message);
  process.exit(1);
});