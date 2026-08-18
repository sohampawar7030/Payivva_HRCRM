import { query, queryOne, withTransaction } from '../config/db.js';
import { Errors } from '../utils/ApiError.js';
import { auditService } from './auditService.js';
import { notificationService } from './notificationService.js';
import { emailService } from './emailService.js';
import { DOCUMENT_TYPES } from '../../shared/constants.js';
import { settingsService } from './settingsService.js';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const EXT_ALLOWED = ['pdf', 'jpg', 'jpeg', 'png'];

export const documentService = {
  async upload({ employeeId, docType, originalName, mimeType, size, content, category, actor }) {
    const docMeta = DOCUMENT_TYPES[docType];
    if (!docMeta) throw Errors.badRequest(`Unknown document type: ${docType}`, 'INVALID_DOC_TYPE');
    if (!ALLOWED_TYPES.includes(mimeType)) {
      throw Errors.badRequest('Only PDF, JPG or PNG files are allowed', 'INVALID_FILE_TYPE');
    }
    const ext = String(originalName || '').split('.').pop()?.toLowerCase();
    if (!EXT_ALLOWED.includes(ext)) {
      throw Errors.badRequest('File extension not allowed', 'INVALID_FILE_EXTENSION');
    }
    const maxMb = Number(await settingsService.get('maxDocumentSizeMb', '2')) || 2;
    if (size > maxMb * 1024 * 1024) {
      throw Errors.badRequest(`File exceeds ${maxMb} MB limit`, 'FILE_TOO_LARGE');
    }
    if (!content) throw Errors.badRequest('File content missing', 'NO_FILE_CONTENT');
    const decoded = Buffer.from(content, 'base64');
    if (decoded.length > maxMb * 1024 * 1024) {
      throw Errors.badRequest(`File exceeds ${maxMb} MB limit`, 'FILE_TOO_LARGE');
    }

    const employee = await queryOne('SELECT * FROM employees WHERE id = ?', [employeeId]);
    if (!employee) throw Errors.notFound('Employee not found');

    return withTransaction(async (conn) => {
      const [existing] = await conn.query(
        `SELECT id, version FROM hrcrm_documents WHERE employeeId = ? AND docType = ? ORDER BY version DESC LIMIT 1`,
        [employeeId, docType]
      );
      const newVersion = (existing?.[0]?.version || 0) + 1;
      const fileName = `${employee.employee_id}_${docType}_v${newVersion}_${Date.now()}.${ext}`;

      const [ins] = await conn.query(
        `INSERT INTO hrcrm_documents
           (employeeId, docType, category, originalName, fileName, mimeType, size, content, verificationStatus, version, uploadedById)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [employeeId, docType, docMeta.category, originalName, fileName, mimeType, decoded.length, content, newVersion, actor?.id || null]
      );

      await conn.query(
        `UPDATE hrcrm_verification SET profileStatus = 'incomplete' WHERE employeeId = ? AND profileStatus IN ('not_started','incomplete','it_rejected','director_rejected')`,
        [employeeId]
      );
      return ins.insertId;
    });
  },

  async listForEmployee(employeeId, { includeContent = false } = {}) {
    return query(
      `SELECT id, employeeId, docType, category, originalName, fileName, mimeType, size,
              verificationStatus, verifiedById, verifiedAt, rejectionReason, remarks, version, uploadedById, uploadedAt
              ${includeContent ? ', content' : ''}
       FROM hrcrm_documents WHERE employeeId = ? ORDER BY uploadedAt DESC`,
      [employeeId]
    );
  },

  async get(id, { includeContent = false } = {}) {
    const doc = await queryOne(
      `SELECT d.*, e.name AS employeeName, e.employee_id AS employeeCode, v.name AS verifiedByName
       FROM hrcrm_documents d
       JOIN employees e ON e.id = d.employeeId
       LEFT JOIN hrcrm_users v ON v.id = d.verifiedById
       WHERE d.id = ?`,
      [id]
    );
    if (!doc) throw Errors.notFound('Document not found');
    if (!includeContent) delete doc.content;
    return doc;
  },

  async listAll({ employeeId = null, status = null, limit = 200, offset = 0 }) {
    const where = [];
    const params = [];
    if (employeeId) { where.push('d.employeeId = ?'); params.push(employeeId); }
    if (status) { where.push('d.verificationStatus = ?'); params.push(status); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await query(
      `SELECT d.id, d.employeeId, d.docType, d.category, d.originalName, d.size, d.verificationStatus,
              d.verifiedAt, d.rejectionReason, d.remarks, d.version, d.uploadedAt,
              e.name AS employeeName, e.employee_id AS employeeCode
       FROM hrcrm_documents d
       JOIN employees e ON e.id = d.employeeId
       ${whereSql}
       ORDER BY d.uploadedAt DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM hrcrm_documents d ${whereSql}`, params);
    return { rows, total };
  },

  async verify(id, { decision, remarks, actor, reviewerRole }) {
    const doc = await queryOne('SELECT * FROM hrcrm_documents WHERE id = ?', [id]);
    if (!doc) throw Errors.notFound('Document not found');
    const status = decision === 'approved' ? 'approved' : 'rejected';
    await query(
      `UPDATE hrcrm_documents SET verificationStatus = ?, verifiedById = ?, verifiedAt = NOW(), rejectionReason = ?, remarks = ?
       WHERE id = ?`,
      [status, actor?.id || null, decision === 'rejected' ? remarks : null, remarks, id]
    );
    await auditService.log({
      userId: actor?.id,
      action: decision === 'approved' ? 'VERIFY_APPROVE' : 'VERIFY_REJECT',
      module: 'document',
      entityId: id,
      description: `${actor?.name} ${decision} document ${doc.originalName} (${doc.docType}) for employee #${doc.employeeId}`,
      ip: actor?.ip,
    });

    const workerUser = await queryOne(
      `SELECT u.id, e.email, e.name FROM hrcrm_users u JOIN employees e ON e.id = u.employeeId WHERE u.employeeId = ?`,
      [doc.employeeId]
    );
    if (workerUser) {
      await notificationService.create({
        userId: workerUser.id,
        title: decision === 'approved' ? 'Document verified' : 'Document rejected',
        message: `${doc.originalName} was ${status}${decision === 'rejected' ? ` - ${remarks || 'No reason provided'}` : ''}`,
        type: 'document',
        relatedEntity: 'document',
        relatedId: id,
      });
    }
    return { success: true };
  },

  async download(id) {
    const doc = await this.get(id, { includeContent: true });
    if (!doc.content) throw Errors.badRequest('Document content is empty', 'NO_CONTENT');
    return doc;
  },
};