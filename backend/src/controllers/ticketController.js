const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const TicketComment = require('../models/TicketComment');
const TicketActivity = require('../models/TicketActivity');
const Department = require('../models/Department');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { hasPermission } = require('../middleware/accessControl');
const { assertTicketAccess, assertTicketManager } = require('../services/ticketAccess');
const { recordTicketActivity, createTicketNotifications } = require('../services/ticketEvents');
const { recordAudit } = require('../services/auditService');
const {
  serializeTicket, serializeComment, serializeActivity,
} = require('../utils/ticketSerialization');

const PRIORITY_MAP = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL' };
const STATUS_MAP = {
  OPEN: 'OPEN', ASSIGNED: 'ASSIGNED', 'IN PROGRESS': 'IN_PROGRESS', IN_PROGRESS: 'IN_PROGRESS',
  'ON HOLD': 'ON_HOLD', ON_HOLD: 'ON_HOLD', RESOLVED: 'RESOLVED',
};
const ACCEPTED_STATUSES = new Set(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED']);
const PRIORITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const AGENT_STATUSES = {
  IN_PROGRESS: ['ON_HOLD', 'RESOLVED'],
  ON_HOLD: ['IN_PROGRESS', 'RESOLVED'],
};
const ADMIN_STATUSES = {
  OPEN: ['RESOLVED'],
  ASSIGNED: ['OPEN'],
  IN_PROGRESS: ['ON_HOLD', 'RESOLVED', 'OPEN'],
  ON_HOLD: ['IN_PROGRESS', 'RESOLVED', 'OPEN'],
  RESOLVED: ['OPEN'],
};

function normalizeStatus(value) {
  const key = String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  return STATUS_MAP[key];
}

function normalizePriority(value) {
  return PRIORITY_MAP[String(value || '').trim().toUpperCase()];
}

function humanStatus(status) {
  return ({ OPEN: 'Open', ASSIGNED: 'Assigned', IN_PROGRESS: 'In Progress', ON_HOLD: 'On Hold', RESOLVED: 'Resolved' })[status];
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getTicketQuery(auth) {
  const query = { organisationId: auth.organisationId };
  if (auth.role === 'EMPLOYEE') query.createdById = auth.user._id;
  else if (auth.role === 'SUPPORT_AGENT') query.assignedAgentId = auth.user._id;
  else if (!hasPermission(auth, 'tickets:read') && !hasPermission(auth, 'tickets:manage')) {
    throw new AppError('tickets:read permission is required.', 403, 'FORBIDDEN');
  }
  return query;
}

function canSeeInternal(auth, ticket) {
  if (auth.role === 'SUPPORT_AGENT') return String(ticket.assignedAgentId || '') === String(auth.user._id);
  return hasPermission(auth, 'tickets:read') || hasPermission(auth, 'tickets:manage');
}

async function findAccessibleTicket(req) {
  if (!mongoose.isValidObjectId(req.params.ticketId)) {
    throw new AppError('Ticket was not found in your organisation.', 404, 'TICKET_NOT_FOUND');
  }
  const ticket = await Ticket.findOne({ _id: req.params.ticketId, organisationId: req.auth.organisationId });
  assertTicketAccess(req.auth, ticket);
  return ticket;
}

async function findTicketForManager(req) {
  assertTicketManager(req.auth);
  return findAccessibleTicket(req);
}

async function createTicket(req, res) {
  if (req.auth.role !== 'EMPLOYEE') {
    throw new AppError('Only active Employees can submit tickets.', 403, 'FORBIDDEN');
  }

  const priority = normalizePriority(req.body.priority || 'Medium');
  if (!PRIORITIES.has(priority)) throw new AppError('Priority is invalid.', 400, 'INVALID_PRIORITY');

  let departmentId = null;
  let departmentName = String(req.body.department || '').trim();
  if (req.body.departmentId) {
    const department = await Department.findOne({
      _id: req.body.departmentId,
      organisationId: req.auth.organisationId,
      status: 'ACTIVE',
    });
    if (!department) throw new AppError('Department was not found in your organisation.', 404, 'DEPARTMENT_NOT_FOUND');
    departmentId = department._id;
    departmentName = department.name;
  } else if (departmentName) {
    const department = await Department.findOne({
      organisationId: req.auth.organisationId,
      nameKey: departmentName.toLocaleLowerCase(),
      status: 'ACTIVE',
    });
    if (department) {
      departmentId = department._id;
      departmentName = department.name;
    }
  }

  const ticket = await Ticket.create({
    organisationId: req.auth.organisationId,
    ticketNumber: `ST-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
    title: req.body.title,
    description: req.body.description,
    category: req.body.category,
    priority,
    status: 'OPEN',
    acceptance: 'NOT_ASSIGNED',
    createdById: req.auth.user._id,
    employeeName: req.auth.user.fullName,
    employeeEmail: req.auth.user.email,
    departmentId,
    departmentName,
  });

  await recordTicketActivity(req, ticket, {
    action: 'TICKET_CREATED',
    details: { ticketNumber: ticket.ticketNumber },
  });
  await recordAudit(req, {
    action: 'TICKET_CREATED',
    targetType: 'Ticket',
    targetId: ticket._id,
    metadata: { ticketNumber: ticket.ticketNumber, title: ticket.title, priority: ticket.priority, category: ticket.category },
  });
  await createTicketNotifications(req, ticket, [{
    recipientId: req.auth.user._id,
    type: 'TICKET_CREATED',
    title: 'Ticket created',
    message: `Your ticket ${ticket.ticketNumber} has been submitted.`,
    notifyActor: true,
  }]);

  return res.status(201).json({ ticket: serializeTicket(ticket) });
}

async function listTickets(req, res) {
  const filter = getTicketQuery(req.auth);
  if (req.query.status) {
    const status = normalizeStatus(req.query.status);
    if (!ACCEPTED_STATUSES.has(status)) throw new AppError('Ticket status filter is invalid.', 400, 'INVALID_STATUS');
    filter.status = status;
  }
  if (req.query.priority) {
    const priority = normalizePriority(req.query.priority);
    if (!PRIORITIES.has(priority)) throw new AppError('Priority filter is invalid.', 400, 'INVALID_PRIORITY');
    filter.priority = priority;
  }
  if (req.query.category) filter.category = req.query.category;
  if (req.query.assignedAgentId) {
    if (req.auth.role === 'EMPLOYEE' || req.auth.role === 'SUPPORT_AGENT') {
      throw new AppError('Only ticket administrators can filter by assigned agent.', 403, 'FORBIDDEN');
    }
    filter.assignedAgentId = req.query.assignedAgentId;
  }
  if (req.query.q) {
    const expression = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
    filter.$or = [
      { ticketNumber: expression }, { title: expression }, { description: expression }, { departmentName: expression },
    ];
  }

  const page = Number.parseInt(req.query.page || '1', 10);
  const limit = Number.parseInt(req.query.limit || '20', 10);
  const sortBy = req.query.sortBy || 'createdAt';
  const direction = req.query.order === 'asc' ? 1 : -1;
  const sort = { [sortBy]: direction };
  if (sortBy !== 'createdAt') sort.createdAt = -1;
  const [tickets, total] = await Promise.all([
    Ticket.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
    Ticket.countDocuments(filter),
  ]);
  return res.json({
    tickets: tickets.map((ticket) => serializeTicket(ticket)),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

async function getTicket(req, res) {
  const ticket = await findAccessibleTicket(req);
  const commentFilter = { organisationId: req.auth.organisationId, ticketId: ticket._id };
  if (!canSeeInternal(req.auth, ticket)) commentFilter.visibility = 'PUBLIC';
  const comments = await TicketComment.find(commentFilter).sort({ createdAt: 1 });
  return res.json({ ticket: serializeTicket(ticket, comments) });
}

async function assignTicket(req, res) {
  const ticket = await findTicketForManager(req);
  const agent = await User.findOne({
    _id: req.body.agentId,
    organisationId: req.auth.organisationId,
    role: 'SUPPORT_AGENT',
    status: 'ACTIVE',
    emailVerifiedAt: { $ne: null },
  });
  if (!agent) throw new AppError('Active Support Agent was not found in your organisation.', 404, 'AGENT_NOT_FOUND');
  if (String(ticket.assignedAgentId || '') === String(agent._id)) {
    throw new AppError('Ticket is already assigned to this Support Agent.', 409, 'ALREADY_ASSIGNED');
  }
  if (ticket.status === 'RESOLVED') {
    throw new AppError('Reopen a resolved ticket before assigning it.', 409, 'INVALID_TICKET_STATE');
  }

  const previousAgentId = ticket.assignedAgentId;
  const update = await Ticket.findOneAndUpdate({
    _id: ticket._id,
    organisationId: req.auth.organisationId,
    updatedAt: ticket.updatedAt,
    status: { $in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'] },
  }, { $set: {
    assignedAgentId: agent._id,
    assignedAgentName: agent.fullName,
    assignedAgentEmail: agent.email,
    assignedById: req.auth.user._id,
    acceptance: 'PENDING',
    status: 'ASSIGNED',
    rejectionReason: '',
  } }, { new: true, runValidators: true });
  if (!update) throw new AppError('Ticket changed during assignment. Refresh and retry.', 409, 'TICKET_CONFLICT');

  const reassigned = Boolean(previousAgentId);
  await recordTicketActivity(req, update, {
    action: reassigned ? 'TICKET_REASSIGNED' : 'TICKET_ASSIGNED',
    details: {
      previousAgentId: previousAgentId ? String(previousAgentId) : null,
      assignedAgentId: String(agent._id),
    },
  });
  await recordAudit(req, {
    action: reassigned ? 'TICKET_REASSIGNED' : 'TICKET_ASSIGNED',
    targetType: 'Ticket',
    targetId: update._id,
    metadata: { assignedAgentId: String(agent._id), previousAgentId: previousAgentId ? String(previousAgentId) : null },
  });
  await createTicketNotifications(req, update, [
    {
      recipientId: agent._id,
      type: reassigned ? 'TICKET_REASSIGNED' : 'TICKET_ASSIGNED',
      title: reassigned ? 'Ticket reassigned to you' : 'New ticket assigned',
      message: `Ticket ${update.ticketNumber} has been assigned to you.`,
    },
    {
      recipientId: update.createdById,
      type: reassigned ? 'TICKET_REASSIGNED' : 'TICKET_ASSIGNED',
      title: 'Ticket assignment updated',
      message: `${update.ticketNumber} has been assigned to a Support Agent.`,
    },
    ...(previousAgentId ? [{
      recipientId: previousAgentId,
      type: 'TICKET_REASSIGNED',
      title: 'Ticket assignment changed',
      message: `Ticket ${update.ticketNumber} is no longer assigned to you.`,
    }] : []),
  ]);
  return res.json({ ticket: serializeTicket(update) });
}

async function unassignTicket(req, res) {
  const ticket = await findTicketForManager(req);
  if (!ticket.assignedAgentId) throw new AppError('Ticket is not currently assigned.', 409, 'NOT_ASSIGNED');
  if (ticket.status === 'RESOLVED') throw new AppError('Resolved ticket is already closed.', 409, 'INVALID_TICKET_STATE');

  const previousAgentId = ticket.assignedAgentId;
  const update = await Ticket.findOneAndUpdate({
    _id: ticket._id,
    organisationId: req.auth.organisationId,
    assignedAgentId: previousAgentId,
    updatedAt: ticket.updatedAt,
    status: { $in: ['ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'] },
  }, { $set: {
    assignedAgentId: null,
    assignedAgentName: '',
    assignedAgentEmail: '',
    assignedById: null,
    acceptance: 'NOT_ASSIGNED',
    status: 'OPEN',
  } }, { new: true });
  if (!update) throw new AppError('Ticket changed during unassignment. Refresh and retry.', 409, 'TICKET_CONFLICT');

  await recordTicketActivity(req, update, { action: 'TICKET_UNASSIGNED', details: { previousAgentId: String(previousAgentId) } });
  await recordAudit(req, { action: 'TICKET_UNASSIGNED', targetType: 'Ticket', targetId: update._id, metadata: { previousAgentId: String(previousAgentId) } });
  await createTicketNotifications(req, update, [
    { recipientId: previousAgentId, type: 'TICKET_REASSIGNED', title: 'Ticket assignment changed', message: `${update.ticketNumber} is no longer assigned to you.` },
    { recipientId: update.createdById, type: 'TICKET_REASSIGNED', title: 'Ticket assignment updated', message: `${update.ticketNumber} is awaiting reassignment.` },
  ]);
  return res.json({ ticket: serializeTicket(update) });
}

async function respondToAssignment(req, res) {
  if (req.auth.role !== 'SUPPORT_AGENT') throw new AppError('Only the assigned Support Agent can respond to an assignment.', 403, 'FORBIDDEN');
  const ticket = await findAccessibleTicket(req);
  if (String(ticket.assignedAgentId || '') !== String(req.auth.user._id) || ticket.acceptance !== 'PENDING' || ticket.status !== 'ASSIGNED') {
    throw new AppError('There is no pending assignment for this ticket.', 409, 'ASSIGNMENT_NOT_PENDING');
  }
  const accepted = req.body.decision === 'ACCEPT';
  const assigningAdminId = ticket.assignedById;
  const update = await Ticket.findOneAndUpdate({
    _id: ticket._id,
    organisationId: req.auth.organisationId,
    assignedAgentId: req.auth.user._id,
    acceptance: 'PENDING',
    status: 'ASSIGNED',
    updatedAt: ticket.updatedAt,
  }, { $set: accepted ? {
    acceptance: 'ACCEPTED', status: 'IN_PROGRESS', rejectionReason: '',
  } : {
    acceptance: 'REJECTED', status: 'OPEN', assignedAgentId: null,
    assignedAgentName: '', assignedAgentEmail: '', assignedById: null, rejectionReason: req.body.reason.trim(),
  } }, { new: true });
  if (!update) throw new AppError('Assignment changed before your response was saved.', 409, 'TICKET_CONFLICT');

  const action = accepted ? 'TICKET_ACCEPTED' : 'TICKET_REJECTED';
  await recordTicketActivity(req, update, {
    action,
    details: accepted ? {} : { reason: req.body.reason.trim() },
  });
  const recipients = [{
    recipientId: update.createdById,
    type: accepted ? 'TICKET_ACCEPTED' : 'TICKET_REJECTED',
    title: accepted ? 'Ticket accepted' : 'Ticket assignment declined',
    message: accepted
      ? `A Support Agent has accepted ${update.ticketNumber}.`
      : `The assignment for ${update.ticketNumber} was declined. It is awaiting reassignment.`,
  }];
  if (assigningAdminId) recipients.push({
    recipientId: assigningAdminId,
    type: accepted ? 'TICKET_ACCEPTED' : 'TICKET_REJECTED',
    title: accepted ? 'Ticket accepted' : 'Ticket assignment declined',
    message: accepted ? `${update.ticketNumber} was accepted.` : `${update.ticketNumber} was declined and needs reassignment.`,
  });
  await createTicketNotifications(req, update, recipients);
  await recordAudit(req, { action, targetType: 'Ticket', targetId: update._id, metadata: { decision: req.body.decision } });
  return res.json({ ticket: serializeTicket(update) });
}

async function changeStatus(req, res) {
  const ticket = await findAccessibleTicket(req);
  const nextStatus = normalizeStatus(req.body.status);
  if (!ACCEPTED_STATUSES.has(nextStatus)) throw new AppError('Ticket status is invalid.', 400, 'INVALID_STATUS');
  if (ticket.status === nextStatus) return res.json({ ticket: serializeTicket(ticket) });

  const isManager = hasPermission(req.auth, 'tickets:manage');
  const isAssignedAgent = req.auth.role === 'SUPPORT_AGENT'
    && String(ticket.assignedAgentId || '') === String(req.auth.user._id);
  if (!isManager && !isAssignedAgent) throw new AppError('tickets:manage permission is required.', 403, 'FORBIDDEN');

  if (isAssignedAgent && ticket.acceptance !== 'ACCEPTED') {
    throw new AppError('Accept this assignment before changing ticket status.', 409, 'ASSIGNMENT_NOT_ACCEPTED');
  }
  if (isAssignedAgent && !AGENT_STATUSES[ticket.status]?.includes(nextStatus)) {
    throw new AppError(`Transition from ${humanStatus(ticket.status)} to ${humanStatus(nextStatus)} is not allowed.`, 409, 'INVALID_STATUS_TRANSITION');
  }
  if (isManager && !ADMIN_STATUSES[ticket.status]?.includes(nextStatus)) {
    throw new AppError(`Transition from ${humanStatus(ticket.status)} to ${humanStatus(nextStatus)} is not allowed.`, 409, 'INVALID_STATUS_TRANSITION');
  }

  const set = { status: nextStatus };
  if (nextStatus === 'OPEN') {
    set.assignedAgentId = null;
    set.assignedAgentName = '';
    set.assignedAgentEmail = '';
    set.assignedById = null;
    set.acceptance = 'NOT_ASSIGNED';
    set.rejectionReason = '';
  }
  if (nextStatus === 'RESOLVED') set.resolvedAt = new Date();
  else set.resolvedAt = null;

  const update = await Ticket.findOneAndUpdate({
    _id: ticket._id,
    organisationId: req.auth.organisationId,
    status: ticket.status,
    updatedAt: ticket.updatedAt,
  }, { $set: set }, { new: true, runValidators: true });
  if (!update) throw new AppError('Ticket changed before the status update was saved.', 409, 'TICKET_CONFLICT');

  await recordTicketActivity(req, update, {
    action: 'TICKET_STATUS_CHANGED',
    details: { from: humanStatus(ticket.status), to: humanStatus(nextStatus) },
  });
  await recordAudit(req, {
    action: 'TICKET_STATUS_CHANGED',
    targetType: 'Ticket',
    targetId: update._id,
    metadata: { from: humanStatus(ticket.status), to: humanStatus(nextStatus) },
  });
  const recipients = [{
    recipientId: ticket.createdById,
    type: 'TICKET_STATUS_CHANGED',
    title: 'Ticket status updated',
    message: `${update.ticketNumber} is now ${humanStatus(nextStatus)}.`,
  }];
  if (ticket.assignedAgentId) recipients.push({
    recipientId: ticket.assignedAgentId,
    type: 'TICKET_STATUS_CHANGED',
    title: 'Ticket status updated',
    message: `${update.ticketNumber} is now ${humanStatus(nextStatus)}.`,
  });
  await createTicketNotifications(req, update, recipients);
  return res.json({ ticket: serializeTicket(update) });
}

async function changePriority(req, res) {
  const ticket = await findTicketForManager(req);
  const priority = normalizePriority(req.body.priority);
  if (!PRIORITIES.has(priority)) throw new AppError('Priority is invalid.', 400, 'INVALID_PRIORITY');
  if (ticket.priority === priority) return res.json({ ticket: serializeTicket(ticket) });

  const previous = ticket.priority;
  const update = await Ticket.findOneAndUpdate({
    _id: ticket._id,
    organisationId: req.auth.organisationId,
    updatedAt: ticket.updatedAt,
  }, { $set: { priority } }, { new: true, runValidators: true });
  if (!update) throw new AppError('Ticket changed before the priority update was saved.', 409, 'TICKET_CONFLICT');
  await recordTicketActivity(req, update, { action: 'TICKET_PRIORITY_CHANGED', details: { from: previous, to: priority } });
  await recordAudit(req, { action: 'TICKET_PRIORITY_CHANGED', targetType: 'Ticket', targetId: update._id, metadata: { from: previous, to: priority } });
  await createTicketNotifications(req, update, [
    { recipientId: update.createdById, type: 'TICKET_STATUS_CHANGED', title: 'Ticket priority updated', message: `Priority for ${update.ticketNumber} changed to ${priority.toLowerCase()}.` },
    ...(update.assignedAgentId ? [{ recipientId: update.assignedAgentId, type: 'TICKET_STATUS_CHANGED', title: 'Ticket priority updated', message: `Priority for ${update.ticketNumber} changed to ${priority.toLowerCase()}.` }] : []),
  ]);
  return res.json({ ticket: serializeTicket(update) });
}

async function listComments(req, res) {
  const ticket = await findAccessibleTicket(req);
  const filter = { organisationId: req.auth.organisationId, ticketId: ticket._id };
  if (!canSeeInternal(req.auth, ticket)) filter.visibility = 'PUBLIC';
  const page = Number.parseInt(req.query.page || '1', 10);
  const limit = Number.parseInt(req.query.limit || '100', 10);
  const [comments, total] = await Promise.all([
    TicketComment.find(filter).sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit),
    TicketComment.countDocuments(filter),
  ]);
  return res.json({
    comments: comments.map(serializeComment),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

async function addComment(req, res) {
  const ticket = await findAccessibleTicket(req);
  const isInternal = req.body.isInternal === true;
  if (isInternal && !canSeeInternal(req.auth, ticket)) {
    throw new AppError('Only assigned Support Agents or ticket staff may add internal notes.', 403, 'FORBIDDEN');
  }

  const comment = await TicketComment.create({
    organisationId: req.auth.organisationId,
    ticketId: ticket._id,
    authorId: req.auth.user._id,
    authorName: req.auth.user.fullName,
    authorRole: req.auth.role,
    message: req.body.message,
    visibility: isInternal ? 'INTERNAL' : 'PUBLIC',
  });
  await recordTicketActivity(req, ticket, {
    action: isInternal ? 'INTERNAL_NOTE_ADDED' : 'PUBLIC_COMMENT_ADDED',
    visibility: isInternal ? 'INTERNAL' : 'PUBLIC',
    details: { commentId: String(comment._id) },
  });

  const recipients = [];
  if (isInternal) {
    const staffRecipient = req.auth.role === 'SUPPORT_AGENT' ? ticket.assignedById : ticket.assignedAgentId;
    if (staffRecipient) recipients.push({
      recipientId: staffRecipient,
      type: 'TICKET_COMMENT',
      title: 'New internal note',
      message: `There is a new internal note on ${ticket.ticketNumber}.`,
    });
  } else {
    if (String(ticket.createdById) !== String(req.auth.user._id)) recipients.push({
      recipientId: ticket.createdById,
      type: 'TICKET_COMMENT',
      title: 'New ticket comment',
      message: `There is a new comment on ${ticket.ticketNumber}.`,
    });
    if (ticket.assignedAgentId && String(ticket.assignedAgentId) !== String(req.auth.user._id)) recipients.push({
      recipientId: ticket.assignedAgentId,
      type: 'TICKET_COMMENT',
      title: 'New ticket comment',
      message: `There is a new comment on ${ticket.ticketNumber}.`,
    });
    if (ticket.assignedById && String(ticket.assignedById) !== String(req.auth.user._id)) recipients.push({
      recipientId: ticket.assignedById,
      type: 'TICKET_COMMENT',
      title: 'New ticket comment',
      message: `There is a new comment on ${ticket.ticketNumber}.`,
    });
  }
  await createTicketNotifications(req, ticket, recipients);
  await recordAudit(req, {
    action: isInternal ? 'TICKET_INTERNAL_NOTE_ADDED' : 'TICKET_PUBLIC_COMMENT_ADDED',
    targetType: 'Ticket',
    targetId: ticket._id,
    metadata: { commentId: String(comment._id), visibility: isInternal ? 'INTERNAL' : 'PUBLIC' },
  });
  return res.status(201).json({ comment: serializeComment(comment) });
}

async function listActivity(req, res) {
  const ticket = await findAccessibleTicket(req);
  const filter = { organisationId: req.auth.organisationId, ticketId: ticket._id };
  if (!canSeeInternal(req.auth, ticket)) filter.visibility = 'PUBLIC';
  const page = Number.parseInt(req.query.page || '1', 10);
  const limit = Number.parseInt(req.query.limit || '50', 10);
  const [events, total] = await Promise.all([
    TicketActivity.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    TicketActivity.countDocuments(filter),
  ]);
  return res.json({
    activities: events.map(serializeActivity),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

module.exports = {
  createTicket,
  listTickets,
  getTicket,
  assignTicket,
  unassignTicket,
  respondToAssignment,
  changeStatus,
  changePriority,
  listComments,
  addComment,
  listActivity,
};
