const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  refreshTokenHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null, index: true },
  userAgent: { type: String, maxlength: 500, default: '' },
  ipAddress: { type: String, maxlength: 100, default: '' },
}, { timestamps: true });

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1, organisationId: 1, revokedAt: 1 });

module.exports = mongoose.model('Session', sessionSchema);
