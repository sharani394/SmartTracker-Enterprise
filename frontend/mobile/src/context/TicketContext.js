import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { ticketService } from '../services/ticketService';
import { notificationService } from '../services/notificationService';

const TicketContext = createContext(null);

export function TicketProvider({ children }) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const refreshTickets = useCallback(async (filters = {}) => {
    let page = 1;
    let allTickets = [];
    let totalPages = 1;
    do {
      const result = await ticketService.list({ page, limit: 100, ...filters });
      allTickets = allTickets.concat(result.tickets || []);
      totalPages = result.pagination?.totalPages || 1;
      page += 1;
    } while (page <= totalPages);
    setTickets(allTickets);
    return allTickets;
  }, []);

  const refreshNotifications = useCallback(async () => {
    const result = await notificationService.list({ page: 1, limit: 100 });
    const items = result.notifications || [];
    setNotifications(items);
    return items;
  }, []);

  const refreshAll = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const canReadTickets = user.role !== 'INTERNAL_ADMIN' || (user.permissions || []).some((permission) => ['tickets:read', 'tickets:manage'].includes(permission));
      await Promise.all([canReadTickets ? refreshTickets() : Promise.resolve([]), refreshNotifications()]);
    } catch (requestError) {
      setError(requestError);
      throw requestError;
    } finally {
      setIsLoading(false);
    }
  }, [user, refreshTickets, refreshNotifications]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setTickets([]);
      setNotifications([]);
      setError(null);
      return undefined;
    }
    setIsLoading(true);
    setError(null);
    const canReadTickets = user.role !== 'INTERNAL_ADMIN' || (user.permissions || []).some((permission) => ['tickets:read', 'tickets:manage'].includes(permission));
    Promise.all([canReadTickets ? refreshTickets() : Promise.resolve([]), refreshNotifications()])
      .catch((requestError) => { if (active) setError(requestError); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [user?.id, refreshTickets, refreshNotifications]);

  const createTicket = useCallback(async (ticketData) => {
    const result = await ticketService.create({
      title: ticketData.title,
      description: ticketData.description,
      category: ticketData.category,
      priority: ticketData.priority,
      ...(ticketData.department ? { department: ticketData.department } : {}),
      ...(ticketData.departmentId ? { departmentId: ticketData.departmentId } : {}),
    });
    setTickets((previous) => [result.ticket, ...previous.filter((ticket) => ticket.id !== result.ticket.id)]);
    await refreshNotifications();
    return result.ticket;
  }, [refreshNotifications]);

  const getTicket = useCallback(async (ticketId) => {
    const result = await ticketService.get(ticketId);
    setTickets((previous) => previous.map((ticket) => ticket.id === result.ticket.id ? result.ticket : ticket));
    return result.ticket;
  }, []);

  const assignTicket = useCallback(async (ticketId, agentId) => {
    const result = await ticketService.assign(ticketId, agentId);
    setTickets((previous) => previous.map((ticket) => ticket.id === ticketId ? result.ticket : ticket));
    await refreshNotifications();
    return result.ticket;
  }, [refreshNotifications]);

  const unassignTicket = useCallback(async (ticketId) => {
    const result = await ticketService.unassign(ticketId);
    setTickets((previous) => previous.map((ticket) => ticket.id === ticketId ? result.ticket : ticket));
    await refreshNotifications();
    return result.ticket;
  }, [refreshNotifications]);

  const updateTicketStatus = useCallback(async (ticketId, status) => {
    const result = await ticketService.updateStatus(ticketId, status);
    setTickets((previous) => previous.map((ticket) => ticket.id === ticketId ? { ...ticket, ...result.ticket } : ticket));
    await refreshNotifications();
    return result.ticket;
  }, [refreshNotifications]);

  const updateTicketPriority = useCallback(async (ticketId, priority) => {
    const result = await ticketService.updatePriority(ticketId, priority);
    setTickets((previous) => previous.map((ticket) => ticket.id === ticketId ? { ...ticket, ...result.ticket } : ticket));
    await refreshNotifications();
    return result.ticket;
  }, [refreshNotifications]);

  const respondToAssignment = useCallback(async (ticketId, accepted, reason = '') => {
    const result = await ticketService.respondToAssignment(ticketId, accepted ? 'ACCEPT' : 'REJECT', reason);
    setTickets((previous) => previous.map((ticket) => ticket.id === ticketId ? { ...ticket, ...result.ticket } : ticket));
    await refreshTickets();
    await refreshNotifications();
    return result.ticket;
  }, [refreshNotifications, refreshTickets]);

  const addComment = useCallback(async (ticketId, message, isInternal = false) => {
    const result = await ticketService.addComment(ticketId, message, isInternal);
    await getTicket(ticketId);
    await refreshNotifications();
    return result.comment;
  }, [getTicket, refreshNotifications]);

  const markNotificationsRead = useCallback(async () => {
    await notificationService.markAllRead();
    setNotifications((previous) => previous.map((item) => ({ ...item, read: true })));
  }, []);

  const setNotificationRead = useCallback(async (notificationId, read) => {
    const result = await notificationService.setRead(notificationId, read);
    setNotifications((previous) => previous.map((item) => item.id === notificationId ? result.notification : item));
    return result.notification;
  }, []);

  const value = useMemo(() => ({
    tickets, notifications, isLoading, error,
    refreshTickets, refreshNotifications, refreshAll,
    createTicket, getTicket, assignTicket, unassignTicket,
    updateTicketStatus, updateTicketPriority, respondToAssignment,
    addComment, markNotificationsRead, setNotificationRead,
  }), [tickets, notifications, isLoading, error, refreshTickets, refreshNotifications, refreshAll, createTicket, getTicket, assignTicket, unassignTicket, updateTicketStatus, updateTicketPriority, respondToAssignment, addComment, markNotificationsRead, setNotificationRead]);

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>;
}

export function useTickets() {
  const context = useContext(TicketContext);
  if (!context) throw new Error('useTickets must be used inside TicketProvider');
  return context;
}
