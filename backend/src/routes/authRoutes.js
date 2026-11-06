const express = require('express');
const { body, param } = require('express-validator');
const { rateLimit } = require('express-rate-limit');
const auth = require('../controllers/authController');
const asyncHandler = require('../utils/asyncHandler');
const validateRequest = require('../middleware/validateRequest');
const { authenticate, requireRoles } = require('../middleware/authenticate');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, res, next) => next(new AppError('Too many authentication requests. Try again later.', 429, 'RATE_LIMITED')),
});

const emailField = body('email').trim().toLowerCase().isEmail().withMessage('A valid email address is required.');
const passwordField = body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Password must be 8 to 128 characters.');
const nameField = (field, label = field) => body(field).trim().isLength({ min: 2, max: 120 }).withMessage(`${label} must be 2 to 120 characters.`);
const phoneField = body('phone').trim().isLength({ min: 6, max: 40 }).withMessage('A valid phone number is required.');

router.post('/login', authLimiter, [
  emailField,
  body('password').isString().isLength({ min: 1, max: 128 }),
  validateRequest,
], asyncHandler(auth.login));

router.post('/refresh', authLimiter, [
  body('refreshToken').isString().isLength({ min: 64, max: 128 }).withMessage('Refresh token is required.'),
  validateRequest,
], asyncHandler(auth.refreshSession));

router.post('/logout', authenticate, asyncHandler(auth.logout));

router.post('/email-verification/confirm', authLimiter, [
  emailField,
  body('code').matches(/^\d{6}$/).withMessage('Verification code must be six digits.'),
  validateRequest,
], asyncHandler(auth.confirmEmail));

router.post('/email-verification/resend', authLimiter, [emailField, validateRequest], asyncHandler(auth.resendVerification));

router.post('/password-reset/request', authLimiter, [emailField, validateRequest], asyncHandler(auth.requestPasswordReset));
router.post('/password-reset/confirm', authLimiter, [
  emailField,
  body('code').matches(/^\d{6}$/).withMessage('Password reset code must be six digits.'),
  passwordField,
  validateRequest,
], asyncHandler(auth.confirmPasswordReset));

router.post('/internal-admin-invitations/accept', authLimiter, [
  emailField,
  body('code').matches(/^\d{6}$/).withMessage('Invitation code must be six digits.'),
  body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Password must be 8 to 128 characters.'),
  validateRequest,
], asyncHandler(require('../controllers/organisationOperationsController').acceptInternalAdminInvitation));

router.post('/primary-admin-codes', authenticate, requireRoles('OWNER'), [
  body('replaceCurrent').optional().isBoolean().toBoolean(),
  body('currentPassword').optional().isString().isLength({ min: 1, max: 128 }),
  validateRequest,
], asyncHandler(auth.issuePrimaryAdminCode));

router.post('/primary-admin/register', authLimiter, [
  nameField('organisationName', 'Organisation name'),
  nameField('fullName', 'Full name'),
  emailField,
  phoneField,
  body('registrationCode').matches(/^\d{6}$/).withMessage('Registration code must be six digits.'),
  passwordField,
  validateRequest,
], asyncHandler(auth.registerPrimaryAdmin));

router.post('/members/register', authLimiter, [
  nameField('organisationName', 'Organisation name'),
  emailField,
  nameField('fullName', 'Full name'),
  phoneField,
  body('accountType').isIn(['Employee', 'Support Agent']).withMessage('Account type must be Employee or Support Agent.'),
  body('department').trim().isLength({ min: 1, max: 100 }).withMessage('Department is required.'),
  body('jobTitle').trim().isLength({ min: 1, max: 100 }).withMessage('Job title is required.'),
  body('experience').trim().isLength({ min: 1, max: 80 }).withMessage('Experience is required.'),
  body('employeeId').optional({ nullable: true }).isString().isLength({ max: 80 }),
  body('skills').optional().custom((value) => typeof value === 'string' || (Array.isArray(value) && value.every((item) => typeof item === 'string'))).withMessage('Skills must be a string or an array of strings.'),
  passwordField,
  validateRequest,
], asyncHandler(auth.registerMember));

router.get('/me', authenticate, asyncHandler(auth.getMe));
router.patch('/me', authenticate, [
  nameField('fullName', 'Full name'),
  phoneField,
  validateRequest,
], asyncHandler(auth.updateMe));

router.put('/password', authenticate, [
  body('currentPassword').isString().isLength({ min: 1, max: 128 }),
  body('newPassword').isString().isLength({ min: 8, max: 128 }).withMessage('New password must be 8 to 128 characters.'),
  validateRequest,
], asyncHandler(auth.changePassword));

router.get('/sessions', authenticate, asyncHandler(auth.listSessions));
router.delete('/sessions/:sessionId', authenticate, [
  param('sessionId').isMongoId().withMessage('A valid session ID is required.'),
  validateRequest,
], asyncHandler(auth.revokeSession));

module.exports = router;
