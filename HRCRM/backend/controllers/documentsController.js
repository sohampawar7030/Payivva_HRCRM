import { asyncHandler, ok } from '../utils/asyncHandler.js';
import { documentService } from '../services/documentService.js';
import { Errors } from '../utils/ApiError.js';

export const documentsController = {
  upload: asyncHandler(async (req, res) => {
    const employeeId = Number(req.body.employeeId || req.user.employeeId);
    if (!['it', 'director'].includes(req.user.role) && req.user.employeeId !== employeeId) {
      throw Errors.forbidden('You can only upload documents to your own profile');
    }
    const id = await documentService.upload({
      employeeId,
      docType: req.body.docType,
      originalName: req.body.originalName,
      mimeType: req.body.mimeType,
      size: Number(req.body.size) || 0,
      content: req.body.content,
      actor: { ...req.user, ip: req.ip },
    });
    ok(res, { id }, 'Document uploaded', 201);
  }),

  listForEmployee: asyncHandler(async (req, res) => {
    const employeeId = Number(req.params.employeeId);
    if (!['it', 'director'].includes(req.user.role) && req.user.employeeId !== employeeId) {
      throw Errors.forbidden('Access denied');
    }
    const rows = await documentService.listForEmployee(employeeId);
    ok(res, { rows });
  }),

  listAll: asyncHandler(async (req, res) => {
    const data = await documentService.listAll({
      employeeId: req.query.employeeId || null,
      status: req.query.status || null,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    ok(res, data);
  }),

  verify: asyncHandler(async (req, res) => {
    await documentService.verify(Number(req.params.id), {
      decision: req.body.decision,
      remarks: req.body.remarks,
      actor: { ...req.user, ip: req.ip },
    });
    ok(res, null, `Document ${req.body.decision}`);
  }),

  download: asyncHandler(async (req, res) => {
    const doc = await documentService.download(Number(req.params.id));
    if (!['it', 'director'].includes(req.user.role) && req.user.employeeId !== doc.employeeId) {
      throw Errors.forbidden('Access denied');
    }
    const mime = doc.mimeType || 'application/pdf';
    const isPdf = mime === 'application/pdf';
    res.setHeader('Content-Type', isPdf ? 'application/pdf' : mime);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName)}"`);
    res.setHeader('Content-Length', doc.content ? Buffer.from(doc.content, 'base64').length : 0);
    if (req.query.download === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
    }
    res.send(Buffer.from(doc.content || '', 'base64'));
  }),
};