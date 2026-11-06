process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'phase-two-tests-use-a-local-only-random-secret';
process.env.BCRYPT_ROUNDS = '10';
process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/smarttracker_phase2_test';

const { before, beforeEach, after, test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const Organisation = require('../src/models/Organisation');
const User = require('../src/models/User');
const Session = require('../src/models/Session');
const EmailVerification = require('../src/models/EmailVerification');
const PasswordReset = require('../src/models/PasswordReset');
const PrimaryAdminCode = require('../src/models/PrimaryAdminCode');
const Department = require('../src/models/Department');
const AuditEvent = require('../src/models/AuditEvent');
const AdminInvitation = require('../src/models/AdminInvitation');
const emailService = require('../src/services/emailService');

const sentCodes = [];
const sentPasswordResetCodes = [];
const sentInvitations = [];
const sentLoginAlerts = [];
emailService.isConfigured = () => true;
emailService.sendVerificationCode = async ({ email, code }) => {
  sentCodes.push({ email, code });
};
emailService.sendLoginAlert = async (alert) => {
  sentLoginAlerts.push(alert);
};
emailService.sendPasswordResetCode = async ({ email, code }) => {
  sentPasswordResetCodes.push({ email, code });
};
emailService.sendAdminInvitation = async ({ email, code }) => {
  sentInvitations.push({ email, code });
};

let sequence = 0;
function nextLabel(prefix) {
  sequence += 1;
  return `${prefix}${sequence}`;
}

async function registerOwner(label = nextLabel('org')) {
  const domain = `${label}.example.org`;
  const email = `owner@${domain}`;
  const response = await request(app).post('/api/v1/organisations').send({
    organisationName: `Organisation ${label}`,
    domain,
    ownerName: `Owner ${label}`,
    email,
    phone: '+1 555 010 2000',
    industry: 'Technology',
    country: 'United States',
    password: 'OwnerPassword!2026',
    role: 'PRIMARY_ADMIN',
    organisationId: new mongoose.Types.ObjectId().toString(),
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const emailCode = sentCodes.at(-1).code;
  const verification = await request(app).post('/api/v1/auth/email-verification/confirm').send({ email, code: emailCode });
  assert.equal(verification.status, 200, JSON.stringify(verification.body));
  const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'OwnerPassword!2026' });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  return {
    domain,
    email,
    organisationName: response.body.organisation.name,
    owner: response.body.user,
    token: login.body.session.accessToken,
    login: login.body,
  };
}

async function registerMember({ organisationName, email, accountType = 'Employee', extra = {} }) {
  return request(app).post('/api/v1/auth/members/register').send({
    organisationName,
    email,
    fullName: 'Casey Member',
    phone: '+1 555 010 2010',
    employeeId: 'EMP-77',
    accountType,
    department: 'IT Support',
    jobTitle: 'Support Specialist',
    experience: '1–2 years',
    skills: 'Networks, Linux',
    password: 'MemberPassword!2026',
    ...extra,
  });
}

async function registerVerifiedMember(owner, localPart, accountType = 'Employee') {
  const email = `${localPart}@${owner.domain}`;
  const response = await registerMember({ organisationName: owner.organisationName, email, accountType });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const verified = await request(app).post('/api/v1/auth/email-verification/confirm')
    .send({ email, code: sentCodes.at(-1).code });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  const approval = await request(app).patch(`/api/v1/organisations/members/${response.body.user.id}/approval`)
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ decision: 'APPROVE', approvedRole: accountType === 'Support Agent' ? 'SUPPORT_AGENT' : 'EMPLOYEE' });
  assert.equal(approval.status, 200, JSON.stringify(approval.body));
  return { email, user: approval.body.member };
}

before(async () => {
  await connectDatabase();
  await Promise.all([
    Organisation.init(), User.init(), Session.init(), EmailVerification.init(), PrimaryAdminCode.init(),
    PasswordReset.init(), Department.init(), AuditEvent.init(), AdminInvitation.init(),
  ]);
});

beforeEach(async () => {
  sentCodes.length = 0;
  sentPasswordResetCodes.length = 0;
  sentInvitations.length = 0;
  sentLoginAlerts.length = 0;
  await Promise.all([
    Organisation.deleteMany({}), User.deleteMany({}), Session.deleteMany({}),
    EmailVerification.deleteMany({}), PrimaryAdminCode.deleteMany({}),
    PasswordReset.deleteMany({}),
    Department.deleteMany({}), AuditEvent.deleteMany({}), AdminInvitation.deleteMany({}),
  ]);
});

after(async () => {
  await disconnectDatabase();
});

test('organisation registration creates a hashed owner account; email verification enables sign-in', async () => {
  const domain = 'owner-flow.example.org';
  const email = `owner@${domain}`;
  const registered = await request(app).post('/api/v1/organisations').send({
    organisationName: 'Owner Flow Company', domain, ownerName: 'Morgan Owner', email,
    phone: '+1 555 010 2000', industry: 'Technology', country: 'United States',
    password: 'OwnerPassword!2026', role: 'EMPLOYEE',
    organisationId: new mongoose.Types.ObjectId().toString(),
  });

  assert.equal(registered.status, 201, JSON.stringify(registered.body));
  assert.equal(registered.body.user.role, 'OWNER');
  assert.equal(registered.body.user.status, 'PENDING_EMAIL');
  assert.equal((await request(app).post('/api/v1/auth/login').send({ email, password: 'OwnerPassword!2026' })).status, 403);

  const user = await User.findOne({ email }).select('+passwordHash');
  assert.match(user.passwordHash, /^\$2[aby]\$/);
  const organisation = await Organisation.findById(user.organisationId);
  assert.equal(organisation.status, 'PENDING_VERIFICATION');

  const verification = await request(app).post('/api/v1/auth/email-verification/confirm').send({ email, code: sentCodes[0].code });
  assert.equal(verification.status, 200);
  assert.equal(verification.body.user.status, 'ACTIVE');
  assert.equal((await Organisation.findById(user.organisationId)).status, 'ACTIVE');

  const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'OwnerPassword!2026' });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.equal(login.body.user.role, 'OWNER');
  assert.ok(login.body.session.accessToken);
  assert.ok(login.body.session.refreshToken);
  assert.equal(login.body.user.passwordHash, undefined);

  const profile = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.session.accessToken}`);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.organisation.emailDomain, domain);
});

test('owner can enable tenant sign-in alerts and successful logins email the signing-in user', async () => {
  const owner = await registerOwner();
  const ownerHeader = { Authorization: `Bearer ${owner.token}` };
  const initialSettings = await request(app).get('/api/v1/organisations/settings').set(ownerHeader);
  assert.equal(initialSettings.body.organisation.settings.loginAlertsEnabled, false);

  const enabled = await request(app).patch('/api/v1/organisations/settings')
    .set(ownerHeader).send({ loginAlertsEnabled: true });
  assert.equal(enabled.status, 200, JSON.stringify(enabled.body));
  assert.equal(enabled.body.organisation.settings.loginAlertsEnabled, true);

  const login = await request(app).post('/api/v1/auth/login')
    .set('user-agent', 'SmartTracker Demo Browser')
    .send({ email: owner.email, password: 'OwnerPassword!2026' });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.equal(sentLoginAlerts.length, 1);
  assert.equal(sentLoginAlerts[0].email, owner.email);
  assert.equal(sentLoginAlerts[0].fullName, owner.owner.fullName);
  assert.equal(sentLoginAlerts[0].organisationName, owner.organisationName);
  assert.equal(sentLoginAlerts[0].userAgent, 'SmartTracker Demo Browser');
  assert.ok(sentLoginAlerts[0].signedInAt instanceof Date);

  await request(app).patch('/api/v1/organisations/settings')
    .set(ownerHeader).send({ loginAlertsEnabled: false }).expect(200);
  await request(app).post('/api/v1/auth/login')
    .send({ email: owner.email, password: 'OwnerPassword!2026' }).expect(200);
  assert.equal(sentLoginAlerts.length, 1);
});

test('login alerts require SMTP configuration and mail failures do not block sign-in', async () => {
  const owner = await registerOwner();
  const ownerHeader = { Authorization: `Bearer ${owner.token}` };
  const configured = emailService.isConfigured;
  const originalConsoleError = console.error;
  const loggedErrors = [];
  let unavailable;
  try {
    console.error = (...args) => loggedErrors.push(args);
    emailService.isConfigured = () => false;
    unavailable = await request(app).patch('/api/v1/organisations/settings')
      .set(ownerHeader).send({ loginAlertsEnabled: true });
  } finally {
    emailService.isConfigured = configured;
    console.error = originalConsoleError;
  }
  assert.equal(unavailable.status, 503);
  assert.equal((await Organisation.findOne({ emailDomain: owner.domain })).settings.loginAlertsEnabled, false);

  await request(app).patch('/api/v1/organisations/settings')
    .set(ownerHeader).send({ loginAlertsEnabled: true }).expect(200);
  const sendLoginAlert = emailService.sendLoginAlert;
  let login;
  try {
    console.error = (...args) => loggedErrors.push(args);
    emailService.sendLoginAlert = async () => { throw new Error('SMTP unavailable'); };
    login = await request(app).post('/api/v1/auth/login')
      .send({ email: owner.email, password: 'OwnerPassword!2026' });
  } finally {
    emailService.sendLoginAlert = sendLoginAlert;
    console.error = originalConsoleError;
  }
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.ok(login.body.session.accessToken);
  assert.ok(loggedErrors.some(([message]) => message === 'New sign-in alert delivery failed.'));
});

test('refresh rotates opaque credentials; logout and password change revoke active sessions', async () => {
  const owner = await registerOwner();
  const refreshed = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: owner.login.session.refreshToken });
  assert.equal(refreshed.status, 200, JSON.stringify(refreshed.body));
  assert.notEqual(refreshed.body.session.refreshToken, owner.login.session.refreshToken);
  assert.equal((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: owner.login.session.refreshToken })).status, 401);

  const sessions = await request(app).get('/api/v1/auth/sessions').set('Authorization', `Bearer ${refreshed.body.session.accessToken}`);
  assert.equal(sessions.status, 200);
  assert.equal(sessions.body.sessions.length, 1);
  assert.equal(sessions.body.sessions[0].current, true);

  const changed = await request(app).put('/api/v1/auth/password')
    .set('Authorization', `Bearer ${refreshed.body.session.accessToken}`)
    .send({ currentPassword: 'OwnerPassword!2026', newPassword: 'OwnerPassword!2027' });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${refreshed.body.session.accessToken}`)).status, 401);

  const newLogin = await request(app).post('/api/v1/auth/login').send({ email: owner.email, password: 'OwnerPassword!2027' });
  assert.equal(newLogin.status, 200);
  const loggedOut = await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${newLogin.body.session.accessToken}`);
  assert.equal(loggedOut.status, 200);
  assert.equal((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${newLogin.body.session.accessToken}`)).status, 401);
});

test('password reset is account-safe, one-time, updates the password and revokes sessions', async () => {
  const owner = await registerOwner();
  assert.equal((await Session.find({ userId: owner.owner.id, revokedAt: null })).length, 1);

  const unknownRequest = await request(app).post('/api/v1/auth/password-reset/request')
    .send({ email: 'missing@example.org' });
  const resetRequest = await request(app).post('/api/v1/auth/password-reset/request')
    .send({ email: owner.email });
  assert.equal(unknownRequest.status, 202);
  assert.deepEqual(resetRequest.body, unknownRequest.body);
  assert.equal(sentPasswordResetCodes.length, 1);

  const resetRecord = await PasswordReset.findOne({ email: owner.email }).select('+codeHash');
  assert.notEqual(resetRecord.codeHash, sentPasswordResetCodes[0].code);

  const reset = await request(app).post('/api/v1/auth/password-reset/confirm').send({
    email: owner.email,
    code: sentPasswordResetCodes[0].code,
    password: 'OwnerPassword!2027',
  });
  assert.equal(reset.status, 200, JSON.stringify(reset.body));
  assert.equal((await Session.find({ userId: owner.owner.id, revokedAt: null })).length, 0);
  assert.equal((await request(app).get('/api/v1/auth/me')
    .set('Authorization', `Bearer ${owner.token}`)).status, 401);
  assert.equal((await request(app).post('/api/v1/auth/login')
    .send({ email: owner.email, password: 'OwnerPassword!2026' })).status, 401);
  assert.equal((await request(app).post('/api/v1/auth/login')
    .send({ email: owner.email, password: 'OwnerPassword!2027' })).status, 200);
  assert.equal((await request(app).post('/api/v1/auth/password-reset/confirm').send({
    email: owner.email,
    code: sentPasswordResetCodes[0].code,
    password: 'OwnerPassword!2028',
  })).status, 400);
});

test('password reset codes lock after five failed attempts', async () => {
  const owner = await registerOwner();
  await request(app).post('/api/v1/auth/password-reset/request').send({ email: owner.email });
  const correctCode = sentPasswordResetCodes[0].code;
  const wrongCode = correctCode === '999999' ? '000000' : '999999';

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failed = await request(app).post('/api/v1/auth/password-reset/confirm').send({
      email: owner.email,
      code: wrongCode,
      password: 'OwnerPassword!2027',
    });
    assert.equal(failed.status, 400);
  }

  const locked = await request(app).post('/api/v1/auth/password-reset/confirm').send({
    email: owner.email,
    code: correctCode,
    password: 'OwnerPassword!2027',
  });
  assert.equal(locked.status, 400);
  assert.equal((await request(app).post('/api/v1/auth/login')
    .send({ email: owner.email, password: 'OwnerPassword!2026' })).status, 200);
});

test('member role is assigned only during admin approval; unauthorized users cannot administer accounts', async () => {
  const owner = await registerOwner();
  const email = `agent@${owner.domain}`;
  const registered = await registerMember({
    organisationName: owner.organisationName, email, accountType: 'Support Agent',
    extra: { role: 'OWNER', organisationId: new mongoose.Types.ObjectId().toString() },
  });
  assert.equal(registered.status, 201, JSON.stringify(registered.body));
  assert.equal(registered.body.user.role, 'EMPLOYEE');
  assert.equal(registered.body.user.requestedRole, 'SUPPORT_AGENT');
  assert.notEqual(registered.body.user.organisationId, '');

  const memberCode = sentCodes.at(-1).code;
  const verified = await request(app).post('/api/v1/auth/email-verification/confirm').send({ email, code: memberCode });
  assert.equal(verified.status, 200);
  assert.equal(verified.body.user.status, 'PENDING_APPROVAL');
  assert.equal((await request(app).post('/api/v1/auth/login').send({ email, password: 'MemberPassword!2026' })).status, 403);

  const ownerHeader = { Authorization: `Bearer ${owner.token}` };
  const pending = await request(app).get('/api/v1/organisations/members').set(ownerHeader);
  assert.equal(pending.status, 200);
  assert.equal(pending.body.members.length, 1);
  assert.equal(pending.body.members[0].requestedRole, 'SUPPORT_AGENT');
  const approval = await request(app).patch(`/api/v1/organisations/members/${registered.body.user.id}/approval`)
    .set(ownerHeader).send({ decision: 'APPROVE', approvedRole: 'SUPPORT_AGENT' });
  assert.equal(approval.status, 200, JSON.stringify(approval.body));
  assert.equal(approval.body.member.role, 'SUPPORT_AGENT');

  const memberLogin = await request(app).post('/api/v1/auth/login').send({ email, password: 'MemberPassword!2026' });
  assert.equal(memberLogin.status, 200);
  assert.equal(memberLogin.body.user.role, 'SUPPORT_AGENT');
  const forbidden = await request(app).post('/api/v1/auth/primary-admin-codes')
    .set('Authorization', `Bearer ${memberLogin.body.session.accessToken}`);
  assert.equal(forbidden.status, 403);
});

test('member review and lists are scoped to the authenticated organisation', async () => {
  const ownerA = await registerOwner();
  const ownerB = await registerOwner();
  const emailB = `member@${ownerB.domain}`;
  const memberB = await registerMember({ organisationName: ownerB.organisationName, email: emailB });
  assert.equal(memberB.status, 201, JSON.stringify(memberB.body));
  await request(app).post('/api/v1/auth/email-verification/confirm').send({ email: emailB, code: sentCodes.at(-1).code }).expect(200);

  const crossTenantReview = await request(app).patch(`/api/v1/organisations/members/${memberB.body.user.id}/approval`)
    .set('Authorization', `Bearer ${ownerA.token}`)
    .send({ decision: 'APPROVE', approvedRole: 'EMPLOYEE' });
  assert.equal(crossTenantReview.status, 404);

  const listA = await request(app).get('/api/v1/organisations/members').set('Authorization', `Bearer ${ownerA.token}`);
  assert.deepEqual(listA.body.members, []);
  const listB = await request(app).get('/api/v1/organisations/members').set('Authorization', `Bearer ${ownerB.token}`);
  assert.equal(listB.body.members.length, 1);
});

test('Primary Admin registration codes are one-time, expire, and cannot be generated by another role', async () => {
  const owner = await registerOwner();
  const ownerHeader = { Authorization: `Bearer ${owner.token}` };
  const firstCode = await request(app).post('/api/v1/auth/primary-admin-codes').set(ownerHeader);
  assert.equal(firstCode.status, 201);
  const firstStored = await PrimaryAdminCode.findOne({}).select('+codeHash');
  assert.notEqual(firstStored.codeHash, firstCode.body.code);

  const secondCode = await request(app).post('/api/v1/auth/primary-admin-codes').set(ownerHeader);
  assert.equal(secondCode.status, 201);
  await PrimaryAdminCode.updateOne({ _id: firstStored._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const adminBody = {
    organisationName: owner.organisationName, fullName: 'Primary Admin', email: `admin@${owner.domain}`,
    phone: '+1 555 010 2020', registrationCode: secondCode.body.code, password: 'AdminPassword!2026',
  };

  const expiredCodeAttempt = await request(app).post('/api/v1/auth/primary-admin/register')
    .send({ ...adminBody, email: `expired-admin@${owner.domain}` });
  assert.equal(expiredCodeAttempt.status, 400);
  const thirdCode = await request(app).post('/api/v1/auth/primary-admin-codes').set(ownerHeader);
  assert.equal(thirdCode.status, 201);
  const replacedCodeAttempt = await request(app).post('/api/v1/auth/primary-admin/register')
    .send({ ...adminBody, registrationCode: secondCode.body.code, email: `old-admin@${owner.domain}` });
  assert.equal(replacedCodeAttempt.status, 400);
  adminBody.registrationCode = thirdCode.body.code;
  const registered = await request(app).post('/api/v1/auth/primary-admin/register').send(adminBody);
  assert.equal(registered.status, 201, JSON.stringify(registered.body));
  assert.equal(registered.body.user.role, 'PRIMARY_ADMIN');

  const emailCode = sentCodes.at(-1).code;
  const verified = await request(app).post('/api/v1/auth/email-verification/confirm')
    .send({ email: adminBody.email, code: emailCode });
  assert.equal(verified.status, 200);
  assert.equal(verified.body.user.status, 'ACTIVE');
  const consumedCode = await PrimaryAdminCode.findOne({ organisationId: owner.owner.organisationId });
  assert.ok(consumedCode.consumedAt instanceof Date);
  const adminLogin = await request(app).post('/api/v1/auth/login')
    .send({ email: adminBody.email, password: 'AdminPassword!2026' });
  assert.equal(adminLogin.status, 200);
  assert.equal(adminLogin.body.user.role, 'PRIMARY_ADMIN');
  assert.equal((await request(app).post('/api/v1/auth/primary-admin-codes').set(ownerHeader)).status, 409);

  const org = await Organisation.findById(owner.owner.organisationId);
  const admin = await User.findOne({ email: adminBody.email });
  assert.equal(String(admin.organisationId), String(org._id));
});

test('an organisation administrator can reject a verified member and rejection prevents login', async () => {
  const owner = await registerOwner();
  const email = `declined@${owner.domain}`;
  const member = await registerMember({ organisationName: owner.organisationName, email });
  assert.equal(member.status, 201);
  await request(app).post('/api/v1/auth/email-verification/confirm')
    .send({ email, code: sentCodes.at(-1).code }).expect(200);

  const ownerHeader = { Authorization: `Bearer ${owner.token}` };
  const missingReason = await request(app).patch(`/api/v1/organisations/members/${member.body.user.id}/approval`)
    .set(ownerHeader).send({ decision: 'REJECT' });
  assert.equal(missingReason.status, 400);

  const rejected = await request(app).patch(`/api/v1/organisations/members/${member.body.user.id}/approval`)
    .set(ownerHeader).send({ decision: 'REJECT', reason: 'The submitted department could not be verified.' });
  assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
  assert.equal(rejected.body.member.status, 'REJECTED');
  const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'MemberPassword!2026' });
  assert.equal(login.status, 403);
  assert.equal(login.body.error.code, 'REGISTRATION_REJECTED');
});

test('protected routes reject missing and invalid bearer tokens; validation errors use the common shape', async () => {
  const noToken = await request(app).get('/api/v1/auth/me');
  assert.equal(noToken.status, 401);
  assert.equal(noToken.body.error.code, 'UNAUTHENTICATED');

  const invalidBody = await request(app).post('/api/v1/auth/email-verification/confirm').send({ email: 'not-an-email', code: '12' });
  assert.equal(invalidBody.status, 400);
  assert.equal(invalidBody.body.error.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(invalidBody.body.error.details));
});

test('Swagger UI and OpenAPI document every implemented endpoint and bearer authentication', async () => {
  const specResponse = await request(app).get('/openapi.json');
  assert.equal(specResponse.status, 200);
  const spec = specResponse.body;
  assert.equal(spec.openapi, '3.0.3');
  assert.ok(spec.components.securitySchemes.bearerAuth);
  const expectedRoutes = [
    '/api/v1/organisations',
    '/api/v1/organisations/members',
    '/api/v1/organisations/members/{memberId}/approval',
    '/api/v1/organisations/settings',
    '/api/v1/organisations/internal-admins',
    '/api/v1/organisations/primary-admin',
    '/api/v1/organisations/internal-admins/{adminId}/permissions',
    '/api/v1/organisations/internal-admins/{adminId}/status',
    '/api/v1/organisations/users',
    '/api/v1/organisations/users/{userId}/status',
    '/api/v1/organisations/departments',
    '/api/v1/organisations/departments/{departmentId}',
    '/api/v1/organisations/audit-events',
    '/api/v1/auth/login',
    '/api/v1/auth/refresh',
    '/api/v1/auth/logout',
    '/api/v1/auth/email-verification/confirm',
    '/api/v1/auth/email-verification/resend',
    '/api/v1/auth/password-reset/request',
    '/api/v1/auth/password-reset/confirm',
    '/api/v1/auth/internal-admin-invitations/accept',
    '/api/v1/auth/primary-admin-codes',
    '/api/v1/auth/primary-admin/register',
    '/api/v1/auth/members/register',
    '/api/v1/auth/me',
    '/api/v1/auth/password',
    '/api/v1/auth/sessions',
    '/api/v1/auth/sessions/{sessionId}',
  ];
  for (const route of expectedRoutes) assert.ok(spec.paths[route], `Missing OpenAPI path ${route}`);
  const expectedMethods = {
    '/api/v1/health': ['get'],
    '/api/v1/organisations': ['post'],
    '/api/v1/organisations/settings': ['get', 'patch'],
    '/api/v1/organisations/members': ['get'],
    '/api/v1/organisations/members/{memberId}/approval': ['patch'],
    '/api/v1/organisations/internal-admins': ['get', 'post'],
    '/api/v1/organisations/primary-admin': ['get'],
    '/api/v1/organisations/internal-admins/{adminId}/permissions': ['patch'],
    '/api/v1/organisations/internal-admins/{adminId}/status': ['patch'],
    '/api/v1/organisations/users': ['get'],
    '/api/v1/organisations/users/{userId}/status': ['patch'],
    '/api/v1/organisations/departments': ['get', 'post'],
    '/api/v1/organisations/departments/{departmentId}': ['patch'],
    '/api/v1/organisations/audit-events': ['get'],
    '/api/v1/auth/login': ['post'],
    '/api/v1/auth/refresh': ['post'],
    '/api/v1/auth/logout': ['post'],
    '/api/v1/auth/email-verification/confirm': ['post'],
    '/api/v1/auth/email-verification/resend': ['post'],
    '/api/v1/auth/password-reset/request': ['post'],
    '/api/v1/auth/password-reset/confirm': ['post'],
    '/api/v1/auth/internal-admin-invitations/accept': ['post'],
    '/api/v1/auth/primary-admin-codes': ['post'],
    '/api/v1/auth/primary-admin/register': ['post'],
    '/api/v1/auth/members/register': ['post'],
    '/api/v1/auth/me': ['get', 'patch'],
    '/api/v1/auth/password': ['put'],
    '/api/v1/auth/sessions': ['get'],
    '/api/v1/auth/sessions/{sessionId}': ['delete'],
  };
  for (const [route, methods] of Object.entries(expectedMethods)) {
    for (const method of methods) assert.ok(spec.paths[route][method], `Missing ${method.toUpperCase()} ${route}`);
  }
  const docs = await request(app).get('/api-docs/');
  assert.equal(docs.status, 200);
  assert.match(docs.text, /Swagger UI/);
});

test('Owner password confirmation replaces the Primary Admin and revokes the old account sessions', async () => {
  const owner = await registerOwner();
  const ownerHeader = { Authorization: `Bearer ${owner.token}` };
  const firstCode = await request(app).post('/api/v1/auth/primary-admin-codes').set(ownerHeader).expect(201);
  const firstEmail = `primary-one@${owner.domain}`;
  const firstRegistration = await request(app).post('/api/v1/auth/primary-admin/register').send({
    organisationName: owner.organisationName,
    fullName: 'First Primary Admin',
    email: firstEmail,
    phone: '+1 555 010 2030',
    registrationCode: firstCode.body.code,
    password: 'FirstAdminPassword!2026',
  });
  assert.equal(firstRegistration.status, 201, JSON.stringify(firstRegistration.body));
  await request(app).post('/api/v1/auth/email-verification/confirm')
    .send({ email: firstEmail, code: sentCodes.at(-1).code }).expect(200);
  const firstLogin = await request(app).post('/api/v1/auth/login')
    .send({ email: firstEmail, password: 'FirstAdminPassword!2026' }).expect(200);

  const deniedReplace = await request(app).post('/api/v1/auth/primary-admin-codes')
    .set(ownerHeader).send({ replaceCurrent: true });
  assert.equal(deniedReplace.status, 401);
  assert.equal((await request(app).get('/api/v1/auth/me')
    .set('Authorization', `Bearer ${firstLogin.body.session.accessToken}`)).status, 200);

  const replacement = await request(app).post('/api/v1/auth/primary-admin-codes')
    .set(ownerHeader).send({ replaceCurrent: true, currentPassword: 'OwnerPassword!2026' });
  assert.equal(replacement.status, 201, JSON.stringify(replacement.body));
  assert.equal(replacement.headers['cache-control'], 'no-store');
  const formerAdmin = await User.findById(firstRegistration.body.user.id);
  assert.equal(formerAdmin.role, 'EMPLOYEE');
  assert.equal(formerAdmin.status, 'SUSPENDED');
  assert.equal((await request(app).get('/api/v1/auth/me')
    .set('Authorization', `Bearer ${firstLogin.body.session.accessToken}`)).status, 401);

  const secondEmail = `primary-two@${owner.domain}`;
  const secondRegistration = await request(app).post('/api/v1/auth/primary-admin/register').send({
    organisationName: owner.organisationName,
    fullName: 'Second Primary Admin',
    email: secondEmail,
    phone: '+1 555 010 2031',
    registrationCode: replacement.body.code,
    password: 'SecondAdminPassword!2026',
  });
  assert.equal(secondRegistration.status, 201, JSON.stringify(secondRegistration.body));
  await request(app).post('/api/v1/auth/email-verification/confirm')
    .send({ email: secondEmail, code: sentCodes.at(-1).code }).expect(200);
  assert.equal(await User.countDocuments({ organisationId: owner.owner.organisationId, role: 'PRIMARY_ADMIN' }), 1);
});

test('Owner and Primary Admin can read their organisation Primary Admin; other roles cannot', async () => {
  const owner = await registerOwner();
  const ownerHeader = { Authorization: `Bearer ${owner.token}` };
  const empty = await request(app).get('/api/v1/organisations/primary-admin').set(ownerHeader);
  assert.equal(empty.status, 200);
  assert.equal(empty.body.primaryAdmin, null);

  const issued = await request(app).post('/api/v1/auth/primary-admin-codes')
    .set(ownerHeader).expect(201);
  const email = `primary@${owner.domain}`;
  const registered = await request(app).post('/api/v1/auth/primary-admin/register').send({
    organisationName: owner.organisationName,
    fullName: 'Primary Admin',
    email,
    phone: '+1 555 010 2050',
    registrationCode: issued.body.code,
    password: 'PrimaryPassword!2026',
  });
  assert.equal(registered.status, 201, JSON.stringify(registered.body));
  await request(app).post('/api/v1/auth/email-verification/confirm')
    .send({ email, code: sentCodes.at(-1).code }).expect(200);

  const ownerResult = await request(app).get('/api/v1/organisations/primary-admin').set(ownerHeader);
  assert.equal(ownerResult.status, 200);
  assert.equal(ownerResult.body.primaryAdmin.fullName, 'Primary Admin');
  assert.equal(ownerResult.body.primaryAdmin.email, email);
  assert.equal(ownerResult.body.primaryAdmin.status, 'ACTIVE');

  const primaryLogin = await request(app).post('/api/v1/auth/login')
    .send({ email, password: 'PrimaryPassword!2026' }).expect(200);
  const primaryResult = await request(app).get('/api/v1/organisations/primary-admin')
    .set({ Authorization: `Bearer ${primaryLogin.body.session.accessToken}` });
  assert.equal(primaryResult.status, 200);
  assert.equal(primaryResult.body.primaryAdmin.id, registered.body.user.id);

  const employee = await registerVerifiedMember(owner, 'employee');
  const employeeLogin = await request(app).post('/api/v1/auth/login')
    .send({ email: employee.email, password: 'MemberPassword!2026' }).expect(200);
  const forbidden = await request(app).get('/api/v1/organisations/primary-admin')
    .set({ Authorization: `Bearer ${employeeLogin.body.session.accessToken}` });
  assert.equal(forbidden.status, 403);
});

test('Internal Admin invitations activate only after one-time acceptance and enforce individual permissions', async () => {
  const owner = await registerOwner();
  const primaryCode = await request(app).post('/api/v1/auth/primary-admin-codes')
    .set({ Authorization: `Bearer ${owner.token}` }).expect(201);
  const primaryEmail = `primary@${owner.domain}`;
  await request(app).post('/api/v1/auth/primary-admin/register').send({
    organisationName: owner.organisationName, fullName: 'Operations Admin', email: primaryEmail,
    phone: '+1 555 010 2039', registrationCode: primaryCode.body.code, password: 'PrimaryPassword!2026',
  }).expect(201);
  await request(app).post('/api/v1/auth/email-verification/confirm')
    .send({ email: primaryEmail, code: sentCodes.at(-1).code }).expect(200);
  const primaryLogin = await request(app).post('/api/v1/auth/login')
    .send({ email: primaryEmail, password: 'PrimaryPassword!2026' }).expect(200);
  const primaryHeader = { Authorization: `Bearer ${primaryLogin.body.session.accessToken}` };
  assert.equal((await request(app).post('/api/v1/organisations/departments')
    .set(primaryHeader).send({ name: 'Primary Admin Department' })).status, 201);
  assert.equal((await request(app).patch('/api/v1/organisations/settings')
    .set(primaryHeader).send({ name: 'Primary Admin Cannot Change This' })).status, 403);
  const excessiveDelegation = await request(app).post('/api/v1/organisations/internal-admins')
    .set(primaryHeader).send({
      fullName: 'Escalation Attempt', email: `escalation@${owner.domain}`, phone: '+1 555 010 2038',
      permissions: ['settings:manage'],
    });
  assert.equal(excessiveDelegation.status, 403);

  const employee = await registerVerifiedMember(owner, 'employee');
  const agent = await registerVerifiedMember(owner, 'agent', 'Support Agent');
  const ownerHeader = { Authorization: `Bearer ${owner.token}` };
  const permissions = ['agents:read', 'agents:manage', 'departments:read', 'settings:read', 'audit:read'];
  const invited = await request(app).post('/api/v1/organisations/internal-admins')
    .set(ownerHeader).send({
      fullName: 'Delegated Admin', email: `internal@${owner.domain}`, phone: '+1 555 010 2040', permissions,
    });
  assert.equal(invited.status, 201, JSON.stringify(invited.body));
  assert.equal(invited.body.user.status, 'PENDING_EMAIL');
  assert.deepEqual(invited.body.user.permissions.sort(), permissions.sort());
  assert.equal((await request(app).post('/api/v1/auth/login').send({
    email: `internal@${owner.domain}`, password: 'InternalPassword!2026',
  })).status, 401);

  const internalEmail = `internal@${owner.domain}`;
  const accepted = await request(app).post('/api/v1/auth/internal-admin-invitations/accept').send({
    email: internalEmail,
    code: sentInvitations.at(-1).code,
    password: 'InternalPassword!2026',
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  const replay = await request(app).post('/api/v1/auth/internal-admin-invitations/accept').send({
    email: internalEmail,
    code: sentInvitations.at(-1).code,
    password: 'AnotherPassword!2026',
  });
  assert.equal(replay.status, 400);
  const login = await request(app).post('/api/v1/auth/login').send({
    email: internalEmail, password: 'InternalPassword!2026',
  });
  assert.equal(login.status, 200);
  const internalHeader = { Authorization: `Bearer ${login.body.session.accessToken}` };

  const listedUsers = await request(app).get('/api/v1/organisations/users').set(internalHeader);
  assert.equal(listedUsers.status, 200);
  assert.deepEqual(listedUsers.body.users.map((user) => user.id), [agent.user.id]);
  assert.equal((await request(app).get('/api/v1/organisations/users?role=EMPLOYEE').set(internalHeader)).status, 403);
  assert.equal((await request(app).post('/api/v1/organisations/departments').set(internalHeader).send({ name: 'Field Operations' })).status, 403);
  assert.equal((await request(app).post('/api/v1/auth/primary-admin-codes').set(internalHeader)).status, 403);
  assert.equal((await request(app).get('/api/v1/organisations/settings').set(internalHeader)).status, 200);
  assert.equal((await request(app).patch('/api/v1/organisations/settings').set(internalHeader)
    .send({ name: 'Not Yet Delegated' })).status, 403);

  const unauthorizedAdminManagement = await request(app).post('/api/v1/organisations/internal-admins')
    .set(internalHeader).send({
      fullName: 'Unauthorized Delegate', email: `unauthorized@${owner.domain}`, phone: '+1 555 010 2041',
      permissions: ['settings:manage'],
    });
  assert.equal(unauthorizedAdminManagement.status, 403);

  const updatedPermissions = [...permissions, 'departments:manage', 'settings:manage'];
  const permissionUpdate = await request(app).patch(`/api/v1/organisations/internal-admins/${invited.body.user.id}/permissions`)
    .set(ownerHeader).send({ permissions: updatedPermissions });
  assert.equal(permissionUpdate.status, 200, JSON.stringify(permissionUpdate.body));

  const settingUpdate = await request(app).patch('/api/v1/organisations/settings')
    .set(internalHeader).send({ name: 'Updated Organisation Name', timezone: 'Asia/Kolkata', memberRegistrationEnabled: false });
  assert.equal(settingUpdate.status, 200, JSON.stringify(settingUpdate.body));
  const closedRegistration = await registerMember({
    organisationName: 'Updated Organisation Name', email: `late@${owner.domain}`,
  });
  assert.equal(closedRegistration.status, 403);

  const department = await request(app).post('/api/v1/organisations/departments')
    .set(internalHeader).send({ name: 'Field Operations', description: 'Regional support.' });
  assert.equal(department.status, 201, JSON.stringify(department.body));
  const departmentUpdate = await request(app).patch(`/api/v1/organisations/departments/${department.body.department.id}`)
    .set(internalHeader).send({ description: 'Updated support group.' });
  assert.equal(departmentUpdate.status, 200);
  assert.equal(departmentUpdate.body.department.description, 'Updated support group.');
  const duplicateDepartment = await request(app).post('/api/v1/organisations/departments')
    .set(ownerHeader).send({ name: 'field operations' });
  assert.equal(duplicateDepartment.status, 409);

  const agentDeactivation = await request(app).patch(`/api/v1/organisations/users/${agent.user.id}/status`)
    .set(internalHeader).send({ status: 'SUSPENDED' });
  assert.equal(agentDeactivation.status, 200, JSON.stringify(agentDeactivation.body));
  assert.equal(agentDeactivation.body.user.status, 'SUSPENDED');
  const agentLoginBeforeDeactivation = await request(app).post('/api/v1/auth/login').send({
    email: agent.email, password: 'MemberPassword!2026',
  });
  // The account is already suspended, so it cannot create a session.
  assert.equal(agentLoginBeforeDeactivation.status, 403);
  const agentReactivation = await request(app).patch(`/api/v1/organisations/users/${agent.user.id}/status`)
    .set(ownerHeader).send({ status: 'ACTIVE' });
  assert.equal(agentReactivation.status, 200);
  const activeAgentLogin = await request(app).post('/api/v1/auth/login').send({
    email: agent.email, password: 'MemberPassword!2026',
  });
  assert.equal(activeAgentLogin.status, 200);
  const agentDeactivationAgain = await request(app).patch(`/api/v1/organisations/users/${agent.user.id}/status`)
    .set(internalHeader).send({ status: 'SUSPENDED' });
  assert.equal(agentDeactivationAgain.status, 200);
  assert.equal((await request(app).get('/api/v1/auth/me')
    .set({ Authorization: `Bearer ${activeAgentLogin.body.session.accessToken}` })).status, 401);
  await request(app).patch(`/api/v1/organisations/users/${agent.user.id}/status`)
    .set(ownerHeader).send({ status: 'ACTIVE' }).expect(200);
  const forbiddenEmployeeChange = await request(app).patch(`/api/v1/organisations/users/${employee.user.id}/status`)
    .set(internalHeader).send({ status: 'SUSPENDED' });
  assert.equal(forbiddenEmployeeChange.status, 403);

  const audit = await request(app).get('/api/v1/organisations/audit-events').set(internalHeader);
  assert.equal(audit.status, 200);
  assert.ok(audit.body.events.some((event) => event.action === 'DEPARTMENT_CREATED'));
  assert.ok(audit.body.events.some((event) => event.action === 'SUPPORT_AGENT_DEACTIVATED'));
  assert.ok(audit.body.events.every((event) => !JSON.stringify(event.metadata).includes('InternalPassword!2026')));

  const ownerDepartmentAccess = await request(app).patch(`/api/v1/organisations/departments/${department.body.department.id}`)
    .set(ownerHeader).send({ status: 'INACTIVE' });
  assert.equal(ownerDepartmentAccess.status, 200);
  const activeDepartments = await request(app).get('/api/v1/organisations/departments').set(ownerHeader);
  assert.deepEqual(activeDepartments.body.departments.map((item) => item.name), ['Primary Admin Department']);
  const allDepartments = await request(app).get('/api/v1/organisations/departments?status=ALL').set(ownerHeader);
  assert.equal(allDepartments.body.departments[0].status, 'INACTIVE');

  const internalDeactivation = await request(app).patch(`/api/v1/organisations/internal-admins/${invited.body.user.id}/status`)
    .set(ownerHeader).send({ status: 'SUSPENDED' });
  assert.equal(internalDeactivation.status, 200);
  assert.equal((await request(app).get('/api/v1/auth/me').set(internalHeader)).status, 401);
  const internalReactivation = await request(app).patch(`/api/v1/organisations/internal-admins/${invited.body.user.id}/status`)
    .set(ownerHeader).send({ status: 'ACTIVE' });
  assert.equal(internalReactivation.status, 200);
});

test('departments, settings, user records and audit events remain isolated by organisation', async () => {
  const ownerA = await registerOwner();
  const ownerB = await registerOwner();
  const headerA = { Authorization: `Bearer ${ownerA.token}` };
  const headerB = { Authorization: `Bearer ${ownerB.token}` };
  const departmentB = await request(app).post('/api/v1/organisations/departments')
    .set(headerB).send({ name: 'Private Department' }).expect(201);

  const crossTenantUpdate = await request(app).patch(`/api/v1/organisations/departments/${departmentB.body.department.id}`)
    .set(headerA).send({ name: 'Taken Over' });
  assert.equal(crossTenantUpdate.status, 404);
  assert.deepEqual((await request(app).get('/api/v1/organisations/departments').set(headerA)).body.departments, []);
  assert.equal((await request(app).get('/api/v1/organisations/departments').set(headerB)).body.departments.length, 1);

  await request(app).patch('/api/v1/organisations/settings').set(headerA).send({ name: 'Tenant A Settings' }).expect(200);
  const settingsA = await request(app).get('/api/v1/organisations/settings').set(headerA);
  const settingsB = await request(app).get('/api/v1/organisations/settings').set(headerB);
  assert.equal(settingsA.body.organisation.name, 'Tenant A Settings');
  assert.notEqual(settingsB.body.organisation.name, 'Tenant A Settings');

  const auditA = await request(app).get('/api/v1/organisations/audit-events').set(headerA);
  const auditB = await request(app).get('/api/v1/organisations/audit-events').set(headerB);
  assert.ok(auditA.body.events.some((event) => event.action === 'ORGANISATION_SETTINGS_UPDATED'));
  assert.deepEqual(auditB.body.events.map((event) => event.action), ['DEPARTMENT_CREATED']);
});
