import { asyncHandler, ok } from '../utils/asyncHandler.js';
import { auditService } from '../services/auditService.js';

export const auditController = {
  list: asyncHandler(async (req, res) => {
    const data = await auditService.list({
      limit: req.query.limit,
      offset: req.query.offset,
      module: req.query.module || null,
      action: req.query.action || null,
      userId: req.query.userId || null,
    });
    ok(res, data);
  }),
};