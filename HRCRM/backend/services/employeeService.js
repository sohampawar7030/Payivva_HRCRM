import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { query, queryOne, withTransaction } from '../config/db.js';
import { Errors } from '../utils/ApiError.js';
import { auditService } from './auditService.js';
import { notificationService } from './notificationService.js';
import { emailService } from './emailService.js';

const SENSITIVE = Symbol('sensitive');

function maskFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const masked = { ...obj };
  for (const k of ['aadhaarNumber', 'panNumber', 'accountNumber', 'ifscCode', 'upiId', 'aadhaar', 'pan', 'bankName', 'content']) {
    if (masked[k]) masked[k] = masked[k].toString().replace(/.(?=.{4})/g, '*');
  }
  return masked;
}

const SECTION_TABLES = {
  personal: {
    table: 'hrcrm_profile_details',
    fields: ['fatherName', 'motherName', 'dateOfBirth', 'gender', 'bloodGroup', 'maritalStatus', 'nationality', 'aadhaarNumber', 'panNumber', 'passportNumber', 'drivingLicence', 'uanNumber', 'esicNumber'],
    sync: (v) => ({
      dob: v.dateOfBirth,
      gender: v.gender,
      blood_group: v.bloodGroup,
      aadhaar: v.aadhaarNumber,
      pan_number: v.panNumber,
      father_name: v.fatherName,
    }),
  },
  contact: {
    table: 'hrcrm_contact_details',
    fields: ['mobileNumber', 'alternateMobile', 'personalEmail', 'officialEmail', 'currentAddress', 'permanentAddress', 'emergencyContactName', 'emergencyRelation', 'emergencyContactNumber', 'emergencyAddress'],
    sync: (v) => ({
      mobile: v.mobileNumber,
      email: v.officialEmail || undefined,
      current_address: v.currentAddress,
      permanent_address: v.permanentAddress,
      emergency_contact_name: v.emergencyContactName,
      emergency_relation: v.emergencyRelation,
      emergency_mobile: v.emergencyContactNumber,
    }),
  },
  employment: {
    table: 'hrcrm_employment_details',
    fields: ['previousCompany', 'previousDesignation', 'experienceYears', 'reasonForLeaving', 'lastSalary', 'bankName', 'branch', 'accountNumber', 'ifscCode', 'upiId'],
    sync: (v) => ({}),
  },
};

async function generateUniqueEmployeeCode(name) {
  const parts = String(name || 'Employee').trim().split(/\s+/);
  const firstChar = (parts[0] || 'E')[0].toUpperCase();
  const lastChar = (parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] || parts[0][0] || 'M')).toUpperCase();
  let attempts = 0;
  while (attempts < 100) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const code = `PAYIVVA_${firstChar}${lastChar}${randomDigits}`;
    const existing = await queryOne('SELECT id FROM employees WHERE employee_id = ?', [code]);
    if (!existing) return code;
    attempts++;
  }
  return `PAYIVVA_${firstChar}${lastChar}${Math.floor(1000 + Math.random() * 9000)}`;
}

export const employeeService = {
  async getEmployeeForUser(userId) {
    const user = await queryOne('SELECT * FROM hrcrm_users WHERE id = ?', [userId]);
    if (!user) throw Errors.notFound('User not found');
    if (!user.employeeId) return { user, employee: null };
    return { user, employee: await this.getFullProfile(user.employeeId) };
  },

  async getFullProfile(employeeId, opts = {}) {
    const employee = await queryOne('SELECT * FROM employees WHERE id = ?', [employeeId]);
    if (!employee) throw Errors.notFound('Employee not found');

    const [personal, contact, education, employment, skills, verification, documents, assets, user] =
      await Promise.all([
        queryOne('SELECT * FROM hrcrm_profile_details WHERE employeeId = ?', [employeeId]),
        queryOne('SELECT * FROM hrcrm_contact_details WHERE employeeId = ?', [employeeId]),
        query('SELECT * FROM hrcrm_education WHERE employeeId = ? ORDER BY id ASC', [employeeId]),
        queryOne('SELECT * FROM hrcrm_employment_details WHERE employeeId = ?', [employeeId]),
        query('SELECT id, category, skill FROM hrcrm_skills WHERE employeeId = ? ORDER BY id ASC', [employeeId]),
        queryOne('SELECT * FROM hrcrm_verification WHERE employeeId = ?', [employeeId]),
        query(
          `SELECT id, docType, category, originalName, fileName, mimeType, size, verificationStatus, verifiedAt, rejectionReason, remarks, version, uploadedAt
           FROM hrcrm_documents WHERE employeeId = ? ORDER BY uploadedAt DESC`,
          [employeeId]
        ),
        query(
          `SELECT id, component, quantity, issued_date, notes, createdAt
           FROM employee_inventory WHERE employeeId = ? ORDER BY issued_date DESC`,
          [employeeId]
        ),
        queryOne('SELECT id, email, role, status FROM hrcrm_users WHERE employeeId = ?', [employeeId]),
      ]);

    const profileCompletion = this.computeProfileCompletion({
      personal, contact, education, employment, skills, documents,
    });

    const result = {
      employee,
      personal: opts.sensitive ? personal : maskFields(personal),
      contact: opts.sensitive ? contact : maskFields(contact),
      education,
      employment: opts.sensitive ? employment : maskFields(employment),
      skills,
      verification,
      documents,
      assets,
      user,
      profileCompletion,
    };
    return result;
  },

  computeProfileCompletion({ personal, contact, education, employment, skills, documents }) {
    const sections = [
      { key: 'personal', done: Boolean(personal) },
      { key: 'contact', done: Boolean(contact) },
      { key: 'education', done: Boolean(education?.length) },
      { key: 'employment', done: Boolean(employment) },
      { key: 'skills', done: Boolean(skills?.length) },
      { key: 'documents', done: Boolean(documents?.length) },
    ];
    const done = sections.filter((s) => s.done).length;
    return { percent: Math.round((done / sections.length) * 100), sections };
  },

  async listWorkers({ search = '', status = null, limit = 100, offset = 0 }) {
    const where = [];
    const params = [];
    if (search) {
      where.push('(e.name LIKE ? OR e.employee_id LIKE ? OR e.email LIKE ? OR e.mobile LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (status) {
      where.push('v.profileStatus = ?');
      params.push(status);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await query(
      `SELECT e.id, e.employee_id, e.name, e.email, e.mobile, e.department, e.designation,
              e.joining_date, e.emp_status, e.profile_completed, e.company, e.salary,
              v.profileStatus, v.itStatus, v.directorStatus, v.submittedAt,
              (SELECT COUNT(*) FROM hrcrm_documents d WHERE d.employeeId = e.id) AS documentsCount,
              (SELECT COUNT(*) FROM hrcrm_documents d WHERE d.employeeId = e.id AND d.verificationStatus = 'approved') AS documentsApproved
       FROM employees e
       LEFT JOIN hrcrm_verification v ON v.employeeId = e.id
       ${whereSql}
       ORDER BY e.joining_date DESC, e.id DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    const [{ total }] = await query(
      `SELECT COUNT(*) AS total FROM employees e LEFT JOIN hrcrm_verification v ON v.employeeId = e.id ${whereSql}`,
      params
    );
    return { rows, total };
  },

  async getWorker(employeeId, { sensitive = false } = {}) {
    return this.getFullProfile(employeeId, { sensitive });
  },

  async createRegistration({ employeeId, name, department, designation, joiningDate, officialEmail, personalEmail, employmentType, reportingManager, salary, wagePerHour, sendCredentials, frontendUrl }, actor) {
    const existingEmp = await queryOne('SELECT id FROM employees WHERE employee_id = ?', [employeeId]);
    const existingUser = await queryOne('SELECT id FROM hrcrm_users WHERE employeeId = ? OR email = ?', [existingEmp?.id ?? -1, officialEmail]);

    return withTransaction(async (conn) => {
      let empId;
      if (existingEmp) {
        empId = existingEmp.id;
        await conn.query(
          `UPDATE employees SET name = ?, department = ?, designation = ?, joining_date = ?, email = ?, salary = ?, wage_per_hour = ? WHERE id = ?`,
          [name, department || null, designation || null, joiningDate ? new Date(joiningDate) : null, officialEmail || undefined, salary ?? null, wagePerHour ?? null, empId]
        );
      } else {
        const [ins] = await conn.query(
          `INSERT INTO employees (employee_id, name, email, department, designation, joining_date, salary, wage_per_hour, emp_status, company, profile_completed)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', 'Payivva Technologies', 0)`,
          [employeeId, name, officialEmail || `${employeeId}@payivva.emp`, department || null, designation || null, joiningDate ? new Date(joiningDate) : null, salary ?? null, wagePerHour ?? null]
        );
        empId = ins.insertId;
      }

      if (existingUser) {
        throw Errors.conflict('A HRCRM account already exists for this employee or email', 'ACCOUNT_EXISTS');
      }

      let passwordHash = null;
      const legacy = await conn.query(
        `SELECT password FROM users WHERE LOWER(email) = ? LIMIT 1`,
        [String(officialEmail || '').toLowerCase()]
      );
      if (legacy[0]?.[0]) {
        passwordHash = legacy[0][0].password;
      }

      const onboardingToken = randomBytes(32).toString('hex');
      const [usr] = await conn.query(
        `INSERT INTO hrcrm_users (employeeId, email, password, role, status, name, onboardingToken, onboardingTokenExpiresAt)
         VALUES (?, ?, ?, 'worker', 'pending_onboarding', ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
        [empId, officialEmail || `${employeeId}@payivva.emp`, passwordHash || (await bcrypt.hash(randomBytes(8).toString('hex'), 10)), name, onboardingToken]
      );

      await conn.query(
        `INSERT INTO hrcrm_verification (employeeId, profileStatus) VALUES (?, 'not_started')
         ON DUPLICATE KEY UPDATE profileStatus = 'not_started'`,
        [empId]
      );

      const year = new Date().getFullYear();
      for (const [type, total] of [['casual', 12], ['privilege', 12], ['half_day', 2], ['wfh', 4]]) {
        await conn.query(
          `INSERT INTO hrcrm_leave_balances (employeeId, leaveType, year, total, used) VALUES (?, ?, ?, ?, 0)
           ON DUPLICATE KEY UPDATE total = VALUES(total)`,
          [empId, type, year, total]
        );
      }

      const baseUrl = frontendUrl || process.env.FRONTEND_URL || 'http://localhost:5173';
      const link = `${baseUrl.replace(/\/$/, '')}/onboarding?employee=${encodeURIComponent(employeeId)}&token=${onboardingToken}`;
      if (sendCredentials && (officialEmail || personalEmail)) {
        await emailService.sendWorkerOnboardingEmail({
          workerName: name,
          workerCode: employeeId,
          email: officialEmail || personalEmail,
          loginUrl: link,
        });
      }

      await auditService.log({
        userId: actor?.id,
        action: 'CREATE',
        module: 'worker_registration',
        entityId: empId,
        description: `${actor?.name} registered worker ${employeeId} (${name})`,
        ip: actor?.ip,
      });
      await notificationService.createForRole({
        role: 'director',
        title: 'New worker registered',
        message: `${name} (${employeeId}) registered by IT`,
        type: 'info',
        relatedEntity: 'employee',
        relatedId: empId,
      });

      return { employeeId: empId, accountId: usr.insertId, onboardingLink: link };
    });
  },

  async updateProfile(employeeId, { section, data, education }, actor) {
    if (!SECTION_TABLES[section] && !['education', 'skills'].includes(section)) {
      throw Errors.badRequest('Unknown profile section', 'INVALID_SECTION');
    }

    return withTransaction(async (conn) => {
      const sectionMeta = SECTION_TABLES[section];
      const { table: tableName, fields = [], sync = null } = sectionMeta || {};
      const cleaned = {};
      for (const f of fields) {
        if (data[f] !== undefined) cleaned[f] = data[f] === '' ? null : data[f];
      }
      if (section === 'education') {
        await conn.query('DELETE FROM hrcrm_education WHERE employeeId = ?', [employeeId]);
        for (const ed of education || []) {
          if (!ed?.qualification) continue;
          await conn.query(
            'INSERT INTO hrcrm_education (employeeId, qualification, institute, year, percentage) VALUES (?, ?, ?, ?, ?)',
            [employeeId, ed.qualification, ed.institute || null, ed.year || null, ed.percentage || null]
          );
        }
      } else if (section !== 'skills') {
        if (!Object.keys(cleaned).length) throw Errors.badRequest('No fields to update');
        const cols = Object.keys(cleaned);
        const values = Object.values(cleaned);
        await conn.query(
          `INSERT INTO ${tableName} (employeeId, ${cols.join(', ')})
           VALUES (?, ${cols.map(() => '?').join(', ')})
           ON DUPLICATE KEY UPDATE ${cols.map((c) => `${c} = VALUES(${c})`).join(', ')}`,
          [employeeId, ...values]
        );
      }

      if (section === 'skills') {
        await conn.query('DELETE FROM hrcrm_skills WHERE employeeId = ?', [employeeId]);
        for (const s of data.skills || []) {
          await conn.query(
            'INSERT INTO hrcrm_skills (employeeId, category, skill) VALUES (?, ?, ?)',
            [employeeId, s.category, s.skill]
          );
        }
      }

      const syncFields = sync?.(cleaned) || {};
      if (Object.keys(syncFields).length) {
        const sets = Object.entries(syncFields)
          .filter(([, v]) => v !== undefined)
          .map(([k]) => `${k} = ?`)
          .join(', ');
        if (sets) {
          const vals = Object.entries(syncFields)
            .filter(([, v]) => v !== undefined)
            .map(([, v]) => (v === '' ? null : v));
          await conn.query(`UPDATE employees SET ${sets} WHERE id = ?`, [...vals, employeeId]);
        }
      }

      const status = 'incomplete';
      await conn.query(
        `UPDATE hrcrm_verification SET profileStatus = 'incomplete' WHERE employeeId = ? AND profileStatus IN ('not_started','incomplete')`,
        [employeeId]
      );

      await auditService.log({
        userId: actor?.id,
        action: 'UPDATE',
        module: 'profile',
        entityId: employeeId,
        description: `${actor?.name} updated profile section ${section} for employee #${employeeId}`,
        ip: actor?.ip,
      });
      return { success: true };
    });
  },

  async submitProfile(employeeId, actor) {
    const profile = await this.getFullProfile(employeeId);
    const { percent } = profile.profileCompletion;
    if (percent < 100) {
      throw Errors.badRequest(`Profile incomplete (${percent}%). Complete all sections before submitting.`, 'PROFILE_INCOMPLETE');
    }
    const missingDocs = this.missingRequiredDocuments(profile.documents);
    if (missingDocs.length) {
      throw Errors.badRequest(`Required documents missing: ${missingDocs.join(', ')}`, 'DOCUMENTS_MISSING');
    }

    return withTransaction(async (conn) => {
      await conn.query(
        `INSERT INTO hrcrm_verification (employeeId, profileStatus, submittedAt, itStatus, directorStatus)
         VALUES (?, 'submitted', NOW(), 'pending', 'pending')
         ON DUPLICATE KEY UPDATE profileStatus = 'submitted', submittedAt = NOW(),
           itStatus = CASE WHEN itStatus = 'rejected' THEN 'pending' ELSE itStatus END,
           directorStatus = CASE WHEN directorStatus = 'rejected' THEN 'pending' ELSE directorStatus END`,
        [employeeId]
      );
      await conn.query('UPDATE employees SET profile_completed = 1 WHERE id = ?', [employeeId]);
      await conn.query(
        `INSERT INTO hrcrm_verification_history (employeeId, action, actorId, actorRole, remarks)
         VALUES (?, 'submitted', ?, 'worker', 'Profile submitted for verification')`,
        [employeeId, actor?.id]
      );
    });

    await notificationService.createForRole({
      role: 'it',
      title: 'Profile submitted for verification',
      message: `${profile.employee.name} submitted their profile for verification`,
      type: 'verification',
      relatedEntity: 'employee',
      relatedId: employeeId,
    });
    await notificationService.createForRole({
      role: 'director',
      title: 'Profile submitted for verification',
      message: `${profile.employee.name} submitted their profile for verification`,
      type: 'verification',
      relatedEntity: 'employee',
      relatedId: employeeId,
    });
    await auditService.log({
      userId: actor?.id,
      action: 'SUBMIT',
      module: 'profile',
      entityId: employeeId,
      description: `${profile.employee.name} submitted profile for verification`,
      ip: actor?.ip,
    });
    return { success: true };
  },

  missingRequiredDocuments(documents) {
    const required = ['resume', 'aadhaar', 'pan', 'photo', 'bank_proof', 'educational_certificates', 'offer_letter', 'employment_agreement'];
    const have = new Set(documents.filter((d) => d.verificationStatus !== 'rejected').map((d) => d.docType));
    return required.filter((t) => !have.has(t));
  },

  async verifyEmployee(employeeId, { level, decision, remarks }, actor) {
    if (!['it', 'director'].includes(level)) throw Errors.badRequest('Invalid verification level');
    if (!['approved', 'rejected'].includes(decision)) throw Errors.badRequest('Invalid decision');
    const verification = await queryOne('SELECT * FROM hrcrm_verification WHERE employeeId = ?', [employeeId]);
    if (!verification) throw Errors.badRequest('Worker has not submitted a profile yet', 'NOT_SUBMITTED');
    if (verification.profileStatus === 'fully_verified') {
      throw Errors.badRequest('Employee already fully verified', 'ALREADY_VERIFIED');
    }

    const colPrefix = level === 'it' ? 'it' : 'director';
    const statusMap = {
      'it-approved': { profileStatus: 'it_approved', status: 'approved' },
      'it-rejected': { profileStatus: 'it_rejected', status: 'rejected' },
      'director-approved': { profileStatus: 'director_approved', status: 'approved' },
      'director-rejected': { profileStatus: 'director_rejected', status: 'rejected' },
    };
    const finalProfileStatus =
      level === 'director' && decision === 'approved'
        ? 'fully_verified'
        : statusMap[`${level}-${decision}`].profileStatus;

    const newStatus = statusMap[`${level}-${decision}`].status;

    await withTransaction(async (conn) => {
      await conn.query(
        `UPDATE hrcrm_verification SET
           ${colPrefix}Status = ?, ${colPrefix}ReviewerId = ?, ${colPrefix}ReviewedAt = NOW(),
           ${colPrefix}Remarks = ?, profileStatus = ?
         WHERE employeeId = ?`,
        [newStatus, actor?.id || null, remarks || null, finalProfileStatus, employeeId]
      );
      await conn.query(
        `INSERT INTO hrcrm_verification_history (employeeId, action, actorId, actorRole, remarks)
         VALUES (?, ?, ?, ?, ?)`,
        [employeeId, `${level}_${decision}`, actor?.id, actor?.role, remarks]
      );
      if (level === 'director' && decision === 'approved') {
        await conn.query('UPDATE employees SET emp_status = ? WHERE id = ?', ['Active', employeeId]);
      }
    });

    const workerUser = await queryOne(
      `SELECT u.id, e.email, e.name FROM hrcrm_users u JOIN employees e ON e.id = u.employeeId WHERE u.employeeId = ?`,
      [employeeId]
    );

    if (decision === 'approved' && level === 'it') {
      await notificationService.createForRole({
        role: 'director',
        title: 'IT approved a profile',
        message: `${workerUser?.name} profile is now awaiting Director verification`,
        type: 'verification',
        relatedEntity: 'employee',
        relatedId: employeeId,
      });
    }
    if (workerUser) {
      await notificationService.create({
        userId: workerUser.id,
        title: decision === 'approved' ? 'Profile verified' : 'Profile rejected',
        message:
          decision === 'approved'
            ? level === 'director'
              ? 'Congratulations! Your profile is now FULLY VERIFIED.'
              : 'IT verified your profile. Awaiting Director verification.'
            : `Your profile was rejected by ${level === 'it' ? 'IT' : 'Director'}. Reason: ${remarks || 'Not specified'}`,
        type: 'verification',
        relatedEntity: 'employee',
        relatedId: employeeId,
      });
      if (decision === 'approved' && workerUser?.email) {
        await emailService.sendVerificationApprovedEmail({
          workerName: workerUser.name,
          workerCode: String(employeeId),
          email: workerUser.email,
          level,
        });
      }
      if (decision === 'rejected' && workerUser?.email) {
        await emailService.send({
          to: workerUser.email,
          subject: `Your profile was rejected (${level === 'it' ? 'IT' : 'Director'})`,
          html: `<p>Dear ${workerUser.name},</p><p>Your employee profile was rejected by the ${level === 'it' ? 'IT Department' : 'Director'}.</p><p>Reason: ${remarks || 'Not specified'}</p><p>Please log in to Payivva HRCRM, correct the information and resubmit.</p>`,
          category: 'profile_rejection',
          relatedEntity: 'employee',
          relatedId: employeeId,
        });
      }
    }

    await auditService.log({
      userId: actor?.id,
      action: decision === 'approved' ? 'VERIFY_APPROVE' : 'VERIFY_REJECT',
      module: 'verification',
      entityId: employeeId,
      description: `${actor?.name} ${decision} worker ${workerUser?.name || employeeId} at ${level} level`,
      ip: actor?.ip,
    });
    return { success: true, profileStatus: finalProfileStatus };
  },

  async reopenProfile(employeeId, actor) {
    await withTransaction(async (conn) => {
      await conn.query(
        `UPDATE hrcrm_verification SET profileStatus = 'incomplete', itStatus = 'pending', directorStatus = 'pending',
           itReviewerId = NULL, directorReviewerId = NULL, reopenedById = ?, reopenedAt = NOW()
         WHERE employeeId = ?`,
        [actor?.id || null, employeeId]
      );
      await conn.query(
        `INSERT INTO hrcrm_verification_history (employeeId, action, actorId, actorRole, remarks)
         VALUES (?, 'reopened', ?, ?, 'Profile reopened for editing')`,
        [employeeId, actor?.id, actor?.role]
      );
    });
    await auditService.log({
      userId: actor?.id,
      action: 'REOPEN',
      module: 'verification',
      entityId: employeeId,
      description: `${actor?.name} reopened profile of employee #${employeeId}`,
      ip: actor?.ip,
    });
    return { success: true };
  },

  async canEditProfile(employeeId, role) {
    if (role !== 'worker') return true;
    const v = await queryOne('SELECT profileStatus FROM hrcrm_verification WHERE employeeId = ?', [employeeId]);
    if (!v) return true;
    return ['not_started', 'incomplete', 'it_rejected', 'director_rejected', 'fully_verified'].includes(v.profileStatus);
  },

  async updateAssets(employeeId, { assets = [] }, actor) {
    if (!Array.isArray(assets)) throw Errors.badRequest('assets must be an array', 'INVALID_ASSETS');
    const list = assets.filter((a) => a).map((a) => String(a).trim()).filter(Boolean);
    return withTransaction(async (conn) => {
      await conn.query('DELETE FROM employee_inventory WHERE employeeId = ?', [employeeId]);
      for (const component of list) {
        await conn.query(
          `INSERT INTO employee_inventory (employeeId, component, quantity, issued_date, notes, createdBy)
           VALUES (?, ?, 1, CURDATE(), 'Issued via HRCRM', ?)`,
          [employeeId, component, actor?.id || null]
        );
      }
      await auditService.log({
        userId: actor?.id,
        action: 'UPDATE',
        module: 'assets',
        entityId: employeeId,
        description: `${actor?.name} updated assets of employee #${employeeId}: ${list.join(', ') || 'none'}`,
        ip: actor?.ip,
      });
    });
    return { success: true, assets: list };
  },
};