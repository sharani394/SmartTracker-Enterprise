const bcrypt = require('bcryptjs');
const config = require('../config/env');
const Organisation = require('../models/Organisation');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { createNumericCode, digestSecret } = require('../utils/crypto');
const emailService = require('../services/emailService');
const publicUser = require('../utils/publicUser');
const { recordAudit } = require('../services/auditService');

function emailDomain(email) {
  return email.slice(email.lastIndexOf('@') + 1).toLowerCase();
}

function domainMatches(email, domain) {
  return emailDomain(email) === domain.toLowerCase();
}

function normalizeSkills(value) {
  if (Array.isArray(value)) return value.map((skill) => String(skill).trim()).filter(Boolean).slice(0, 30);
  if (typeof value === 'string') return value.split(',').map((skill) => skill.trim()).filter(Boolean).slice(0, 30);
  return [];
}

async function createEmailVerification(user) {
  const code = createNumericCode();
  const expiresAt = new Date(Date.now() + config.emailVerificationMinutes * 60_000);
  await require('../models/EmailVerification').findOneAndUpdate(
    { userId: user._id, purpose: 'ACCOUNT_EMAIL' },
    {
      $set: {
        email: user.email,
        codeHash: digestSecret(code),
        attempts: 0,
        expiresAt,
        consumedAt: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await emailService.sendVerificationCode({
    email: user.email,
    fullName: user.fullName,
    code,
    expiresInMinutes: config.emailVerificationMinutes,
  });
}

async function registerOrganisation(req, res) {
  const {
    organisationName, domain, ownerName, email, phone, industry, country, password,
  } = req.body;
  const normalizedDomain = String(domain).trim().toLowerCase().replace(/^@/, '').replace(/^https?:\/\//, '').replace(/\/$/, '');

  if (!domainMatches(email, normalizedDomain)) {
    throw new AppError('Owner email must use the organisation email domain.', 400, 'EMAIL_DOMAIN_MISMATCH');
  }

  let organisation;
  let user;
  try {
    organisation = await Organisation.create({
      name: organisationName,
      emailDomain: normalizedDomain,
      industry,
      country,
      status: 'PENDING_VERIFICATION',
    });

    user = await User.create({
      organisationId: organisation._id,
      fullName: ownerName,
      email,
      phone,
      passwordHash: await bcrypt.hash(password, config.bcryptRounds),
      role: 'OWNER',
      status: 'PENDING_EMAIL',
    });
    organisation.ownerUserId = user._id;
    await organisation.save();
    await createEmailVerification(user);
  } catch (error) {
    if (user) await User.deleteOne({ _id: user._id });
    if (organisation) await Organisation.deleteOne({ _id: organisation._id });
    if (error.code === 11000) {
      throw new AppError('An account or organisation with these details already exists.', 409, 'DUPLICATE_RESOURCE');
    }
    throw error;
  }

  return res.status(201).json({
    message: 'Organisation and owner account created. Check the owner email for a verification code.',
    organisation: {
      id: String(organisation._id),
      name: organisation.name,
      emailDomain: organisation.emailDomain,
      status: organisation.status,
    },
    user: publicUser(user),
    emailVerificationRequired: true,
  });
}

async function listPendingMembers(req, res) {
  const users = await User.find({
    organisationId: req.auth.organisationId,
    role: { $in: ['EMPLOYEE', 'SUPPORT_AGENT'] },
    status: 'PENDING_APPROVAL',
  }).sort({ createdAt: 1 });

  return res.json({ members: users.map(publicUser) });
}

async function reviewMember(req, res) {
  const { decision, reason = '', approvedRole } = req.body;
  if (decision === 'REJECT' && !String(reason).trim()) {
    throw new AppError('A reason is required when rejecting a registration.', 400, 'REJECTION_REASON_REQUIRED');
  }
  if (decision === 'APPROVE' && !['EMPLOYEE', 'SUPPORT_AGENT'].includes(approvedRole)) {
    throw new AppError('Choose the member role while approving the registration.', 400, 'APPROVED_ROLE_REQUIRED');
  }

  const member = await User.findOneAndUpdate({
    _id: req.params.memberId,
    organisationId: req.auth.organisationId,
    role: { $in: ['EMPLOYEE', 'SUPPORT_AGENT'] },
    status: 'PENDING_APPROVAL',
  }, {
    $set: {
      status: decision === 'APPROVE' ? 'ACTIVE' : 'REJECTED',
      ...(decision === 'APPROVE' ? { role: approvedRole } : {}),
      reviewedAt: new Date(),
      reviewedBy: req.auth.user._id,
      rejectionReason: decision === 'REJECT' ? String(reason).trim() : '',
    },
  }, { new: true, runValidators: true });

  if (!member) {
    throw new AppError('Pending member registration was not found in your organisation.', 404, 'MEMBER_NOT_FOUND');
  }

  await recordAudit(req, {
    action: decision === 'APPROVE' ? 'MEMBER_REGISTRATION_APPROVED' : 'MEMBER_REGISTRATION_REJECTED',
    targetType: 'User',
    targetId: member._id,
    metadata: { role: member.role, decision },
  });

  return res.json({
    message: decision === 'APPROVE' ? 'Member registration approved.' : 'Member registration rejected.',
    member: publicUser(member),
  });
}

module.exports = {
  registerOrganisation,
  listPendingMembers,
  reviewMember,
  createEmailVerification,
  emailDomain,
  domainMatches,
  normalizeSkills,
};
