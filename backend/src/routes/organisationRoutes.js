const express = require('express');
const { body, param, query } = require('express-validator');
const { rateLimit } = require('express-rate-limit');
const organisationController = require('../controllers/organisationController');
const operations = require('../controllers/organisationOperationsController');
const asyncHandler = require('../utils/asyncHandler');
const validateRequest = require('../middleware/validateRequest');
const { authenticate, requireRoles } = require('../middleware/authenticate');
const { requirePermission, requireAnyPermission, DELEGABLE_PERMISSIONS } = require('../middleware/accessControl');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, res, next) => next(new AppError('Too many registration attempts. Try again later.', 429, 'RATE_LIMITED')),
});
const objectId = (field) => param(field).isMongoId().withMessage(`A valid ${field} is required.`);
const permissionArray = [
  body('permissions').isArray({ max: DELEGABLE_PERMISSIONS.length }).withMessage('Permissions must be an array.'),
  body('permissions.*').isIn(DELEGABLE_PERMISSIONS).withMessage('Unsupported delegated permission.'),
];

router.post('/', registrationLimiter, [
  body('organisationName').trim().isLength({ min: 2, max: 120 }),
  body('domain').trim().matches(/^(?:https?:\/\/)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+\/?$/i)
    .withMessage('Enter a valid company email domain.'),
  body('ownerName').trim().isLength({ min: 2, max: 120 }),
  body('email').trim().toLowerCase().isEmail(),
  body('phone').trim().isLength({ min: 6, max: 40 }),
  body('industry').trim().isLength({ min: 1, max: 100 }),
  body('country').trim().isLength({ min: 1, max: 100 }),
  body('password').isString().isLength({ min: 8, max: 128 }),
  validateRequest,
], asyncHandler(organisationController.registerOrganisation));

router.get('/settings', authenticate, requirePermission('settings:read'), asyncHandler(operations.getSettings));
router.patch('/settings', authenticate, requirePermission('settings:manage'), [
  body('name').optional().trim().isLength({ min: 2, max: 120 }),
  body('industry').optional().trim().isLength({ min: 1, max: 100 }),
  body('country').optional().trim().isLength({ min: 1, max: 100 }),
  body('supportEmail').optional().custom((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)).withMessage('Enter a valid support email.'),
  body('timezone').optional().trim().isLength({ min: 1, max: 80 }),
  body('memberRegistrationEnabled').optional().isBoolean().toBoolean(),
  body('loginAlertsEnabled').optional().isBoolean().toBoolean(),
  validateRequest,
], asyncHandler(operations.updateSettings));

router.get('/members', authenticate, requireRoles('OWNER', 'PRIMARY_ADMIN'), asyncHandler(organisationController.listPendingMembers));
router.patch('/members/:memberId/approval', authenticate, requireRoles('OWNER', 'PRIMARY_ADMIN'), [
  objectId('memberId'),
  body('decision').isIn(['APPROVE', 'REJECT']).withMessage('Decision must be APPROVE or REJECT.'),
  body('approvedRole').optional().isIn(['EMPLOYEE', 'SUPPORT_AGENT']).withMessage('Approved role must be Employee or Support Agent.'),
  body('reason').optional().isString().isLength({ max: 500 }),
  validateRequest,
], asyncHandler(organisationController.reviewMember));

router.get('/internal-admins', authenticate, requirePermission('internalAdmins:manage'), asyncHandler(operations.listInternalAdmins));
router.get('/primary-admin', authenticate, requireRoles('OWNER', 'PRIMARY_ADMIN'), asyncHandler(operations.getPrimaryAdmin));
router.post('/internal-admins', authenticate, requirePermission('internalAdmins:manage'), registrationLimiter, [
  body('fullName').trim().isLength({ min: 2, max: 120 }),
  body('email').trim().toLowerCase().isEmail(),
  body('phone').trim().isLength({ min: 6, max: 40 }),
  ...permissionArray,
  validateRequest,
], asyncHandler(operations.createInternalAdmin));
router.patch('/internal-admins/:adminId/permissions', authenticate, requirePermission('internalAdmins:manage'), [
  objectId('adminId'),
  ...permissionArray,
  validateRequest,
], asyncHandler(operations.updateInternalAdminPermissions));
router.patch('/internal-admins/:adminId/status', authenticate, requirePermission('internalAdmins:manage'), [
  objectId('adminId'),
  body('status').isIn(['ACTIVE', 'SUSPENDED']).withMessage('Status must be ACTIVE or SUSPENDED.'),
  validateRequest,
], asyncHandler(operations.updateInternalAdminStatus));

router.get('/users', authenticate, requireAnyPermission('users:read', 'agents:read'), [
  query('role').optional().isIn(['EMPLOYEE', 'SUPPORT_AGENT']),
  query('status').optional().isIn(['PENDING_EMAIL', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'SUSPENDED']),
  validateRequest,
], asyncHandler(operations.listUsers));
router.patch('/users/:userId/status', authenticate, requireAnyPermission('users:manage', 'agents:manage'), [
  objectId('userId'),
  body('status').isIn(['ACTIVE', 'SUSPENDED']).withMessage('Status must be ACTIVE or SUSPENDED.'),
  validateRequest,
], asyncHandler(operations.updateUserStatus));

router.get('/departments', authenticate, requirePermission('departments:read'), [
  query('status').optional().isIn(['ACTIVE', 'INACTIVE', 'ALL']),
  validateRequest,
], asyncHandler(operations.listDepartments));
router.post('/departments', authenticate, requirePermission('departments:manage'), [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('description').optional().isString().isLength({ max: 500 }),
  validateRequest,
], asyncHandler(operations.createDepartment));
router.patch('/departments/:departmentId', authenticate, requirePermission('departments:manage'), [
  objectId('departmentId'),
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('description').optional().isString().isLength({ max: 500 }),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']),
  validateRequest,
], asyncHandler(operations.updateDepartment));

router.get('/audit-events', authenticate, requirePermission('audit:read'), [
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('before').optional().isISO8601().toDate(),
  query('from').optional().isISO8601().toDate(),
  query('to').optional().isISO8601().toDate(),
  query('action').optional().trim().isLength({ min: 1, max: 100 }),
  query('targetType').optional().trim().isLength({ min: 1, max: 80 }),
  query('actorId').optional().isMongoId(),
  query('category').optional().isIn(['Ticket', 'User', 'Admin', 'Administrator', 'Access', 'Organisation', 'Organization', 'Security']),
  query('q').optional().trim().isLength({ min: 1, max: 100 }),
  validateRequest,
], asyncHandler(operations.listAuditEvents));

module.exports = router;
