const mongoose = require('mongoose');

const primaryAdminCodeSchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  codeHash: { type: String, required: true, select: false },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });

primaryAdminCodeSchema.index({ organisationId: 1 }, { unique: true });
primaryAdminCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PrimaryAdminCode', primaryAdminCodeSchema);
