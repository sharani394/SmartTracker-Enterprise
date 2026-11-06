const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  organisationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organisation',
    required: true,
    index: true,
  },
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  phone: { type: String, required: true, trim: true, maxlength: 40 },
  passwordHash: { type: String, required: true, select: false },
  role: {
    type: String,
    enum: ['OWNER', 'PRIMARY_ADMIN', 'INTERNAL_ADMIN', 'EMPLOYEE', 'SUPPORT_AGENT'],
    required: true,
  },
  requestedRole: { type: String, enum: ['EMPLOYEE', 'SUPPORT_AGENT'], default: null },
  permissions: {
    type: [{ type: String, enum: [
      'users:read', 'users:manage', 'agents:read', 'agents:manage',
      'departments:read', 'departments:manage', 'settings:read', 'settings:manage', 'audit:read',
      'tickets:read', 'tickets:manage',
      'knowledge:read', 'knowledge:manage', 'reports:read',
    ] }],
    default: [],
  },
  status: {
    type: String,
    enum: ['PENDING_EMAIL', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'SUSPENDED'],
    required: true,
    index: true,
  },
  emailVerifiedAt: { type: Date, default: null },
  department: { type: String, trim: true, maxlength: 100, default: '' },
  employeeId: { type: String, trim: true, maxlength: 80, default: '' },
  jobTitle: { type: String, trim: true, maxlength: 100, default: '' },
  experience: { type: String, trim: true, maxlength: 80, default: '' },
  skills: { type: [String], default: [] },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rejectionReason: { type: String, trim: true, maxlength: 500, default: '' },
  passwordChangedAt: { type: Date, default: null },
}, { timestamps: true });

userSchema.index({ organisationId: 1, status: 1, role: 1 });
userSchema.index(
  { organisationId: 1, role: 1 },
  { unique: true, partialFilterExpression: { role: 'PRIMARY_ADMIN' } }
);

module.exports = mongoose.model('User', userSchema);
