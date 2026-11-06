const express = require('express');
const { query } = require('express-validator');
const { authenticate } = require('../middleware/authenticate');
const { requirePermission } = require('../middleware/accessControl');
const validateRequest = require('../middleware/validateRequest');
const asyncHandler = require('../utils/asyncHandler');
const reports = require('../controllers/reportController');

const router = express.Router();
router.get('/summary', authenticate, requirePermission('reports:read'), [
  query('from').optional().isISO8601().withMessage('from must be an ISO 8601 date.'),
  query('to').optional().isISO8601().withMessage('to must be an ISO 8601 date.'),
  validateRequest,
], asyncHandler(reports.getSummary));
module.exports = router;
