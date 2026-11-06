const mongoose = require('mongoose');

const adminInvitationSchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  permissions: { type: [String], default: [] },
  codeHash: { type: String, required: true, select: false },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });

adminInvitationSchema.index({ userId: 1 }, { unique: true });
adminInvitationSchema.index({ organisationId: 1, expiresAt: 1 });
adminInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AdminInvitation', adminInvitationSchema);
