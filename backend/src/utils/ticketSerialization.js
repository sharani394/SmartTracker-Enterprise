const PRIORITY_TO_API = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' };
const STATUS_TO_API = {
  OPEN: 'Open', ASSIGNED: 'Assigned', IN_PROGRESS: 'In Progress', ON_HOLD: 'On Hold', RESOLVED: 'Resolved',
};
const ACCEPTANCE_TO_API = {
  NOT_ASSIGNED: 'Not Assigned', PENDING: 'Pending', ACCEPTED: 'Accepted', REJECTED: 'Rejected',
};

function serializeComment(comment) {
  return {
    id: String(comment._id),
    author: comment.authorName,
    authorRole: comment.authorRole,
    message: comment.message,
    createdAt: comment.createdAt,
    isInternal: comment.visibility === 'INTERNAL',
  };
}

function serializeTicket(ticket, comments = null) {
  const output = {
    id: String(ticket._id),
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    description: ticket.description,
    category: ticket.category,
    priority: PRIORITY_TO_API[ticket.priority],
    status: STATUS_TO_API[ticket.status],
    employeeEmail: ticket.employeeEmail,
    employeeName: ticket.employeeName,
    department: ticket.departmentName || '',
    departmentId: ticket.departmentId ? String(ticket.departmentId) : null,
    agentEmail: ticket.assignedAgentEmail || '',
    agentName: ticket.assignedAgentName || '',
    assignedAgentId: ticket.assignedAgentId ? String(ticket.assignedAgentId) : null,
    acceptance: ACCEPTANCE_TO_API[ticket.acceptance],
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };

  if (comments) {
    output.comments = comments.filter((item) => item.visibility === 'PUBLIC').map(serializeComment);
    output.internalNotes = comments.filter((item) => item.visibility === 'INTERNAL').map(serializeComment);
  }
  return output;
}

function serializeActivity(event) {
  return {
    id: String(event._id),
    actorId: String(event.actorId),
    actor: event.actorName,
    actorRole: event.actorRole,
    action: event.action,
    visibility: event.visibility,
    details: event.details,
    createdAt: event.createdAt,
  };
}

function serializeNotification(notification) {
  return {
    id: String(notification._id),
    ticketId: String(notification.ticketId),
    type: notification.type,
    title: notification.title,
    message: notification.message,
    read: Boolean(notification.readAt),
    createdAt: notification.createdAt,
  };
}

module.exports = { serializeTicket, serializeComment, serializeActivity, serializeNotification };
