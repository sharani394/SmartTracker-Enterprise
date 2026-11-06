const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  type: {
    type: String,
    enum: ['TICKET_CREATED', 'TICKET_ASSIGNED', 'TICKET_REASSIGNED', 'TICKET_ACCEPTED', 'TICKET_REJECTED', 'TICKET_STATUS_CHANGED', 'TICKET_COMMENT'],
    required: true,
  },
  title: { type: String, required: true, maxlength: 160 },
  message: { type: String, required: true, maxlength: 500 },
  readAt: { type: Date, default: null },
}, { timestamps: true });

notificationSchema.index({ organisationId: 1, recipientId: 1, createdAt: -1 });
notificationSchema.index({ organisationId: 1, recipientId: 1, readAt: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
