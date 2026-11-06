const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const Organisation = require('../models/Organisation');
const User = require('../models/User');
const Session = require('../models/Session');
const EmailVerification = require('../models/EmailVerification');
const PrimaryAdminCode = require('../models/PrimaryAdminCode');
const { AppError } = require('../middleware/errorHandler');
const emailService = require('../services/emailService');
const publicUser = require('../utils/publicUser');
const { createNumericCode, createOpaqueToken, digestSecret, safeEqual } = require('../utils/crypto');
const organisationController = require('./organisationController');
const { recordAudit, recordUserAudit } = require('../services/auditService');

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function createAccessToken(userId, sessionId) {
  return jwt.sign({ sid: String(sessionId) }, config.jwtSecret, {
    algorithm: 'HS256',
    subject: String(userId),
    expiresIn: config.accessTokenTtl,
  });
}

async function makeSession(user, req) {
  const refreshToken = createOpaqueToken();
  const expiresAt = addDays(new Date(), config.refreshTokenDays);
  const session = await Session.create({
    userId: user._id,
    organisationId: user.organisationId,
    refreshTokenHash: digestSecret(refreshToken),
    expiresAt,
    userAgent: String(req.get('user-agent') || '').slice(0, 500),
    ipAddress: String(req.ip || '').slice(0, 100),
  });
  return {
    accessToken: createAccessToken(user._id, session._id),
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: config.accessTokenTtl,
    sessionId: String(session._id),
    refreshExpiresAt: expiresAt,
  };
}

function accountUnavailable(user) {
  if (!user.emailVerifiedAt || user.status === 'PENDING_EMAIL') {
    throw new AppError('Verify your company email before signing in.', 403, 'EMAIL_NOT_VERIFIED');
  }
  if (user.status === 'PENDING_APPROVAL') {
    throw new AppError('Your registration is awaiting organisation administrator approval.', 403, 'PENDING_APPROVAL');
  }
  if (user.status === 'REJECTED') {
    throw new AppError('Your registration was rejected. Contact your organisation administrator.', 403, 'REGISTRATION_REJECTED');
  }
  if (user.status !== 'ACTIVE') {
    throw new AppError('This account is not active.', 403, 'ACCOUNT_INACTIVE');
  }
}

async function login(req, res) {
  const email = req.body.email.toLowerCase();
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }
  accountUnavailable(user);

  const organisation = await Organisation.findById(user.organisationId);
  if (!organisation || organisation.status !== 'ACTIVE') {
    throw new AppError('This organisation is not active.', 403, 'ORGANISATION_INACTIVE');
  }

  const session = await makeSession(user, req);
  res.set('Cache-Control', 'no-store');
  return res.json({ user: publicUser(user), session });
}

async function refreshSession(req, res) {
  const oldTokenHash = digestSecret(req.body.refreshToken);
  const oldHashBuffer = Buffer.from(oldTokenHash);
  const tokenBytes = Buffer.from(req.body.refreshToken);
  if (tokenBytes.length < 48) {
    throw new AppError('Refresh token is invalid or expired.', 401, 'INVALID_REFRESH_TOKEN');
  }

  const session = await Session.findOne({
    refreshTokenHash: oldTokenHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).select('+refreshTokenHash');
  if (!session || !crypto.timingSafeEqual(oldHashBuffer, Buffer.from(session.refreshTokenHash))) {
    throw new AppError('Refresh token is invalid or expired.', 401, 'INVALID_REFRESH_TOKEN');
  }

  const user = await User.findById(session.userId);
  const organisation = user ? await Organisation.findById(user.organisationId) : null;
  if (!user || !organisation || String(session.organisationId) !== String(user.organisationId)) {
    await Session.updateOne({ _id: session._id }, { $set: { revokedAt: new Date() } });
    throw new AppError('Session is no longer active.', 401, 'SESSION_REVOKED');
  }
  accountUnavailable(user);
  if (organisation.status !== 'ACTIVE') {
    throw new AppError('This organisation is not active.', 403, 'ORGANISATION_INACTIVE');
  }

  const nextRefreshToken = createOpaqueToken();
  const nextExpiry = addDays(new Date(), config.refreshTokenDays);
  const rotated = await Session.findOneAndUpdate({
    _id: session._id,
    refreshTokenHash: oldTokenHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }, {
    $set: { refreshTokenHash: digestSecret(nextRefreshToken), expiresAt: nextExpiry },
  }, { new: true });
  if (!rotated) throw new AppError('Refresh token has already been used.', 401, 'REFRESH_TOKEN_REUSED');

  res.set('Cache-Control', 'no-store');
  return res.json({
    user: publicUser(user),
    session: {
      accessToken: createAccessToken(user._id, rotated._id),
      refreshToken: nextRefreshToken,
      tokenType: 'Bearer',
      expiresIn: config.accessTokenTtl,
      sessionId: String(rotated._id),
      refreshExpiresAt: nextExpiry,
    },
  });
}

async function logout(req, res) {
  await Session.updateOne({
    _id: req.auth.sessionId,
    userId: req.auth.user._id,
    organisationId: req.auth.organisationId,
    revokedAt: null,
  }, { $set: { revokedAt: new Date(), refreshTokenHash: `revoked:${crypto.randomUUID()}` } });
  return res.json({ message: 'Signed out.' });
}

async function confirmEmail(req, res) {
  const email = req.body.email.toLowerCase();
  const code = req.body.code;
  const now = new Date();
  const verification = await EmailVerification.findOne({
    email,
    purpose: 'ACCOUNT_EMAIL',
    consumedAt: null,
    expiresAt: { $gt: now },
    attempts: { $lt: 5 },
  }).select('+codeHash');

  if (!verification || !safeEqual(digestSecret(code), verification.codeHash)) {
    if (verification) {
      await EmailVerification.updateOne(
        { _id: verification._id, attempts: { $lt: 5 }, consumedAt: null },
        { $inc: { attempts: 1 } }
      );
    }
    throw new AppError('Verification code is invalid or expired.', 400, 'INVALID_VERIFICATION_CODE');
  }

  const consumed = await EmailVerification.findOneAndUpdate({
    _id: verification._id,
    codeHash: verification.codeHash,
    consumedAt: null,
    expiresAt: { $gt: now },
    attempts: { $lt: 5 },
  }, { $set: { consumedAt: now } }, { new: true });
  if (!consumed) throw new AppError('Verification code is invalid or expired.', 400, 'INVALID_VERIFICATION_CODE');

  const user = await User.findOne({ _id: verification.userId, email, status: 'PENDING_EMAIL' });
  if (!user) throw new AppError('Account is not awaiting email verification.', 409, 'INVALID_ACCOUNT_STATE');

  user.emailVerifiedAt = now;
  if (user.role === 'OWNER' || user.role === 'PRIMARY_ADMIN') user.status = 'ACTIVE';
  else user.status = 'PENDING_APPROVAL';
  await user.save();

  if (user.role === 'OWNER') {
    await Organisation.updateOne(
      { _id: user.organisationId, ownerUserId: user._id, status: 'PENDING_VERIFICATION' },
      { $set: { status: 'ACTIVE' } }
    );
  }
  if (user.role === 'PRIMARY_ADMIN') {
    await recordUserAudit({
      organisationId: user.organisationId,
      actorId: user._id,
      actorRole: user.role,
      actorName: user.fullName,
      action: 'PRIMARY_ADMIN_ACCOUNT_ACTIVATED',
      targetType: 'User',
      targetId: user._id,
      metadata: { email: user.email },
    });
  }

  return res.json({
    message: user.status === 'PENDING_APPROVAL'
      ? 'Email verified. Your registration is awaiting administrator approval.'
      : 'Email verified. You can now sign in.',
    user: publicUser(user),
  });
}

async function resendVerification(req, res) {
  const user = await User.findOne({ email: req.body.email.toLowerCase(), status: 'PENDING_EMAIL' });
  if (user) {
    try {
      await organisationController.createEmailVerification(user);
    } catch (error) {
      console.error(`Verification email delivery failed for user ${user._id}: ${error.message}`);
    }
  }
  return res.status(202).json({ message: 'If the account requires verification, a new code will be sent to its company email.' });
}

async function registerMember(req, res) {
  const {
    organisationName, email, fullName, phone, employeeId, accountType,
    department, jobTitle, experience, skills, password,
  } = req.body;
  const emailDomain = organisationController.emailDomain(email);
  const organisation = await Organisation.findOne({ emailDomain, status: 'ACTIVE' });
  if (!organisation || organisation.name.toLowerCase() !== organisationName.trim().toLowerCase()) {
    throw new AppError('Organisation could not be verified for this company email.', 400, 'ORGANISATION_NOT_VERIFIED');
  }
  if (!organisation.settings?.memberRegistrationEnabled) {
    throw new AppError('Member self-registration is disabled for this organisation.', 403, 'REGISTRATION_DISABLED');
  }

  const requestedRole = accountType === 'Support Agent' ? 'SUPPORT_AGENT' : 'EMPLOYEE';
  let user;
  try {
    user = await User.create({
      organisationId: organisation._id,
      fullName,
      email,
      phone,
      passwordHash: await bcrypt.hash(password, config.bcryptRounds),
      role: 'EMPLOYEE',
      requestedRole,
      status: 'PENDING_EMAIL',
      employeeId: employeeId || '',
      department,
      jobTitle,
      experience,
      skills: organisationController.normalizeSkills(skills),
    });
  } catch (error) {
    if (error.code === 11000) throw new AppError('An account with this email already exists.', 409, 'DUPLICATE_ACCOUNT');
    throw error;
  }

  await organisationController.createEmailVerification(user);
  res.set('Cache-Control', 'no-store');
  return res.status(201).json({
    message: 'Registration submitted. Verify your company email before administrator review.',
    user: publicUser(user),
    emailVerificationRequired: true,
  });
}

async function issuePrimaryAdminCode(req, res) {
  const currentAdmin = await User.findOne({
    organisationId: req.auth.organisationId,
    role: 'PRIMARY_ADMIN',
  });
  const replacing = req.body.replaceCurrent === true;
  if (currentAdmin && !replacing) {
    throw new AppError('A Primary Admin account already exists. Confirm the Owner password to replace it.', 409, 'PRIMARY_ADMIN_EXISTS');
  }
  if (!currentAdmin && replacing) {
    throw new AppError('There is no current Primary Admin to replace.', 409, 'PRIMARY_ADMIN_NOT_FOUND');
  }
  if (currentAdmin) {
    const owner = await User.findById(req.auth.user._id).select('+passwordHash');
    if (!req.body.currentPassword || !(await bcrypt.compare(req.body.currentPassword, owner.passwordHash))) {
      throw new AppError('Owner password confirmation failed.', 401, 'OWNER_REAUTHENTICATION_FAILED');
    }
  }

  const code = createNumericCode();
  const expiresAt = new Date(Date.now() + config.primaryAdminCodeMinutes * 60_000);
  await PrimaryAdminCode.findOneAndUpdate({ organisationId: req.auth.organisationId }, {
    $set: {
      issuedBy: req.auth.user._id,
      codeHash: digestSecret(code),
      attempts: 0,
      expiresAt,
      consumedAt: null,
      revokedAt: null,
    },
  }, { upsert: true, new: true, setDefaultsOnInsert: true });

  if (currentAdmin) {
    const demoted = await User.findOneAndUpdate({
      _id: currentAdmin._id,
      organisationId: req.auth.organisationId,
      role: 'PRIMARY_ADMIN',
    }, {
      $set: { role: 'EMPLOYEE', status: 'SUSPENDED', permissions: [] },
    }, { new: true, runValidators: true });
    if (!demoted) {
      await PrimaryAdminCode.updateOne(
        { organisationId: req.auth.organisationId, consumedAt: null },
        { $set: { revokedAt: new Date() } }
      );
      throw new AppError('Primary Admin account changed during replacement. Try again.', 409, 'PRIMARY_ADMIN_CHANGED');
    }
    await Session.updateMany({
      userId: currentAdmin._id,
      organisationId: req.auth.organisationId,
      revokedAt: null,
    }, { $set: { revokedAt: new Date(), refreshTokenHash: `revoked:${crypto.randomUUID()}` } });
    await recordAudit(req, {
      action: 'PRIMARY_ADMIN_REPLACED',
      targetType: 'User',
      targetId: currentAdmin._id,
      metadata: { previousRole: 'PRIMARY_ADMIN', status: 'SUSPENDED' },
    });
  }

  await recordAudit(req, {
    action: 'PRIMARY_ADMIN_CODE_ISSUED',
    targetType: 'Organisation',
    targetId: req.auth.organisationId,
    metadata: { replacesPrimaryAdmin: Boolean(currentAdmin), expiresAt },
  });

  res.set('Cache-Control', 'no-store');
  return res.status(201).json({
    message: 'Share this one-time code with the Primary Admin applicant. It is shown only in this response.',
    code,
    expiresAt,
  });
}

async function registerPrimaryAdmin(req, res) {
  const { organisationName, fullName, email, phone, registrationCode, password } = req.body;
  const emailDomain = organisationController.emailDomain(email);
  const organisation = await Organisation.findOne({ emailDomain, status: 'ACTIVE' });
  if (!organisation || organisation.name.toLowerCase() !== organisationName.trim().toLowerCase()) {
    throw new AppError('Organisation could not be verified for this company email.', 400, 'ORGANISATION_NOT_VERIFIED');
  }
  if (await User.exists({ organisationId: organisation._id, role: 'PRIMARY_ADMIN' })) {
    throw new AppError('A Primary Admin account has already been appointed for this organisation.', 409, 'PRIMARY_ADMIN_EXISTS');
  }

  const now = new Date();
  const registration = await PrimaryAdminCode.findOne({
    organisationId: organisation._id,
    consumedAt: null,
    revokedAt: null,
    expiresAt: { $gt: now },
    attempts: { $lt: 5 },
  }).select('+codeHash');
  if (!registration || !safeEqual(digestSecret(registrationCode), registration.codeHash)) {
    if (registration) {
      await PrimaryAdminCode.updateOne(
        { _id: registration._id, attempts: { $lt: 5 }, consumedAt: null },
        { $inc: { attempts: 1 } }
      );
    }
    throw new AppError('Registration code is invalid, expired, or already used.', 400, 'INVALID_REGISTRATION_CODE');
  }

  let user;
  try {
    user = await User.create({
      organisationId: organisation._id,
      fullName,
      email,
      phone,
      passwordHash: await bcrypt.hash(password, config.bcryptRounds),
      role: 'PRIMARY_ADMIN',
      status: 'PENDING_EMAIL',
    });
  } catch (error) {
    if (error.code === 11000) throw new AppError('An account with this email already exists or the Primary Admin position is filled.', 409, 'DUPLICATE_ACCOUNT');
    throw error;
  }

  const consumed = await PrimaryAdminCode.findOneAndUpdate({
    _id: registration._id,
    codeHash: registration.codeHash,
    consumedAt: null,
    revokedAt: null,
    expiresAt: { $gt: now },
    attempts: { $lt: 5 },
  }, { $set: { consumedAt: now } }, { new: true });
  if (!consumed) {
    await User.deleteOne({ _id: user._id });
    throw new AppError('Registration code has already been used or expired.', 409, 'REGISTRATION_CODE_UNAVAILABLE');
  }

  await organisationController.createEmailVerification(user);
  return res.status(201).json({
    message: 'Primary Admin account created. Verify the company email before signing in.',
    user: publicUser(user),
    emailVerificationRequired: true,
  });
}

async function getMe(req, res) {
  const organisation = await Organisation.findById(req.auth.organisationId).select('name emailDomain industry country status');
  return res.json({ user: publicUser(req.auth.user), organisation });
}

async function updateMe(req, res) {
  const user = await User.findOneAndUpdate({
    _id: req.auth.user._id,
    organisationId: req.auth.organisationId,
  }, {
    $set: { fullName: req.body.fullName, phone: req.body.phone },
  }, { new: true, runValidators: true });
  return res.json({ user: publicUser(user) });
}

async function changePassword(req, res) {
  const user = await User.findById(req.auth.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) {
    throw new AppError('Current password is incorrect.', 400, 'CURRENT_PASSWORD_INCORRECT');
  }
  if (await bcrypt.compare(req.body.newPassword, user.passwordHash)) {
    throw new AppError('Choose a password different from the current password.', 400, 'PASSWORD_UNCHANGED');
  }

  user.passwordHash = await bcrypt.hash(req.body.newPassword, config.bcryptRounds);
  user.passwordChangedAt = new Date();
  await user.save();
  await Session.updateMany({ userId: user._id, revokedAt: null }, {
    $set: { revokedAt: new Date(), refreshTokenHash: `revoked:${crypto.randomUUID()}` },
  });
  return res.json({ message: 'Password updated. Sign in again on your devices.' });
}

async function listSessions(req, res) {
  const sessions = await Session.find({
    userId: req.auth.user._id,
    organisationId: req.auth.organisationId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 }).select('_id userAgent ipAddress createdAt expiresAt');

  return res.json({
    sessions: sessions.map((session) => ({
      id: String(session._id),
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      current: String(session._id) === String(req.auth.sessionId),
    })),
  });
}

async function revokeSession(req, res) {
  const session = await Session.findOneAndUpdate({
    _id: req.params.sessionId,
    userId: req.auth.user._id,
    organisationId: req.auth.organisationId,
    revokedAt: null,
  }, { $set: { revokedAt: new Date(), refreshTokenHash: `revoked:${crypto.randomUUID()}` } }, { new: true });
  if (!session) throw new AppError('Active session was not found.', 404, 'SESSION_NOT_FOUND');
  return res.json({ message: 'Session revoked.' });
}

module.exports = {
  login,
  refreshSession,
  logout,
  confirmEmail,
  resendVerification,
  registerMember,
  issuePrimaryAdminCode,
  registerPrimaryAdmin,
  getMe,
  updateMe,
  changePassword,
  listSessions,
  revokeSession,
};
