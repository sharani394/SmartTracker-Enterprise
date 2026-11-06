const mongoose = require('mongoose');

const ticketActivitySchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actorName: { type: String, required: true, trim: true, maxlength: 120 },
  actorRole: { type: String, required: true },
  action: { type: String, required: true, maxlength: 80 },
  visibility: { type: String, enum: ['PUBLIC', 'INTERNAL'], default: 'PUBLIC' },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } });

ticketActivitySchema.index({ organisationId: 1, ticketId: 1, visibility: 1, createdAt: 1 });

module.exports = mongoose.model('TicketActivity', ticketActivitySchema);
