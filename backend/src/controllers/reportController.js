const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const { AppError } = require('../middleware/errorHandler');

const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
function isoRange(value, name) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError(`${name} must be a valid date.`, 400, 'INVALID_DATE_RANGE');
  return date;
}
function bucketFormat(start, end) {
  const days = (end - start) / 86400000;
  if (days <= 31) return '%Y-%m-%d';
  if (days <= 180) return '%G-W%V';
  return '%Y-%m';
}
async function getSummary(req, res) {
  const now = new Date();
  const to = isoRange(req.query.to, 'to') || now;
  const from = isoRange(req.query.from, 'from') || new Date(to.getTime() - 30 * 86400000);
  if (from > to) throw new AppError('from must be earlier than or equal to to.', 400, 'INVALID_DATE_RANGE');
  const organisationId = new mongoose.Types.ObjectId(String(req.auth.organisationId));
  const rangeMatch = { organisationId, createdAt: { $gte: from, $lte: to } };
  const resolvedMatch = { organisationId, status: 'RESOLVED', resolvedAt: { $gte: from, $lte: to } };
  const [statusGroups, priorityGroups, departmentGroups, agentGroups, resolution, trends] = await Promise.all([
    Ticket.aggregate([{ $match: rangeMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Ticket.aggregate([{ $match: rangeMatch }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
    Ticket.aggregate([{ $match: rangeMatch }, { $group: { _id: { $cond: [{ $eq: ['$departmentName', ''] }, 'Unassigned', '$departmentName'] }, count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }]),
    Ticket.aggregate([
      { $match: { ...rangeMatch, assignedAgentId: { $ne: null } } },
      { $group: { _id: '$assignedAgentId', name: { $last: '$assignedAgentName' }, email: { $last: '$assignedAgentEmail' }, assigned: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] } }, averageResolutionMs: { $avg: { $cond: [{ $and: [{ $eq: ['$status', 'RESOLVED'] }, { $ne: ['$resolvedAt', null] }] }, { $subtract: ['$resolvedAt', '$createdAt'] }, null] } } } },
      { $sort: { assigned: -1, name: 1 } },
    ]),
    Ticket.aggregate([
      { $match: resolvedMatch },
      { $group: { _id: null, resolved: { $sum: 1 }, averageResolutionMs: { $avg: { $subtract: ['$resolvedAt', '$createdAt'] } }, totalResolutionMs: { $sum: { $subtract: ['$resolvedAt', '$createdAt'] } } } },
    ]),
    Ticket.aggregate([
      { $match: rangeMatch },
      { $group: { _id: { $dateToString: { format: bucketFormat(from, to), date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] } } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  const counts = (groups, keys) => Object.fromEntries(keys.map((key) => [key, groups.find((item) => item._id === key)?.count || 0]));
  const total = statusGroups.reduce((sum, item) => sum + item.count, 0);
  const resolvedInCreatedRange = statusGroups.find((item) => item._id === 'RESOLVED')?.count || 0;
  const resolutionData = resolution[0] || { resolved: 0, averageResolutionMs: null, totalResolutionMs: 0 };
  return res.json({
    range: { from, to }, totals: { tickets: total, resolved: resolvedInCreatedRange, open: total - resolvedInCreatedRange },
    statusCounts: counts(statusGroups, STATUSES), priorityCounts: counts(priorityGroups, PRIORITIES),
    departmentCounts: departmentGroups.map((item) => ({ department: item._id || 'Unassigned', count: item.count })),
    agentPerformance: agentGroups.map((item) => ({ agentId: String(item._id), name: item.name, email: item.email, assigned: item.assigned, resolved: item.resolved, averageResolutionMinutes: item.averageResolutionMs === null ? null : Math.round(item.averageResolutionMs / 60000) })),
    resolution: { resolvedInRange: resolutionData.resolved, averageMinutes: resolutionData.averageResolutionMs === null ? null : Math.round(resolutionData.averageResolutionMs / 60000), totalMinutes: Math.round((resolutionData.totalResolutionMs || 0) / 60000) },
    trends: trends.map((item) => ({ period: item._id, created: item.count, currentlyResolved: item.resolved })),
  });
}
module.exports = { getSummary };
