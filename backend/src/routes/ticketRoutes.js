const express = require('express');
const { body, param, query } = require('express-validator');
const { authenticate } = require('../middleware/authenticate');
const { requireAnyPermission } = require('../middleware/accessControl');
const ticket = require('../controllers/ticketController');
const notifications = require('../controllers/notificationController');
const asyncHandler = require('../utils/asyncHandler');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();
const idParam = (name) => param(name).isMongoId().withMessage(`A valid ${name} is required.`);
const pagination = [
  query('page').optional().isInt({ min: 1, max: 100000 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];
const ticketStatuses = ['Open', 'Assigned', 'In Progress', 'On Hold', 'Resolved'];
const priorities = ['Low', 'Medium', 'High', 'Critical'];
const categories = ['Hardware', 'Software', 'Network', 'Access', 'Other'];
const requireTicketRead = requireAnyPermission('tickets:read', 'tickets:manage');

router.post('/tickets', authenticate, [
  body('title').trim().isLength({ min: 3, max: 160 }).withMessage('Title must be 3 to 160 characters.'),
  body('description').trim().isLength({ min: 5, max: 10000 }).withMessage('Description must be 5 to 10000 characters.'),
  body('category').isIn(categories).withMessage('Category is invalid.'),
  body('priority').optional().isIn(priorities).withMessage('Priority is invalid.'),
  body('department').optional().isString().isLength({ max: 100 }),
  body('departmentId').optional().isMongoId(),
  validateRequest,
], asyncHandler(ticket.createTicket));

router.get('/tickets', authenticate, [
  ...pagination,
  query('status').optional().isIn(ticketStatuses),
  query('priority').optional().isIn(priorities),
  query('category').optional().isIn(categories),
  query('q').optional().trim().isLength({ min: 1, max: 100 }),
  query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'ticketNumber', 'title', 'priority', 'status']),
  query('order').optional().isIn(['asc', 'desc']),
  query('assignedAgentId').optional().isMongoId(),
  validateRequest,
], asyncHandler(ticket.listTickets));

router.get('/tickets/:ticketId', authenticate, [idParam('ticketId'), validateRequest], asyncHandler(ticket.getTicket));
router.put('/tickets/:ticketId/assignment', authenticate, requireTicketRead, [
  idParam('ticketId'),
  body('agentId').isMongoId().withMessage('A valid Support Agent ID is required.'),
  validateRequest,
], asyncHandler(ticket.assignTicket));
router.delete('/tickets/:ticketId/assignment', authenticate, requireTicketRead, [
  idParam('ticketId'), validateRequest,
], asyncHandler(ticket.unassignTicket));
router.put('/tickets/:ticketId/assignment-response', authenticate, [
  idParam('ticketId'),
  body('decision').isIn(['ACCEPT', 'REJECT']).withMessage('Decision must be ACCEPT or REJECT.'),
  body('reason').if(body('decision').equals('REJECT')).trim().isLength({ min: 3, max: 1000 })
    .withMessage('A rejection reason of 3 to 1000 characters is required.'),
  validateRequest,
], asyncHandler(ticket.respondToAssignment));
router.patch('/tickets/:ticketId/status', authenticate, [
  idParam('ticketId'),
  body('status').isIn(ticketStatuses).withMessage('Status is invalid.'),
  validateRequest,
], asyncHandler(ticket.changeStatus));
router.patch('/tickets/:ticketId/priority', authenticate, requireTicketRead, [
  idParam('ticketId'),
  body('priority').isIn(priorities).withMessage('Priority is invalid.'),
  validateRequest,
], asyncHandler(ticket.changePriority));

router.get('/tickets/:ticketId/comments', authenticate, [
  idParam('ticketId'),
  ...pagination,
  validateRequest,
], asyncHandler(ticket.listComments));
router.post('/tickets/:ticketId/comments', authenticate, [
  idParam('ticketId'),
  body('message').trim().isLength({ min: 1, max: 5000 }).withMessage('Comment must be 1 to 5000 characters.'),
  body('isInternal').optional().isBoolean().toBoolean(),
  validateRequest,
], asyncHandler(ticket.addComment));
router.get('/tickets/:ticketId/activity', authenticate, [
  idParam('ticketId'),
  ...pagination,
  validateRequest,
], asyncHandler(ticket.listActivity));

router.get('/notifications', authenticate, [
  ...pagination,
  query('read').optional().isBoolean().withMessage('read must be true or false.'),
  validateRequest,
], asyncHandler(notifications.listNotifications));
router.patch('/notifications/read', authenticate, asyncHandler(notifications.markAllRead));
router.patch('/notifications/:notificationId/read', authenticate, [
  idParam('notificationId'),
  body('read').isBoolean().toBoolean().withMessage('read must be true or false.'),
  validateRequest,
], asyncHandler(notifications.setReadState));

module.exports = router;
