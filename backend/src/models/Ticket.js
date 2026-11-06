const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
  ticketNumber: { type: String, required: true, uppercase: true, trim: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, required: true, trim: true, maxlength: 10000 },
  category: { type: String, enum: ['Hardware', 'Software', 'Network', 'Access', 'Other'], required: true },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM', required: true },
  status: { type: String, enum: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED'], default: 'OPEN', required: true },
  acceptance: { type: String, enum: ['NOT_ASSIGNED', 'PENDING', 'ACCEPTED', 'REJECTED'], default: 'NOT_ASSIGNED', required: true },
  createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  employeeName: { type: String, required: true, trim: true, maxlength: 120 },
  employeeEmail: { type: String, required: true, lowercase: true, trim: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  departmentName: { type: String, trim: true, maxlength: 100, default: '' },
  assignedAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedAgentName: { type: String, trim: true, maxlength: 120, default: '' },
  assignedAgentEmail: { type: String, lowercase: true, trim: true, default: '' },
  assignedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rejectionReason: { type: String, trim: true, maxlength: 1000, default: '' },
  resolvedAt: { type: Date, default: null },
}, { timestamps: true });

ticketSchema.index({ organisationId: 1, ticketNumber: 1 }, { unique: true });
ticketSchema.index({ organisationId: 1, createdById: 1, createdAt: -1 });
ticketSchema.index({ organisationId: 1, assignedAgentId: 1, status: 1, createdAt: -1 });
ticketSchema.index({ organisationId: 1, status: 1, priority: 1, createdAt: -1 });
ticketSchema.index({ organisationId: 1, updatedAt: -1 });

module.exports = mongoose.model('Ticket', ticketSchema);
