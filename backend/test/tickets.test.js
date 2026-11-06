process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'phase-four-tickets-local-test-secret';
process.env.BCRYPT_ROUNDS = '10';
process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/smarttracker_phase2_test';

const { before, beforeEach, after, test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const {
  connectDatabase,
  disconnectDatabase,
  removeLegacyUniqueIndexes,
  ensureUniquePasswordResetUserIndex,
} = require('../src/config/database');
const Organisation = require('../src/models/Organisation');
const User = require('../src/models/User');
const Session = require('../src/models/Session');
const EmailVerification = require('../src/models/EmailVerification');
const PrimaryAdminCode = require('../src/models/PrimaryAdminCode');
const Department = require('../src/models/Department');
const AuditEvent = require('../src/models/AuditEvent');
const AdminInvitation = require('../src/models/AdminInvitation');
const Ticket = require('../src/models/Ticket');
const TicketComment = require('../src/models/TicketComment');
const TicketActivity = require('../src/models/TicketActivity');
const Notification = require('../src/models/Notification');
const PasswordReset = require('../src/models/PasswordReset');
const emailService = require('../src/services/emailService');

const sentCodes = [];
emailService.sendVerificationCode = async ({ email, code }) => sentCodes.push({ email, code });
let counter = 0;
const password = 'TestPassword!2026';

async function ownerFor(label) {
  counter += 1;
  const domain = `${label}${counter}.example.org`;
  const email = `owner@${domain}`;
  const created = await request(app).post('/api/v1/organisations').send({
    organisationName: `Company ${label}${counter}`, domain, ownerName: 'Taylor Owner', email,
    phone: '+1 555 010 2000', industry: 'Technology', country: 'India', password,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const verified = await request(app).post('/api/v1/auth/email-verification/confirm').send({ email, code: sentCodes.at(-1).code });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  const login = await request(app).post('/api/v1/auth/login').send({ email, password });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  return { domain, name: created.body.organisation.name, email, token: login.body.session.accessToken, orgId: created.body.organisation.id };
}

async function member(owner, local, role = 'Employee') {
  const email = `${local}@${owner.domain}`;
  const registered = await request(app).post('/api/v1/auth/members/register').send({
    organisationName: owner.name, email, fullName: `${local} Member`, phone: '+1 555 010 2010',
    accountType: role === 'SUPPORT_AGENT' ? 'Support Agent' : 'Employee', department: 'IT',
    jobTitle: 'Analyst', experience: '2 years', skills: 'Support', password,
  });
  assert.equal(registered.status, 201, JSON.stringify(registered.body));
  const verified = await request(app).post('/api/v1/auth/email-verification/confirm').send({ email, code: sentCodes.at(-1).code });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  const approved = await request(app).patch(`/api/v1/organisations/members/${registered.body.user.id}/approval`)
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ decision: 'APPROVE', approvedRole: role === 'SUPPORT_AGENT' ? 'SUPPORT_AGENT' : 'EMPLOYEE' });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  const login = await request(app).post('/api/v1/auth/login').send({ email, password });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  return { email, id: approved.body.member.id, token: login.body.session.accessToken };
}
const auth = (token) => ({ Authorization: `Bearer ${token}` });

before(async () => {
  await connectDatabase();
  await Promise.all([Organisation.init(), User.init(), Session.init(), EmailVerification.init(), PasswordReset.init(), PrimaryAdminCode.init(), Department.init(), AuditEvent.init(), AdminInvitation.init(), Ticket.init(), TicketComment.init(), TicketActivity.init(), Notification.init()]);
});
beforeEach(async () => {
  sentCodes.length = 0;
  await Promise.all([Organisation.deleteMany({}), User.deleteMany({}), Session.deleteMany({}), EmailVerification.deleteMany({}), PasswordReset.deleteMany({}), PrimaryAdminCode.deleteMany({}), Department.deleteMany({}), AuditEvent.deleteMany({}), AdminInvitation.deleteMany({}), Ticket.deleteMany({}), TicketComment.deleteMany({}), TicketActivity.deleteMany({}), Notification.deleteMany({})]);
});
after(async () => { await disconnectDatabase(); });

test('database startup removes obsolete unique indexes without dropping current constraints', async () => {
  const legacyIndexes = [
    [Ticket.collection, { organisationId: 1, sequence: 1 }, 'organisationId_1_sequence_1'],
    [Department.collection, { organisationId: 1, normalizedName: 1 }, 'organisationId_1_normalizedName_1'],
    [Organisation.collection, { slug: 1 }, 'slug_1'],
    [PasswordReset.collection, { tokenHash: 1 }, 'tokenHash_1'],
    [User.collection, { organisationId: 1, email: 1 }, 'organisationId_1_email_1'],
  ];
  for (const [collection, key, name] of legacyIndexes) {
    await collection.createIndex(key, { unique: true, name });
  }

  await removeLegacyUniqueIndexes();

  for (const [collection, , name] of legacyIndexes) {
    const indexes = await collection.indexes();
    assert.equal(indexes.some((index) => index.name === name), false, `${name} should be removed`);
  }
  const ticketIndexes = await Ticket.collection.indexes();
  assert.equal(ticketIndexes.some((index) => index.name === 'organisationId_1_ticketNumber_1' && index.unique), true);
  const userIndexes = await User.collection.indexes();
  assert.equal(userIndexes.some((index) => index.name === 'email_1' && index.unique), true);

  await PasswordReset.collection.dropIndex('userId_1');
  await PasswordReset.collection.createIndex({ userId: 1 }, { name: 'userId_1' });
  await ensureUniquePasswordResetUserIndex();
  const resetIndexes = await PasswordReset.collection.indexes();
  assert.equal(resetIndexes.some((index) => index.name === 'userId_1' && index.unique), true);
});

test('ticket lifecycle enforces role ownership, tracks activity, separates internal notes and scopes notifications', async () => {
  const org = await ownerFor('life');
  const employee = await member(org, 'employee');
  const otherEmployee = await member(org, 'other');
  const agent = await member(org, 'agent', 'SUPPORT_AGENT');
  const otherAgent = await member(org, 'agent2', 'SUPPORT_AGENT');
  const foreignOrg = await ownerFor('foreign');
  const foreignEmployee = await member(foreignOrg, 'foreignemployee');

  const create = await request(app).post('/api/v1/tickets').set(auth(employee.token)).send({
    title: 'Laptop issue', description: 'Laptop does not power on after charging.', category: 'Hardware', priority: 'High', department: 'IT',
    employeeEmail: 'attacker@example.org', createdById: new mongoose.Types.ObjectId().toString(), organisationId: foreignOrg.orgId,
    assignedAgentId: agent.id, status: 'Resolved',
  });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  const ticket = create.body.ticket;
  assert.equal(ticket.employeeEmail, employee.email);
  assert.equal(ticket.status, 'Open');
  assert.equal(ticket.priority, 'High');
  assert.equal(ticket.assignedAgentId, null);
  assert.equal((await request(app).get('/api/v1/notifications').set(auth(employee.token))).body.unreadCount, 1);
  assert.equal((await request(app).get('/api/v1/tickets').set(auth(otherEmployee.token))).body.tickets.length, 0);

  const forbiddenCreate = await request(app).post('/api/v1/tickets').set(auth(agent.token)).send({ title: 'Agent ticket', description: 'A sufficiently long description.', category: 'Other' });
  assert.equal(forbiddenCreate.status, 403);
  assert.equal((await request(app).patch(`/api/v1/tickets/${ticket.id}/priority`).set(auth(employee.token)).send({ priority: 'Critical' })).status, 403);
  assert.equal((await request(app).get(`/api/v1/tickets/${ticket.id}`).set(auth(foreignEmployee.token))).status, 404);
  assert.equal((await request(app).get(`/api/v1/tickets/${ticket.id}`).set(auth(otherAgent.token))).status, 404);

  const assignment = await request(app).put(`/api/v1/tickets/${ticket.id}/assignment`).set(auth(org.token)).send({ agentId: agent.id });
  assert.equal(assignment.status, 200, JSON.stringify(assignment.body));
  assert.equal(assignment.body.ticket.acceptance, 'Pending');
  assert.equal((await request(app).get('/api/v1/tickets').set(auth(agent.token))).body.tickets.length, 1);
  assert.equal((await request(app).put(`/api/v1/tickets/${ticket.id}/assignment`).set(auth(foreignOrg.token)).send({ agentId: agent.id })).status, 404);
  assert.equal((await request(app).put(`/api/v1/tickets/${ticket.id}/assignment-response`).set(auth(otherAgent.token)).send({ decision: 'ACCEPT' })).status, 404);

  const rejected = await request(app).put(`/api/v1/tickets/${ticket.id}/assignment-response`).set(auth(agent.token)).send({ decision: 'REJECT', reason: 'Not my skill area' });
  assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
  assert.equal(rejected.body.ticket.status, 'Open');
  assert.equal(rejected.body.ticket.agentEmail, '');
  assert.equal((await request(app).get(`/api/v1/tickets/${ticket.id}`).set(auth(agent.token))).status, 404);
  await request(app).put(`/api/v1/tickets/${ticket.id}/assignment`).set(auth(org.token)).send({ agentId: agent.id });
  const accepted = await request(app).put(`/api/v1/tickets/${ticket.id}/assignment-response`).set(auth(agent.token)).send({ decision: 'ACCEPT' });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.ticket.status, 'In Progress');
  assert.equal((await request(app).patch(`/api/v1/tickets/${ticket.id}/status`).set(auth(agent.token)).send({ status: 'Open' })).status, 409);
  assert.equal((await request(app).patch(`/api/v1/tickets/${ticket.id}/status`).set(auth(agent.token)).send({ status: 'On Hold' })).status, 200);
  assert.equal((await request(app).patch(`/api/v1/tickets/${ticket.id}/status`).set(auth(agent.token)).send({ status: 'Resolved' })).status, 200);
  assert.equal((await request(app).put(`/api/v1/tickets/${ticket.id}/assignment`).set(auth(org.token)).send({ agentId: otherAgent.id })).status, 409);
  assert.equal((await request(app).patch(`/api/v1/tickets/${ticket.id}/status`).set(auth(org.token)).send({ status: 'Open' })).status, 200);

  const publicComment = await request(app).post(`/api/v1/tickets/${ticket.id}/comments`).set(auth(employee.token)).send({ message: 'Any update on this issue?' });
  assert.equal(publicComment.status, 201);
  const assignedAgain = await request(app).put(`/api/v1/tickets/${ticket.id}/assignment`).set(auth(org.token)).send({ agentId: agent.id });
  assert.equal(assignedAgain.status, 200);
  await request(app).put(`/api/v1/tickets/${ticket.id}/assignment-response`).set(auth(agent.token)).send({ decision: 'ACCEPT' });
  const note = await request(app).post(`/api/v1/tickets/${ticket.id}/comments`).set(auth(agent.token)).send({ message: 'Check the power supply internally.', isInternal: true });
  assert.equal(note.status, 201, JSON.stringify(note.body));
  assert.equal((await request(app).post(`/api/v1/tickets/${ticket.id}/comments`).set(auth(employee.token)).send({ message: 'Trying to add a private note', isInternal: true })).status, 403);
  const employeeView = await request(app).get(`/api/v1/tickets/${ticket.id}`).set(auth(employee.token));
  assert.equal(employeeView.body.ticket.comments.length, 1);
  assert.equal(employeeView.body.ticket.internalNotes.length, 0);
  const agentView = await request(app).get(`/api/v1/tickets/${ticket.id}`).set(auth(agent.token));
  assert.equal(agentView.body.ticket.internalNotes.length, 1);
  assert.equal((await request(app).get(`/api/v1/tickets/${ticket.id}/activity`).set(auth(employee.token))).body.activities.some((event) => event.action === 'INTERNAL_NOTE_ADDED'), false);

  const search = await request(app).get('/api/v1/tickets?q=power&status=In%20Progress&page=1&limit=1&sortBy=createdAt&order=desc').set(auth(org.token));
  assert.equal(search.status, 200);
  assert.equal(search.body.pagination.total, 1);
  assert.equal(search.body.tickets[0].id, ticket.id);
  const notifications = await request(app).get('/api/v1/notifications?read=false').set(auth(employee.token));
  assert.equal(notifications.status, 200);
  assert.ok(notifications.body.notifications.some((item) => item.type === 'TICKET_REJECTED'));
  const notificationId = notifications.body.notifications[0].id;
  assert.equal((await request(app).patch(`/api/v1/notifications/${notificationId}/read`).set(auth(employee.token)).send({ read: true })).status, 200);
  assert.equal((await request(app).patch(`/api/v1/notifications/${notificationId}/read`).set(auth(employee.token)).send({ read: false })).body.notification.read, false);
  assert.equal((await request(app).patch('/api/v1/notifications/read').set(auth(employee.token))).status, 200);
  assert.equal((await request(app).get('/api/v1/notifications?read=false').set(auth(employee.token))).body.notifications.length, 0);

  const foreignRead = await request(app).get(`/api/v1/tickets/${ticket.id}`).set(auth(foreignOrg.token));
  assert.equal(foreignRead.status, 404);
  assert.ok(await TicketActivity.countDocuments({ organisationId: org.orgId, ticketId: ticket.id }) >= 7);
  assert.ok(await AuditEvent.countDocuments({ organisationId: org.orgId, targetId: ticket.id }) >= 4);
});

test('delegated ticket read and manage permissions are independently enforced', async () => {
  const org = await ownerFor('delegated');
  const employee = await member(org, 'employee');
  const agent = await member(org, 'agent', 'SUPPORT_AGENT');
  const ticketResponse = await request(app).post('/api/v1/tickets').set(auth(employee.token)).send({ title: 'VPN access', description: 'VPN access fails each morning.', category: 'Access' });
  assert.equal(ticketResponse.status, 201);
  const ticketId = ticketResponse.body.ticket.id;
  const readAdmin = await User.create({ organisationId: org.orgId, fullName: 'Read Admin', email: `read@${org.domain}`, phone: '1234567', passwordHash: 'not-used-password-hash', role: 'INTERNAL_ADMIN', status: 'ACTIVE', emailVerifiedAt: new Date(), permissions: ['tickets:read'] });
  const manageAdmin = await User.create({ organisationId: org.orgId, fullName: 'Manage Admin', email: `manage@${org.domain}`, phone: '1234567', passwordHash: 'not-used-password-hash', role: 'INTERNAL_ADMIN', status: 'ACTIVE', emailVerifiedAt: new Date(), permissions: ['tickets:manage'] });
  const jwt = require('jsonwebtoken');
  const config = require('../src/config/env');
  const issue = async (user) => {
    const session = await Session.create({ userId: user._id, organisationId: user.organisationId, refreshTokenHash: 'test-hash', expiresAt: new Date(Date.now() + 300000) });
    return jwt.sign({ sub: String(user._id), sid: String(session._id) }, config.jwtSecret, { expiresIn: '5m' });
  };
  const readToken = await issue(readAdmin);
  const manageToken = await issue(manageAdmin);
  assert.equal((await request(app).get('/api/v1/tickets').set(auth(readToken))).status, 200);
  assert.equal((await request(app).put(`/api/v1/tickets/${ticketId}/assignment`).set(auth(readToken)).send({ agentId: agent.id })).status, 403);
  assert.equal((await request(app).put(`/api/v1/tickets/${ticketId}/assignment`).set(auth(manageToken)).send({ agentId: agent.id })).status, 200);
});

test('Swagger contains every ticket and notification route with bearer security and schemas', () => {
  const spec = require('../src/openapi');
  const required = [
    ['/api/v1/tickets', 'get'], ['/api/v1/tickets', 'post'], ['/api/v1/tickets/{ticketId}', 'get'],
    ['/api/v1/tickets/{ticketId}/assignment', 'put'], ['/api/v1/tickets/{ticketId}/assignment', 'delete'],
    ['/api/v1/tickets/{ticketId}/assignment-response', 'put'], ['/api/v1/tickets/{ticketId}/status', 'patch'],
    ['/api/v1/tickets/{ticketId}/priority', 'patch'], ['/api/v1/tickets/{ticketId}/comments', 'get'],
    ['/api/v1/tickets/{ticketId}/comments', 'post'], ['/api/v1/tickets/{ticketId}/activity', 'get'],
    ['/api/v1/notifications', 'get'], ['/api/v1/notifications/read', 'patch'], ['/api/v1/notifications/{notificationId}/read', 'patch'],
  ];
  for (const [path, method] of required) {
    assert.ok(spec.paths[path]?.[method], `${method.toUpperCase()} ${path} missing from OpenAPI`);
    assert.deepEqual(spec.paths[path][method].security, [{ bearerAuth: [] }]);
  }
  for (const schema of ['Ticket', 'TicketCreateRequest', 'TicketListResponse', 'Comment', 'Activity', 'Notification', 'NotificationListResponse']) assert.ok(spec.components.schemas[schema]);
});
