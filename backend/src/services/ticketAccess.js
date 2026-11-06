const { AppError } = require('../middleware/errorHandler');
const { hasPermission } = require('../middleware/accessControl');

function canManageTickets(auth) {
  return hasPermission(auth, 'tickets:manage');
}

function canReadOrganisationTickets(auth) {
  return hasPermission(auth, 'tickets:read') || hasPermission(auth, 'tickets:manage');
}

function canAccessTicket(auth, ticket) {
  if (!auth || !ticket || String(auth.organisationId) !== String(ticket.organisationId)) return false;
  if (auth.role === 'EMPLOYEE') return String(ticket.createdById) === String(auth.user._id);
  if (auth.role === 'SUPPORT_AGENT') return String(ticket.assignedAgentId || '') === String(auth.user._id);
  return canReadOrganisationTickets(auth);
}

function assertTicketAccess(auth, ticket) {
  if (!ticket || String(auth.organisationId) !== String(ticket.organisationId)) {
    throw new AppError('Ticket was not found in your organisation.', 404, 'TICKET_NOT_FOUND');
  }
  if (!canAccessTicket(auth, ticket)) {
    if (auth.role === 'EMPLOYEE' || auth.role === 'SUPPORT_AGENT') {
      throw new AppError('Ticket was not found in your accessible tickets.', 404, 'TICKET_NOT_FOUND');
    }
    throw new AppError('You do not have access to this ticket.', 403, 'FORBIDDEN');
  }
}

function assertTicketManager(auth) {
  if (!canManageTickets(auth)) {
    throw new AppError('tickets:manage permission is required.', 403, 'FORBIDDEN');
  }
}

module.exports = { canManageTickets, canReadOrganisationTickets, canAccessTicket, assertTicketAccess, assertTicketManager };
