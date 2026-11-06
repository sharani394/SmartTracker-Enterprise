const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  nameKey: { type: String, required: true, lowercase: true, trim: true },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

departmentSchema.index({ organisationId: 1, nameKey: 1 }, { unique: true });
departmentSchema.index({ organisationId: 1, status: 1, name: 1 });

module.exports = mongoose.model('Department', departmentSchema);
