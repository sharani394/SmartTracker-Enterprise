jest.mock('../apiClient', () => ({ apiRequest: jest.fn() }));

import { apiRequest } from '../apiClient';
import { ticketService } from '../ticketService';

describe('ticket service API integration', () => {
  beforeEach(() => jest.clearAllMocks());

  test('lists tickets with encoded pagination, search and status filters', async () => {
    apiRequest.mockResolvedValue({ tickets: [], pagination: { page: 2, totalPages: 2 } });
    await expect(ticketService.list({ page: 2, limit: 20, q: 'wifi issue', status: 'In Progress' }))
      .resolves.toMatchObject({ pagination: { totalPages: 2 } });
    expect(apiRequest).toHaveBeenCalledWith('tickets?page=2&limit=20&q=wifi%20issue&status=In%20Progress');
  });

  test('creates a ticket with the backend request shape and propagates API errors', async () => {
    const payload = { title: 'Laptop issue', description: 'Will not start', category: 'Hardware', priority: 'High' };
    apiRequest.mockResolvedValueOnce({ ticket: { id: 'ticket-1', ...payload } });
    await expect(ticketService.create(payload)).resolves.toMatchObject({ ticket: { id: 'ticket-1' } });
    expect(apiRequest).toHaveBeenCalledWith('tickets', { method: 'POST', body: payload });

    const apiError = Object.assign(new Error('Ticket access denied'), { status: 403, code: 'FORBIDDEN' });
    apiRequest.mockRejectedValueOnce(apiError);
    await expect(ticketService.get('ticket-1')).rejects.toBe(apiError);
  });

  test('uses the backend assignment, transition, comment and activity routes', async () => {
    apiRequest.mockResolvedValue({ ticket: { id: 'ticket-1' }, comment: { id: 'comment-1' }, events: [] });
    await ticketService.assign('ticket-1', 'agent-1');
    expect(apiRequest).toHaveBeenLastCalledWith('tickets/ticket-1/assignment', { method: 'PUT', body: { agentId: 'agent-1' } });
    await ticketService.respondToAssignment('ticket-1', 'REJECT', 'Out of office');
    expect(apiRequest).toHaveBeenLastCalledWith('tickets/ticket-1/assignment-response', { method: 'PUT', body: { decision: 'REJECT', reason: 'Out of office' } });
    await ticketService.updateStatus('ticket-1', 'Resolved');
    expect(apiRequest).toHaveBeenLastCalledWith('tickets/ticket-1/status', { method: 'PATCH', body: { status: 'Resolved' } });
    await ticketService.addComment('ticket-1', 'Investigating', true);
    expect(apiRequest).toHaveBeenLastCalledWith('tickets/ticket-1/comments', { method: 'POST', body: { message: 'Investigating', isInternal: true } });
    await ticketService.listActivity('ticket-1', { limit: 10 });
    expect(apiRequest).toHaveBeenLastCalledWith('tickets/ticket-1/activity?limit=10');
  });
});
