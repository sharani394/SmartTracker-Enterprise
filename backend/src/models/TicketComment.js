const mongoose = require('mongoose');

const ticketCommentSchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true, trim: true, maxlength: 120 },
  authorRole: { type: String, required: true },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  visibility: { type: String, enum: ['PUBLIC', 'INTERNAL'], default: 'PUBLIC', required: true },
}, { timestamps: true });

ticketCommentSchema.index({ organisationId: 1, ticketId: 1, visibility: 1, createdAt: 1 });

module.exports = mongoose.model('TicketComment', ticketCommentSchema);
