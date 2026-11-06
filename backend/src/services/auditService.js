const AuditEvent = require('../models/AuditEvent');

async function recordAudit(req, { action, targetType, targetId = '', metadata = {} }) {
  return recordUserAudit({
    organisationId: req.auth.organisationId,
    actorId: req.auth.user._id,
    actorRole: req.auth.role,
    actorName: req.auth.user.fullName,
    ipAddress: req.ip,
    action,
    targetType,
    targetId: String(targetId || ''),
    metadata,
  });
}

async function recordUserAudit({ organisationId, actorId, actorRole, actorName = '', ipAddress = '', action, targetType, targetId = '', metadata = {} }) {
  return AuditEvent.create({
    organisationId,
    actorId,
    actorRole,
    actorName,
    action,
    targetType,
    targetId: String(targetId || ''),
    metadata,
    ipAddress: String(ipAddress || '').slice(0, 100),
  });
}

module.exports = { recordAudit, recordUserAudit };
