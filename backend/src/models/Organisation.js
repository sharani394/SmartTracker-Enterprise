const mongoose = require('mongoose');

const organisationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  emailDomain: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    maxlength: 253,
  },
  industry: { type: String, required: true, trim: true, maxlength: 100 },
  country: { type: String, required: true, trim: true, maxlength: 100 },
  settings: {
    supportEmail: { type: String, lowercase: true, trim: true, default: '' },
    timezone: { type: String, trim: true, default: 'UTC' },
    memberRegistrationEnabled: { type: Boolean, default: true },
    loginAlertsEnabled: { type: Boolean, default: false },
  },
  status: {
    type: String,
    enum: ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED'],
    default: 'PENDING_VERIFICATION',
    index: true,
  },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

organisationSchema.index({ emailDomain: 1 }, { unique: true });

module.exports = mongoose.model('Organisation', organisationSchema);
