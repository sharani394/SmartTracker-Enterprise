jest.mock('../AuthContext', () => ({ useAuth: () => ({ user: { id: 'employee-1', role: 'EMPLOYEE' } }) }));
jest.mock('../../services/ticketService', () => ({ ticketService: { list: jest.fn(), create: jest.fn() } }));
jest.mock('../../services/notificationService', () => ({ notificationService: { list: jest.fn() } }));

import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { TicketProvider, useTickets } from '../TicketContext';
import { ticketService } from '../../services/ticketService';
import { notificationService } from '../../services/notificationService';

const wrapper = ({ children }) => <TicketProvider>{children}</TicketProvider>;

describe('TicketContext API-backed state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notificationService.list.mockResolvedValue({ notifications: [] });
  });

  test('shows API failures and does not substitute demo tickets', async () => {
    ticketService.list.mockRejectedValue(new Error('Unable to reach SmartTracker'));
    const { result } = renderHook(() => useTickets(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tickets).toEqual([]);
    expect(result.current.error.message).toBe('Unable to reach SmartTracker');
  });

  test('adds a ticket returned by the real service after creation', async () => {
    ticketService.list.mockResolvedValue({ tickets: [], pagination: { totalPages: 1 } });
    const createdTicket = { id: 'ticket-1', title: 'Laptop issue', ticketNumber: 'ST-TEST' };
    ticketService.create.mockResolvedValue({ ticket: createdTicket });
    const { result } = renderHook(() => useTickets(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createTicket({ title: 'Laptop issue', description: 'Screen stays black', category: 'Hardware', priority: 'High' });
    });

    expect(ticketService.create).toHaveBeenCalledWith({ title: 'Laptop issue', description: 'Screen stays black', category: 'Hardware', priority: 'High' });
    expect(result.current.tickets).toEqual([createdTicket]);
  });
});
