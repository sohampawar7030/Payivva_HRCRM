import { asyncHandler, ok } from '../utils/asyncHandler.js';
import { notificationService } from '../services/notificationService.js';

export const notificationsController = {
  list: asyncHandler(async (req, res) => {
    const rows = await notificationService.listForUser(req.user.id, {
      limit: req.query.limit,
      unreadOnly: req.query.unreadOnly === '1',
    });
    const unreadCount = await notificationService.unreadCount(req.user.id);
    ok(res, { rows, unreadCount });
  }),

  markRead: asyncHandler(async (req, res) => {
    await notificationService.markRead(req.user.id, Number(req.params.id));
    ok(res, null, 'Notification marked as read');
  }),

  markAllRead: asyncHandler(async (req, res) => {
    await notificationService.markAllRead(req.user.id);
    ok(res, null, 'All notifications marked as read');
  }),

  unreadCount: asyncHandler(async (req, res) => {
    const count = await notificationService.unreadCount(req.user.id);
    ok(res, { count });
  }),
};