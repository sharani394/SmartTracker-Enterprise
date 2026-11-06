const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const config = require('../config/env');
const Organisation = require('../models/Organisation');
const User = require('../models/User');
const Session = require('../models/Session');
const Department = require('../models/Department');
const AuditEvent = require('../models/AuditEvent');
const AdminInvitation = require('../models/AdminInvitation');
const { AppError } = require('../middleware/errorHandler');
const { DELEGABLE_PERMISSIONS, hasPermission } = require('../middleware/accessControl');
const { createNumericCode, createOpaqueToken, digestSecret, safeEqual } = require('../utils/crypto');
const emailService = require('../services/emailService');
const { recordAudit, recordUserAudit } = require('../services/auditService');
const publicUser = require('../utils/publicUser');
const organisationController = require('./organisationController');

function validateDelegation(req, permissions) {
  const unique = [...new Set(permissions)];
  if (unique.some((permission) => !DELEGABLE_PERMISSIONS.includes(permission))) {
    throw new AppError('One or more delegated permissions are not supported.', 400, 'INVALID_PERMISSION');
  }
  if (unique.some((permission) => !hasPermission(req.auth, permission))) {
    throw new AppError('You cannot delegate a permission you do not hold.', 403, 'CANNOT_DELEGATE_PERMISSION');
  }
  return unique;
}

function publicDepartment(department) {
  return {
    id: String(department._id),
    name: department.name,
    description: department.description,
    status: department.status,
    createdAt: department.createdAt,
    updatedAt: department.updatedAt,
  };
}

async function getSettings(req, res) {
  const organisation = await Organisation.findById(req.auth.organisationId)
    .select('name emailDomain industry country status settings');
  if (!organisation) throw new AppError('Organisation was not found.', 404, 'ORGANISATION_NOT_FOUND');
  return res.json({
    organisation: {
      id: String(organisation._id),
      name: organisation.name,
      emailDomain: organisation.emailDomain,
      industry: organisation.industry,
      country: organisation.country,
      status: organisation.status,
      settings: organisation.settings,
    },
  });
}

async function updateSettings(req, res) {
  const organisation = await Organisation.findById(req.auth.organisationId);
  if (!organisation) throw new AppError('Organisation was not found.', 404, 'ORGANISATION_NOT_FOUND');
  const changes = {};
  for (const key of ['name', 'industry', 'country']) {
    if (req.body[key] !== undefined) {
      organisation[key] = req.body[key].trim();
      changes[key] = organisation[key];
    }
  }
  if (req.body.supportEmail !== undefined) {
    organisation.settings.supportEmail = req.body.supportEmail.trim().toLowerCase();
    changes.supportEmail = organisation.settings.supportEmail;
  }
  if (req.body.timezone !== undefined) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: req.body.timezone });
    } catch (error) {
      throw new AppError('Timezone must be a valid IANA timezone.', 400, 'INVALID_TIMEZONE');
    }
    organisation.settings.timezone = req.body.timezone;
    changes.timezone = organisation.settings.timezone;
  }
  if (req.body.memberRegistrationEnabled !== undefined) {
    organisation.settings.memberRegistrationEnabled = req.body.memberRegistrationEnabled;
    changes.memberRegistrationEnabled = req.body.memberRegistrationEnabled;
  }
  if (req.body.loginAlertsEnabled !== undefined) {
    if (req.body.loginAlertsEnabled && !emailService.isConfigured()) {
      throw new AppError('Configure SMTP email delivery before enabling sign-in alerts.', 503, 'EMAIL_NOT_CONFIGURED');
    }
    organisation.settings.loginAlertsEnabled = req.body.loginAlertsEnabled;
    changes.loginAlertsEnabled = req.body.loginAlertsEnabled;
  }
  if (!Object.keys(changes).length) {
    throw new AppError('Provide at least one organisation setting to update.', 400, 'EMPTY_UPDATE');
  }

  await organisation.save();
  await recordAudit(req, {
    action: 'ORGANISATION_SETTINGS_UPDATED',
    targetType: 'Organisation',
    targetId: organisation._id,
    metadata: { fields: Object.keys(changes), changes },
  });
  return res.json({ organisation: {
    id: String(organisation._id),
    name: organisation.name,
    emailDomain: organisation.emailDomain,
    industry: organisation.industry,
    country: organisation.country,
    status: organisation.status,
    settings: organisation.settings,
  } });
}

async function createInternalAdmin(req, res) {
  const email = req.body.email.toLowerCase();
  const organisation = await Organisation.findById(req.auth.organisationId).select('emailDomain');
  if (!organisation || organisationController.emailDomain(email) !== organisation.emailDomain) {
    throw new AppError('Internal Admin email must use this organisation’s verified email domain.', 400, 'EMAIL_DOMAIN_MISMATCH');
  }
  const permissions = validateDelegation(req, req.body.permissions || []);
  const temporaryPassword = createOpaqueToken();
  let user;
  let invitation;
  try {
    user = await User.create({
      organisationId: req.auth.organisationId,
      fullName: req.body.fullName,
      email,
      phone: req.body.phone,
      passwordHash: await bcrypt.hash(temporaryPassword, config.bcryptRounds),
      role: 'INTERNAL_ADMIN',
      status: 'PENDING_EMAIL',
      permissions,
    });

    const code = createNumericCode();
    const expiresAt = new Date(Date.now() + config.adminInvitationMinutes * 60_000);
    invitation = await AdminInvitation.create({
      organisationId: req.auth.organisationId,
      userId: user._id,
      issuedBy: req.auth.user._id,
      permissions,
      codeHash: digestSecret(code),
      expiresAt,
    });
    await emailService.sendAdminInvitation({
      email,
      fullName: user.fullName,
      code,
      expiresInMinutes: config.adminInvitationMinutes,
    });
  } catch (error) {
    if (invitation) await AdminInvitation.deleteOne({ _id: invitation._id });
    if (user) await User.deleteOne({ _id: user._id });
    if (error.code === 11000) throw new AppError('An account with this email already exists.', 409, 'DUPLICATE_ACCOUNT');
    throw error;
  }

  await recordAudit(req, {
    action: 'INTERNAL_ADMIN_INVITED',
    targetType: 'User',
    targetId: user._id,
    metadata: { email: user.email, permissions },
  });
  return res.status(201).json({
    message: 'Internal Admin invitation sent. The invitee must set a password using the emailed code.',
    user: publicUser(user),
    invitationExpiresAt: invitation.expiresAt,
  });
}

async function acceptInternalAdminInvitation(req, res) {
  const email = req.body.email.toLowerCase();
  const user = await User.findOne({ email, role: 'INTERNAL_ADMIN', status: 'PENDING_EMAIL' });
  const now = new Date();
  const invitation = user && await AdminInvitation.findOne({
    userId: user._id,
    organisationId: user.organisationId,
    consumedAt: null,
    revokedAt: null,
    expiresAt: { $gt: now },
    attempts: { $lt: 5 },
  }).select('+codeHash');

  if (!user || !invitation || !safeEqual(digestSecret(req.body.code), invitation.codeHash)) {
    if (invitation) {
      await AdminInvitation.updateOne(
        { _id: invitation._id, attempts: { $lt: 5 }, consumedAt: null },
        { $inc: { attempts: 1 } }
      );
    }
    throw new AppError('Invitation code is invalid or expired.', 400, 'INVALID_INVITATION_CODE');
  }

  const consumed = await AdminInvitation.findOneAndUpdate({
    _id: invitation._id,
    codeHash: invitation.codeHash,
    consumedAt: null,
    revokedAt: null,
    expiresAt: { $gt: now },
    attempts: { $lt: 5 },
  }, { $set: { consumedAt: now } }, { new: true });
  if (!consumed) throw new AppError('Invitation code is invalid or expired.', 400, 'INVALID_INVITATION_CODE');

  const organisation = await Organisation.findOne({ _id: user.organisationId, status: 'ACTIVE' });
  if (!organisation || String(invitation.organisationId) !== String(user.organisationId)) {
    throw new AppError('Organisation is not active.', 403, 'ORGANISATION_INACTIVE');
  }
  user.passwordHash = await bcrypt.hash(req.body.password, config.bcryptRounds);
  user.emailVerifiedAt = now;
  user.status = 'ACTIVE';
  user.permissions = invitation.permissions;
  await user.save();
  await recordUserAudit({
    organisationId: user.organisationId,
    actorId: user._id,
    actorRole: user.role,
    actorName: user.fullName,
    action: 'INTERNAL_ADMIN_INVITATION_ACCEPTED',
    targetType: 'User',
    targetId: user._id,
    metadata: { permissions: user.permissions },
  });

  return res.json({ message: 'Internal Admin account activated. You can now sign in.', user: publicUser(user) });
}

async function listInternalAdmins(req, res) {
  const users = await User.find({
    organisationId: req.auth.organisationId,
    role: 'INTERNAL_ADMIN',
  }).sort({ createdAt: -1 });
  return res.json({ internalAdmins: users.map(publicUser) });
}

async function getPrimaryAdmin(req, res) {
  const user = await User.findOne({
    organisationId: req.auth.organisationId,
    role: 'PRIMARY_ADMIN',
  }).select('_id fullName email status createdAt');
  res.set('Cache-Control', 'no-store');
  return res.json({
    primaryAdmin: user ? {
      id: String(user._id),
      fullName: user.fullName,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
    } : null,
  });
}

async function updateInternalAdminPermissions(req, res) {
  const user = await User.findOne({
    _id: req.params.adminId,
    organisationId: req.auth.organisationId,
    role: 'INTERNAL_ADMIN',
  });
  if (!user) throw new AppError('Internal Admin was not found in your organisation.', 404, 'INTERNAL_ADMIN_NOT_FOUND');
  const permissions = validateDelegation(req, req.body.permissions);
  const previous = user.permissions;
  user.permissions = permissions;
  await user.save();
  await recordAudit(req, {
    action: 'INTERNAL_ADMIN_PERMISSIONS_UPDATED',
    targetType: 'User',
    targetId: user._id,
    metadata: { previousPermissions: previous, permissions },
  });
  return res.json({ internalAdmin: publicUser(user) });
}

async function updateInternalAdminStatus(req, res) {
  const user = await User.findOne({
    _id: req.params.adminId,
    organisationId: req.auth.organisationId,
    role: 'INTERNAL_ADMIN',
  });
  if (!user) throw new AppError('Internal Admin was not found in your organisation.', 404, 'INTERNAL_ADMIN_NOT_FOUND');
  const status = req.body.status;
  if (status === 'ACTIVE' && !user.emailVerifiedAt) {
    throw new AppError('An Internal Admin must accept the email invitation before activation.', 409, 'INVITATION_NOT_ACCEPTED');
  }
  const previousStatus = user.status;
  user.status = status;
  await user.save();
  if (status === 'SUSPENDED') {
    await Session.updateMany({ userId: user._id, organisationId: req.auth.organisationId, revokedAt: null }, {
      $set: { revokedAt: new Date(), refreshTokenHash: `revoked:${crypto.randomUUID()}` },
    });
  }
  await recordAudit(req, {
    action: status === 'SUSPENDED' ? 'INTERNAL_ADMIN_DEACTIVATED' : 'INTERNAL_ADMIN_ACTIVATED',
    targetType: 'User',
    targetId: user._id,
    metadata: { previousStatus, status },
  });
  return res.json({ internalAdmin: publicUser(user) });
}

async function listUsers(req, res) {
  const canReadUsers = hasPermission(req.auth, 'users:read');
  const canReadAgents = hasPermission(req.auth, 'agents:read');
  const requestedRole = req.query.role;
  if (requestedRole === 'EMPLOYEE' && !canReadUsers) throw new AppError('Employee read permission is required.', 403, 'FORBIDDEN');
  if (requestedRole === 'SUPPORT_AGENT' && !canReadAgents) throw new AppError('Support Agent read permission is required.', 403, 'FORBIDDEN');

  let roles;
  if (requestedRole) roles = [requestedRole];
  else roles = [
    ...(canReadUsers ? ['EMPLOYEE'] : []),
    ...(canReadAgents ? ['SUPPORT_AGENT'] : []),
  ];
  const filter = { organisationId: req.auth.organisationId, role: { $in: roles } };
  if (req.query.status) filter.status = req.query.status;
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(200);
  return res.json({ users: users.map(publicUser) });
}

async function updateUserStatus(req, res) {
  const user = await User.findOne({
    _id: req.params.userId,
    organisationId: req.auth.organisationId,
    role: { $in: ['EMPLOYEE', 'SUPPORT_AGENT'] },
  });
  if (!user) throw new AppError('Employee or Support Agent was not found in your organisation.', 404, 'USER_NOT_FOUND');

  const permission = user.role === 'SUPPORT_AGENT' ? 'agents:manage' : 'users:manage';
  if (!hasPermission(req.auth, permission)) {
    throw new AppError(`The ${permission} permission is required.`, 403, 'FORBIDDEN');
  }
  if (user.status !== 'ACTIVE' && user.status !== 'SUSPENDED') {
    throw new AppError('Only an approved, verified account can be activated or deactivated here.', 409, 'INVALID_ACCOUNT_STATE');
  }
  if (req.body.status === 'ACTIVE' && !user.emailVerifiedAt) {
    throw new AppError('User must verify their email before activation.', 409, 'EMAIL_NOT_VERIFIED');
  }

  const previousStatus = user.status;
  user.status = req.body.status;
  await user.save();
  if (user.status === 'SUSPENDED') {
    await Session.updateMany({ userId: user._id, organisationId: req.auth.organisationId, revokedAt: null }, {
      $set: { revokedAt: new Date(), refreshTokenHash: `revoked:${crypto.randomUUID()}` },
    });
  }
  await recordAudit(req, {
    action: user.role === 'SUPPORT_AGENT'
      ? (user.status === 'ACTIVE' ? 'SUPPORT_AGENT_ACTIVATED' : 'SUPPORT_AGENT_DEACTIVATED')
      : (user.status === 'ACTIVE' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED'),
    targetType: 'User',
    targetId: user._id,
    metadata: { role: user.role, previousStatus, status: user.status },
  });
  return res.json({ user: publicUser(user) });
}

async function createDepartment(req, res) {
  const name = req.body.name.trim();
  const department = await Department.create({
    organisationId: req.auth.organisationId,
    name,
    nameKey: name.toLocaleLowerCase(),
    description: req.body.description || '',
    createdBy: req.auth.user._id,
    updatedBy: req.auth.user._id,
  });
  await recordAudit(req, {
    action: 'DEPARTMENT_CREATED',
    targetType: 'Department',
    targetId: department._id,
    metadata: { name: department.name },
  });
  return res.status(201).json({ department: publicDepartment(department) });
}

async function listDepartments(req, res) {
  const filter = { organisationId: req.auth.organisationId };
  if (req.query.status && req.query.status !== 'ALL') filter.status = req.query.status;
  else if (!req.query.status) filter.status = 'ACTIVE';
  const departments = await Department.find(filter).sort({ nameKey: 1 });
  return res.json({ departments: departments.map(publicDepartment) });
}

async function updateDepartment(req, res) {
  const department = await Department.findOne({
    _id: req.params.departmentId,
    organisationId: req.auth.organisationId,
  });
  if (!department) throw new AppError('Department was not found in your organisation.', 404, 'DEPARTMENT_NOT_FOUND');
  const changes = {};
  if (req.body.name !== undefined) {
    department.name = req.body.name.trim();
    department.nameKey = department.name.toLocaleLowerCase();
    changes.name = department.name;
  }
  if (req.body.description !== undefined) {
    department.description = req.body.description.trim();
    changes.description = department.description;
  }
  if (req.body.status !== undefined) {
    department.status = req.body.status;
    changes.status = department.status;
  }
  if (!Object.keys(changes).length) throw new AppError('Provide at least one department field to update.', 400, 'EMPTY_UPDATE');
  department.updatedBy = req.auth.user._id;
  await department.save();
  await recordAudit(req, {
    action: changes.status === 'INACTIVE' ? 'DEPARTMENT_DEACTIVATED' : 'DEPARTMENT_UPDATED',
    targetType: 'Department',
    targetId: department._id,
    metadata: changes,
  });
  return res.json({ department: publicDepartment(department) });
}

async function listAuditEvents(req, res) {
  const limit = Math.min(Number.parseInt(req.query.limit || '50', 10), 100);
  const filter = { organisationId: req.auth.organisationId };
  const createdAt = {};
  if (req.query.from) createdAt.$gte = new Date(req.query.from);
  if (req.query.to) createdAt.$lte = new Date(req.query.to);
  if (createdAt.$gte && createdAt.$lte && createdAt.$gte > createdAt.$lte) {
    throw new AppError('from must be earlier than or equal to to.', 400, 'INVALID_DATE_RANGE');
  }
  if (req.query.before) createdAt.$lt = new Date(req.query.before);
  if (Object.keys(createdAt).length) filter.createdAt = createdAt;
  if (req.query.action) filter.action = req.query.action;
  if (req.query.targetType) filter.targetType = req.query.targetType;
  if (req.query.actorId) filter.actorId = req.query.actorId;
  const clauses = [];
  const category = String(req.query.category || '').toLowerCase();
  const categoryRules = {
    ticket: { targetType: 'Ticket' },
    user: { targetType: 'User' },
    admin: { action: /^(INTERNAL_ADMIN|PRIMARY_ADMIN)/ },
    administrator: { action: /^(INTERNAL_ADMIN|PRIMARY_ADMIN)/ },
    access: { action: /^(MEMBER_REGISTRATION_|USER_|SUPPORT_AGENT_)/ },
    organisation: { targetType: { $in: ['Organisation', 'Department'] } },
    organization: { targetType: { $in: ['Organisation', 'Department'] } },
    security: { action: /(PASSWORD|SESSION|SECURITY|CODE_ISSUED|REPLACED)/ },
  };
  if (category) {
    const rule = categoryRules[category];
    if (!rule) throw new AppError('Audit category is invalid.', 400, 'INVALID_CATEGORY');
    clauses.push(rule);
  }
  if (req.query.q) {
    const term = String(req.query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(term, 'i');
    clauses.push({ $or: [
      { actorName: expression }, { actorRole: expression }, { action: expression },
      { targetType: expression }, { targetId: expression },
      { 'metadata.title': expression }, { 'metadata.category': expression }, { 'metadata.ticketNumber': expression },
    ] });
  }
  if (clauses.length) filter.$and = clauses;
  const events = await AuditEvent.find(filter).sort({ createdAt: -1 }).limit(limit + 1);
  const hasMore = events.length > limit;
  if (hasMore) events.pop();
  return res.json({
    events: events.map((event) => ({
      id: String(event._id),
      actorId: String(event.actorId),
      actorRole: event.actorRole,
      actorName: event.actorName,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      metadata: event.metadata,
      ipAddress: event.ipAddress,
      createdAt: event.createdAt,
    })),
    nextBefore: hasMore ? events.at(-1).createdAt : null,
  });
}

module.exports = {
  getSettings,
  updateSettings,
  createInternalAdmin,
  acceptInternalAdminInvitation,
  listInternalAdmins,
  getPrimaryAdmin,
  updateInternalAdminPermissions,
  updateInternalAdminStatus,
  listUsers,
  updateUserStatus,
  createDepartment,
  listDepartments,
  updateDepartment,
  listAuditEvents,
};
