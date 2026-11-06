const TicketActivity = require('../models/TicketActivity');
const Notification = require('../models/Notification');

async function recordTicketActivity(req, ticket, { action, visibility = 'PUBLIC', details = {} }) {
  return TicketActivity.create({
    organisationId: req.auth.organisationId,
    ticketId: ticket._id,
    actorId: req.auth.user._id,
    actorName: req.auth.user.fullName,
    actorRole: req.auth.role,
    action,
    visibility,
    details,
  });
}

async function createTicketNotifications(req, ticket, entries) {
  const unique = new Map();
  for (const entry of entries) {
    if (!entry.recipientId || (String(entry.recipientId) === String(req.auth.user._id) && !entry.notifyActor)) continue;
    unique.set(String(entry.recipientId), entry);
  }
  if (!unique.size) return [];

  return Notification.insertMany([...unique.values()].map((entry) => ({
    organisationId: req.auth.organisationId,
    recipientId: entry.recipientId,
    actorId: req.auth.user._id,
    ticketId: ticket._id,
    type: entry.type,
    title: entry.title,
    message: entry.message,
  })));
}

module.exports = { recordTicketActivity, createTicketNotifications };
