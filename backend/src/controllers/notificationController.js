const Notification = require('../models/Notification');
const { AppError } = require('../middleware/errorHandler');
const { serializeNotification } = require('../utils/ticketSerialization');

async function listNotifications(req, res) {
  const filter = {
    organisationId: req.auth.organisationId,
    recipientId: req.auth.user._id,
  };
  if (req.query.read === 'true') filter.readAt = { $ne: null };
  if (req.query.read === 'false') filter.readAt = null;

  const page = Number.parseInt(req.query.page || '1', 10);
  const limit = Number.parseInt(req.query.limit || '20', 10);
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ organisationId: req.auth.organisationId, recipientId: req.auth.user._id, readAt: null }),
  ]);

  return res.json({
    notifications: notifications.map(serializeNotification),
    unreadCount,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

async function markAllRead(req, res) {
  const result = await Notification.updateMany({
    organisationId: req.auth.organisationId,
    recipientId: req.auth.user._id,
    readAt: null,
  }, { $set: { readAt: new Date() } });
  return res.json({ message: 'Notifications marked as read.', updatedCount: result.modifiedCount });
}

async function setReadState(req, res) {
  const notification = await Notification.findOneAndUpdate({
    _id: req.params.notificationId,
    organisationId: req.auth.organisationId,
    recipientId: req.auth.user._id,
  }, { $set: { readAt: req.body.read ? new Date() : null } }, { new: true });
  if (!notification) throw new AppError('Notification was not found.', 404, 'NOTIFICATION_NOT_FOUND');
  return res.json({ notification: serializeNotification(notification) });
}

module.exports = { listNotifications, markAllRead, setReadState };
