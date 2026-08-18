import { asyncHandler, ok } from '../utils/asyncHandler.js';
import { letterService } from '../services/letterService.js';
import { Errors } from '../utils/ApiError.js';

export const lettersController = {
  generate: asyncHandler(async (req, res) => {
    const letter = await letterService.generate({
      employeeId: Number(req.body.employeeId),
      letterType: req.body.letterType,
      title: req.body.title,
      extra: req.body.extra || {},
      actor: { ...req.user, ip: req.ip },
    });
    ok(res, letter, 'Letter generated', 201);
  }),

  list: asyncHandler(async (req, res) => {
    const data = await letterService.list({
      employeeId: req.query.employeeId || null,
      letterType: req.query.letterType || null,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    ok(res, data);
  }),

  my: asyncHandler(async (req, res) => {
    if (!req.user.employeeId) throw Errors.badRequest('No employee linked', 'NO_EMPLOYEE');
    const data = await letterService.list({ employeeId: req.user.employeeId });
    ok(res, data);
  }),

  get: asyncHandler(async (req, res) => {
    const letter = await letterService.get(Number(req.params.id));
    if (req.user.role === 'worker' && letter.employeeId !== req.user.employeeId) {
      throw Errors.forbidden('Access denied');
    }
    ok(res, letter);
  }),

  downloadPdf: asyncHandler(async (req, res) => {
    const letter = await letterService.get(Number(req.params.id));
    if (req.user.role === 'worker' && letter.employeeId !== req.user.employeeId) {
      throw Errors.forbidden('Access denied');
    }
    if (!letter.pdfContent) throw Errors.badRequest('PDF not generated', 'NO_PDF');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(letter.title.replace(/\s+/g, '_'))}_v${letter.version}.pdf"`);
    res.send(Buffer.from(letter.pdfContent, 'base64'));
  }),

  sendEmail: asyncHandler(async (req, res) => {
    const letter = await letterService.get(Number(req.params.id));
    if (req.user.role === 'worker') throw Errors.forbidden('Only IT/Director can send letters');
    const result = await letterService.sendEmail(Number(req.params.id), {
      to: req.body.to || null,
      actor: { ...req.user, ip: req.ip },
    });
    ok(res, result, result.sent ? 'Letter emailed' : 'Email send attempted (check SMTP configuration)');
  }),
};