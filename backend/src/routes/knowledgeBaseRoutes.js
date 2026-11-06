const express = require('express');
const { body, param, query } = require('express-validator');
const { authenticate } = require('../middleware/authenticate');
const { requirePermission } = require('../middleware/accessControl');
const validateRequest = require('../middleware/validateRequest');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/knowledgeBaseController');

const router = express.Router();
const articleId = param('articleId').isMongoId().withMessage('A valid article ID is required.');
const pagination = [query('page').optional().isInt({ min: 1, max: 100000 }).toInt(), query('limit').optional().isInt({ min: 1, max: 100 }).toInt()];
const sort = [query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'title', 'category']), query('order').optional().isIn(['asc', 'desc'])];
const status = ['Draft', 'Published', 'Archived'];

router.get('/articles', authenticate, [
  ...pagination, ...sort, query('status').optional().isIn(status), query('category').optional().trim().isLength({ min: 1, max: 100 }), query('q').optional().trim().isLength({ min: 1, max: 100 }), validateRequest,
], asyncHandler(controller.listArticles));
router.get('/articles/:articleId', authenticate, [articleId, validateRequest], asyncHandler(controller.getArticle));
router.post('/articles', authenticate, requirePermission('knowledge:manage'), [
  body('title').trim().isLength({ min: 3, max: 180 }), body('category').trim().isLength({ min: 1, max: 100 }),
  body('summary').optional().trim().isLength({ max: 500 }), body('content').optional().isString().isLength({ max: 50000 }),
  body('status').optional().isIn(status), validateRequest,
], asyncHandler(controller.createArticle));
router.patch('/articles/:articleId', authenticate, requirePermission('knowledge:manage'), [
  articleId, body('title').optional().trim().isLength({ min: 3, max: 180 }), body('category').optional().trim().isLength({ min: 1, max: 100 }),
  body('summary').optional().trim().isLength({ max: 500 }), body('content').optional().isString().isLength({ max: 50000 }),
  body('status').optional().isIn(status), validateRequest,
], asyncHandler(controller.updateArticle));
router.delete('/articles/:articleId', authenticate, requirePermission('knowledge:manage'), [articleId, validateRequest], asyncHandler(controller.deleteArticle));

module.exports = router;
