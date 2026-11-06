const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actorRole: { type: String, required: true },
  actorName: { type: String, trim: true, maxlength: 120, default: '' },
  action: { type: String, required: true, maxlength: 100 },
  targetType: { type: String, required: true, maxlength: 80 },
  targetId: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ipAddress: { type: String, maxlength: 100, default: '' },
}, { timestamps: { createdAt: true, updatedAt: false } });

auditEventSchema.index({ organisationId: 1, createdAt: -1 });
auditEventSchema.index({ organisationId: 1, action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditEvent', auditEventSchema);
