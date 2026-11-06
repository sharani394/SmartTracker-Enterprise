process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'phase-five-knowledge-reports-test-secret';
process.env.BCRYPT_ROUNDS = '10';
process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/smarttracker_phase2_test';

const { before, beforeEach, after, test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const config = require('../src/config/env');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
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
const KnowledgeBaseArticle = require('../src/models/KnowledgeBaseArticle');
const emailService = require('../src/services/emailService');

const sentCodes = [];
emailService.sendVerificationCode = async ({ email, code }) => sentCodes.push({ email, code });
let sequence = 0;
const password = 'TestPassword!2026';
async function ownerFor(label) {
  sequence += 1;
  const domain = `${label}${sequence}.example.org`;
  const email = `owner@${domain}`;
  const registered = await request(app).post('/api/v1/organisations').send({ organisationName: `${label} Company ${sequence}`, domain, ownerName: 'Taylor Owner', email, phone: '+1 555 010 2000', industry: 'Technology', country: 'India', password });
  assert.equal(registered.status, 201, JSON.stringify(registered.body));
  const verified = await request(app).post('/api/v1/auth/email-verification/confirm').send({ email, code: sentCodes.at(-1).code });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  const login = await request(app).post('/api/v1/auth/login').send({ email, password });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  return { domain, name: registered.body.organisation.name, email, orgId: registered.body.organisation.id, id: registered.body.user.id, token: login.body.session.accessToken };
}
async function member(owner, local, role = 'Employee') {
  const email = `${local}@${owner.domain}`;
  const registered = await request(app).post('/api/v1/auth/members/register').send({ organisationName: owner.name, email, fullName: `${local} Member`, phone: '+1 555 010 2010', accountType: role, department: 'IT', jobTitle: 'Analyst', experience: '2 years', skills: 'Support', password });
  assert.equal(registered.status, 201, JSON.stringify(registered.body));
  const verified = await request(app).post('/api/v1/auth/email-verification/confirm').send({ email, code: sentCodes.at(-1).code });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  const approved = await request(app).patch(`/api/v1/organisations/members/${registered.body.user.id}/approval`).set(auth(owner.token)).send({ decision: 'APPROVE', approvedRole: role === 'Support Agent' ? 'SUPPORT_AGENT' : 'EMPLOYEE' });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  const login = await request(app).post('/api/v1/auth/login').send({ email, password });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  return { email, id: approved.body.member.id, token: login.body.session.accessToken };
}
function auth(token) { return { Authorization: `Bearer ${token}` }; }
async function internalAdmin(owner, suffix, permissions) {
  const user = await User.create({ organisationId: owner.orgId, fullName: `Internal ${suffix}`, email: `internal-${suffix}@${owner.domain}`, phone: '1234567', passwordHash: 'unused-hash-for-session-test', role: 'INTERNAL_ADMIN', status: 'ACTIVE', emailVerifiedAt: new Date(), permissions });
  const session = await Session.create({ userId: user._id, organisationId: user.organisationId, refreshTokenHash: `hash-${suffix}`, expiresAt: new Date(Date.now() + 3600000) });
  return { id: String(user._id), token: jwt.sign({ sub: String(user._id), sid: String(session._id) }, config.jwtSecret, { expiresIn: '30m' }) };
}

before(async () => {
  await connectDatabase();
  await Promise.all([Organisation.init(), User.init(), Session.init(), EmailVerification.init(), PrimaryAdminCode.init(), Department.init(), AuditEvent.init(), AdminInvitation.init(), Ticket.init(), TicketComment.init(), TicketActivity.init(), Notification.init(), KnowledgeBaseArticle.init()]);
});
beforeEach(async () => {
  sentCodes.length = 0;
  await Promise.all([Organisation.deleteMany({}), User.deleteMany({}), Session.deleteMany({}), EmailVerification.deleteMany({}), PrimaryAdminCode.deleteMany({}), Department.deleteMany({}), AuditEvent.deleteMany({}), AdminInvitation.deleteMany({}), Ticket.deleteMany({}), TicketComment.deleteMany({}), TicketActivity.deleteMany({}), Notification.deleteMany({}), KnowledgeBaseArticle.deleteMany({})]);
});
after(async () => { await disconnectDatabase(); });

test('Knowledge Base drafts, publication, search, archive and deletion enforce permissions and tenant isolation', async () => {
  const owner = await ownerFor('kb');
  const employee = await member(owner, 'employee');
  const agent = await member(owner, 'agent', 'Support Agent');
  const foreignOwner = await ownerFor('foreignkb');
  const reader = await internalAdmin(owner, 'reader', ['knowledge:read']);
  const manager = await internalAdmin(owner, 'manager', ['knowledge:manage']);
  const managePermissionDenied = await request(app).post('/api/v1/knowledge-base/articles').set(auth(reader.token)).send({ title: 'Cannot create this', category: 'Access' });
  assert.equal(managePermissionDenied.status, 403);
  const delegatedCreate = await request(app).post('/api/v1/knowledge-base/articles').set(auth(manager.token)).send({ title: 'Manager Created Draft', category: 'Access' });
  assert.equal(delegatedCreate.status, 201, JSON.stringify(delegatedCreate.body));

  const created = await request(app).post('/api/v1/knowledge-base/articles').set(auth(owner.token)).send({ title: 'Password Reset Guide', category: 'Account Access' });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const article = created.body.article;
  assert.equal(article.status, 'Draft');
  assert.equal((await request(app).get('/api/v1/knowledge-base/articles').set(auth(employee.token))).body.articles.length, 0);
  assert.equal((await request(app).get(`/api/v1/knowledge-base/articles/${article.id}`).set(auth(employee.token))).status, 404);
  assert.equal((await request(app).get(`/api/v1/knowledge-base/articles/${article.id}`).set(auth(foreignOwner.token))).status, 404);
  assert.equal((await request(app).get(`/api/v1/knowledge-base/articles/${article.id}`).set(auth(reader.token))).body.article.status, 'Draft');

  const published = await request(app).patch(`/api/v1/knowledge-base/articles/${article.id}`).set(auth(owner.token)).send({ content: 'Use the company identity portal to reset your password.', summary: 'Steps for resetting an account password.', status: 'Published' });
  assert.equal(published.status, 200, JSON.stringify(published.body));
  assert.equal(published.body.article.status, 'Published');
  assert.ok(published.body.article.publishedAt);
  const employeeList = await request(app).get('/api/v1/knowledge-base/articles?q=identity&category=Account%20Access&page=1&limit=1').set(auth(employee.token));
  assert.equal(employeeList.status, 200);
  assert.equal(employeeList.body.pagination.total, 1);
  assert.equal(employeeList.body.articles[0].content, 'Use the company identity portal to reset your password.');
  assert.equal((await request(app).get('/api/v1/knowledge-base/articles?status=Draft').set(auth(employee.token))).status, 403);
  assert.equal((await request(app).patch(`/api/v1/knowledge-base/articles/${article.id}`).set(auth(employee.token)).send({ status: 'Archived' })).status, 403);
  assert.equal((await request(app).get(`/api/v1/knowledge-base/articles/${article.id}`).set(auth(agent.token))).status, 200);
  assert.equal((await request(app).patch(`/api/v1/knowledge-base/articles/${article.id}`).set(auth(foreignOwner.token)).send({ title: 'Cross tenant edit' })).status, 404);

  const archived = await request(app).patch(`/api/v1/knowledge-base/articles/${article.id}`).set(auth(owner.token)).send({ status: 'Archived' });
  assert.equal(archived.status, 200);
  assert.equal(archived.body.article.status, 'Archived');
  assert.equal((await request(app).get(`/api/v1/knowledge-base/articles/${article.id}`).set(auth(employee.token))).status, 404);
  const deleted = await request(app).delete(`/api/v1/knowledge-base/articles/${article.id}`).set(auth(owner.token));
  assert.equal(deleted.status, 200);
  assert.equal((await request(app).delete(`/api/v1/knowledge-base/articles/${delegatedCreate.body.article.id}`).set(auth(owner.token))).status, 200);
  assert.equal(await KnowledgeBaseArticle.countDocuments({ organisationId: owner.orgId }), 0);
  const audit = await request(app).get('/api/v1/organisations/audit-events?targetType=KnowledgeBaseArticle&q=Password').set(auth(owner.token));
  assert.equal(audit.status, 200);
  assert.deepEqual(new Set(audit.body.events.map((event) => event.action)), new Set(['KNOWLEDGE_ARTICLE_CREATED', 'KNOWLEDGE_ARTICLE_PUBLISHED', 'KNOWLEDGE_ARTICLE_ARCHIVED', 'KNOWLEDGE_ARTICLE_DELETED']));
  assert.ok(audit.body.events.every((event) => event.actorName === 'Taylor Owner'));
});

test('reports aggregate real tenant tickets, honor date range and require reports:read', async () => {
  const owner = await ownerFor('reports');
  const employee = await member(owner, 'employee');
  const agent = await member(owner, 'agent', 'Support Agent');
  const foreignOwner = await ownerFor('otherreports');
  const foreignEmployee = await member(foreignOwner, 'foreignemployee');
  const reportAdmin = await internalAdmin(owner, 'reporter', ['reports:read']);
  const noReportPermission = await internalAdmin(owner, 'noreport', ['tickets:read']);
  const now = Date.now();
  const makeTicket = (overrides) => ({
    organisationId: owner.orgId,
    ticketNumber: `ST-${new mongoose.Types.ObjectId().toString().slice(-12).toUpperCase()}`,
    title: 'Report fixture', description: 'Persisted ticket data for analytics checks.', category: 'Hardware', priority: 'MEDIUM', status: 'OPEN', acceptance: 'NOT_ASSIGNED',
    createdById: employee.id, employeeName: 'employee Member', employeeEmail: employee.email, departmentName: 'IT Support', createdAt: new Date(now - 2 * 86400000), updatedAt: new Date(now - 2 * 86400000),
    ...overrides,
  });
  await Ticket.create([
    makeTicket({ priority: 'HIGH', status: 'RESOLVED', assignedAgentId: agent.id, assignedAgentName: 'agent Member', assignedAgentEmail: agent.email, resolvedAt: new Date(now - 86400000) }),
    makeTicket({ priority: 'CRITICAL', status: 'IN_PROGRESS', departmentName: 'Finance', assignedAgentId: agent.id, assignedAgentName: 'agent Member', assignedAgentEmail: agent.email }),
    makeTicket({ priority: 'LOW', status: 'ON_HOLD', departmentName: 'IT Support' }),
    makeTicket({ ticketNumber: 'ST-OLD-PERIOD', createdAt: new Date(now - 60 * 86400000), updatedAt: new Date(now - 60 * 86400000) }),
  ]);
  await Ticket.create(makeTicket({ organisationId: foreignOwner.orgId, createdById: foreignEmployee.id, employeeName: 'foreignemployee Member', employeeEmail: foreignEmployee.email, ticketNumber: 'ST-FOREIGN-01', status: 'RESOLVED', resolvedAt: new Date(now - 86400000) }));

  const response = await request(app).get(`/api/v1/reports/summary?from=${new Date(now - 7 * 86400000).toISOString()}&to=${new Date(now).toISOString()}`).set(auth(owner.token));
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.deepEqual(response.body.totals, { tickets: 3, resolved: 1, open: 2 });
  assert.equal(response.body.statusCounts.RESOLVED, 1);
  assert.equal(response.body.statusCounts.IN_PROGRESS, 1);
  assert.equal(response.body.priorityCounts.CRITICAL, 1);
  assert.deepEqual(response.body.departmentCounts, [{ department: 'IT Support', count: 2 }, { department: 'Finance', count: 1 }]);
  assert.equal(response.body.agentPerformance.length, 1);
  assert.deepEqual({ assigned: response.body.agentPerformance[0].assigned, resolved: response.body.agentPerformance[0].resolved }, { assigned: 2, resolved: 1 });
  assert.equal(response.body.resolution.resolvedInRange, 1);
  assert.equal(response.body.resolution.averageMinutes, 1440);
  assert.equal((await request(app).get('/api/v1/reports/summary').set(auth(employee.token))).status, 403);
  assert.equal((await request(app).get('/api/v1/reports/summary').set(auth(noReportPermission.token))).status, 403);
  const delegated = await request(app).get('/api/v1/reports/summary').set(auth(reportAdmin.token));
  assert.equal(delegated.status, 200);
  assert.equal(delegated.body.totals.tickets, 3);
  assert.equal((await request(app).get('/api/v1/reports/summary').set(auth(foreignOwner.token))).body.totals.tickets, 1);
  assert.equal((await request(app).get('/api/v1/reports/summary?from=2026-02-01&to=2026-01-01').set(auth(owner.token))).status, 400);
});

test('ticket audit records share the existing AuditEvent stream and support authorised filters', async () => {
  const owner = await ownerFor('audit');
  const employee = await member(owner, 'employee');
  const foreignOwner = await ownerFor('foreignaudit');
  const ticket = await request(app).post('/api/v1/tickets').set(auth(employee.token)).send({ title: 'Audit trail ticket', description: 'An audit record should be stored for this ticket.', category: 'Software' });
  assert.equal(ticket.status, 201);
  await request(app).post(`/api/v1/tickets/${ticket.body.ticket.id}/comments`).set(auth(employee.token)).send({ message: 'Please check the logs.' });
  const ticketAudit = await request(app).get('/api/v1/organisations/audit-events?category=Ticket&q=Audit%20trail').set(auth(owner.token));
  assert.equal(ticketAudit.status, 200);
  assert.ok(ticketAudit.body.events.some((event) => event.action === 'TICKET_CREATED'));
  const commentAudit = await request(app).get('/api/v1/organisations/audit-events?action=TICKET_PUBLIC_COMMENT_ADDED').set(auth(owner.token));
  assert.equal(commentAudit.body.events.length, 1);
  assert.equal(commentAudit.body.events[0].metadata.visibility, 'PUBLIC');
  assert.equal((await request(app).get('/api/v1/organisations/audit-events?q=Audit%20trail').set(auth(foreignOwner.token))).body.events.length, 0);
  assert.equal((await request(app).get('/api/v1/organisations/audit-events?category=bogus').set(auth(owner.token))).status, 400);
  assert.equal((await request(app).get('/api/v1/organisations/audit-events').set(auth(employee.token))).status, 403);
  assert.equal(await AuditEvent.countDocuments({ organisationId: owner.orgId, targetType: 'Ticket' }), 2);
});

test('Swagger documents all Knowledge Base, report and audit query APIs with bearer security', () => {
  const spec = require('../src/openapi');
  const documented = [
    ['/api/v1/knowledge-base/articles', 'get'], ['/api/v1/knowledge-base/articles', 'post'],
    ['/api/v1/knowledge-base/articles/{articleId}', 'get'], ['/api/v1/knowledge-base/articles/{articleId}', 'patch'], ['/api/v1/knowledge-base/articles/{articleId}', 'delete'],
    ['/api/v1/reports/summary', 'get'], ['/api/v1/organisations/audit-events', 'get'],
  ];
  for (const [path, method] of documented) {
    assert.ok(spec.paths[path]?.[method], `${method.toUpperCase()} ${path} missing from Swagger`);
    assert.deepEqual(spec.paths[path][method].security, [{ bearerAuth: [] }]);
    assert.ok(Object.keys(spec.paths[path][method].responses).length >= 2);
  }
  for (const schema of ['KnowledgeArticle', 'KnowledgeArticleCreateRequest', 'KnowledgeArticleListResponse', 'ReportSummaryResponse', 'AuditEventListResponse']) assert.ok(spec.components.schemas[schema]);
});
