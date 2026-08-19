import { asyncHandler, ok } from '../utils/asyncHandler.js';
import { siteService } from '../services/siteService.js';

export const siteController = {
  list: asyncHandler(async (req, res) => {
    const rows = await siteService.list();
    ok(res, { rows });
  }),

  setStatus: asyncHandler(async (req, res) => {
    const data = await siteService.setStatus(Number(req.params.id), req.body.status, req.body.notes, {
      ...req.user,
      ip: req.ip,
    });
    const msg =
      data.status === 'running'
        ? 'Site resumed — attendance active'
        : data.status === 'stopped'
          ? 'Site stopped — attendance paused'
          : 'Site put on hold — attendance paused';
    ok(res, data, msg);
  }),
};
