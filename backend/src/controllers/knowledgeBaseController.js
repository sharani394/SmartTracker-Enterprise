const KnowledgeBaseArticle = require('../models/KnowledgeBaseArticle');
const { AppError } = require('../middleware/errorHandler');
const { hasPermission } = require('../middleware/accessControl');
const { recordAudit } = require('../services/auditService');

const STATUS_TO_API = { DRAFT: 'Draft', PUBLISHED: 'Published', ARCHIVED: 'Archived' };
const STATUS_FROM_API = { DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', ARCHIVED: 'ARCHIVED' };

function slugify(value) {
  return value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180) || 'article';
}
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function serialize(article) {
  return {
    id: String(article._id), title: article.title, slug: article.slug, category: article.category,
    summary: article.summary, content: article.content, status: STATUS_TO_API[article.status],
    createdAt: article.createdAt, updatedAt: article.updatedAt,
    publishedAt: article.publishedAt, archivedAt: article.archivedAt,
  };
}
function statusFromRequest(value) {
  return STATUS_FROM_API[String(value || '').trim().toUpperCase()];
}
function canManage(req) { return hasPermission(req.auth, 'knowledge:manage'); }
function canReadDrafts(req) { return hasPermission(req.auth, 'knowledge:read') || canManage(req); }
function articleFilter(req) {
  const filter = { organisationId: req.auth.organisationId };
  if (!canReadDrafts(req)) filter.status = 'PUBLISHED';
  if (req.query.status) {
    const status = statusFromRequest(req.query.status);
    if (!status) throw new AppError('Article status filter is invalid.', 400, 'INVALID_STATUS');
    if (!canReadDrafts(req) && status !== 'PUBLISHED') {
      throw new AppError('Only published articles are available to your account.', 403, 'FORBIDDEN');
    }
    filter.status = status;
  }
  if (req.query.category) filter.category = req.query.category;
  if (req.query.q) {
    const re = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
    filter.$or = [{ title: re }, { category: re }, { summary: re }, { content: re }];
  }
  return filter;
}
async function uniqueSlug(organisationId, title, excludedId = null) {
  const base = slugify(title);
  let slug = base;
  let suffix = 1;
  while (await KnowledgeBaseArticle.exists({ organisationId, slug, ...(excludedId ? { _id: { $ne: excludedId } } : {}) })) {
    suffix += 1;
    slug = `${base}-${suffix}`.slice(0, 200);
  }
  return slug;
}
async function listArticles(req, res) {
  const filter = articleFilter(req);
  const page = Number.parseInt(req.query.page || '1', 10);
  const limit = Number.parseInt(req.query.limit || '20', 10);
  const sortBy = req.query.sortBy || 'updatedAt';
  const order = req.query.order === 'asc' ? 1 : -1;
  const [items, total] = await Promise.all([
    KnowledgeBaseArticle.find(filter).sort({ [sortBy]: order, _id: -1 }).skip((page - 1) * limit).limit(limit),
    KnowledgeBaseArticle.countDocuments(filter),
  ]);
  return res.json({ articles: items.map(serialize), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}
async function getArticle(req, res) {
  const filter = { _id: req.params.articleId, organisationId: req.auth.organisationId };
  if (!canReadDrafts(req)) filter.status = 'PUBLISHED';
  const article = await KnowledgeBaseArticle.findOne(filter);
  if (!article) throw new AppError('Article was not found.', 404, 'ARTICLE_NOT_FOUND');
  return res.json({ article: serialize(article) });
}
async function createArticle(req, res) {
  if (!canManage(req)) throw new AppError('knowledge:manage permission is required.', 403, 'FORBIDDEN');
  const status = statusFromRequest(req.body.status || 'Draft');
  if (!status) throw new AppError('Article status is invalid.', 400, 'INVALID_STATUS');
  if (status === 'PUBLISHED' && !String(req.body.content || '').trim()) {
    throw new AppError('Article content is required before publication.', 400, 'ARTICLE_CONTENT_REQUIRED');
  }
  const article = await KnowledgeBaseArticle.create({
    organisationId: req.auth.organisationId,
    title: req.body.title,
    slug: await uniqueSlug(req.auth.organisationId, req.body.title),
    category: req.body.category,
    summary: req.body.summary || '', content: req.body.content || '', status,
    createdById: req.auth.user._id, updatedById: req.auth.user._id,
    publishedAt: status === 'PUBLISHED' ? new Date() : null,
    archivedAt: status === 'ARCHIVED' ? new Date() : null,
  });
  await recordAudit(req, { action: status === 'PUBLISHED' ? 'KNOWLEDGE_ARTICLE_PUBLISHED' : 'KNOWLEDGE_ARTICLE_CREATED', targetType: 'KnowledgeBaseArticle', targetId: article._id, metadata: { title: article.title, category: article.category, status: article.status } });
  return res.status(201).json({ article: serialize(article) });
}
async function updateArticle(req, res) {
  if (!canManage(req)) throw new AppError('knowledge:manage permission is required.', 403, 'FORBIDDEN');
  const article = await KnowledgeBaseArticle.findOne({ _id: req.params.articleId, organisationId: req.auth.organisationId });
  if (!article) throw new AppError('Article was not found.', 404, 'ARTICLE_NOT_FOUND');
  const previousStatus = article.status;
  if (req.body.title !== undefined) {
    article.title = req.body.title;
    article.slug = await uniqueSlug(req.auth.organisationId, req.body.title, article._id);
  }
  if (req.body.category !== undefined) article.category = req.body.category;
  if (req.body.summary !== undefined) article.summary = req.body.summary;
  if (req.body.content !== undefined) article.content = req.body.content;
  if (req.body.status !== undefined) {
    const status = statusFromRequest(req.body.status);
    if (!status) throw new AppError('Article status is invalid.', 400, 'INVALID_STATUS');
    article.status = status;
  }
  if (article.status === 'PUBLISHED' && !article.content.trim()) {
    throw new AppError('Article content is required before publication.', 400, 'ARTICLE_CONTENT_REQUIRED');
  }
  if (article.status === 'PUBLISHED' && previousStatus !== 'PUBLISHED') article.publishedAt = new Date();
  if (article.status === 'ARCHIVED' && previousStatus !== 'ARCHIVED') article.archivedAt = new Date();
  if (article.status !== 'ARCHIVED') article.archivedAt = null;
  article.updatedById = req.auth.user._id;
  await article.save();
  const action = article.status === 'PUBLISHED' && previousStatus !== 'PUBLISHED'
    ? 'KNOWLEDGE_ARTICLE_PUBLISHED'
    : article.status === 'ARCHIVED' && previousStatus !== 'ARCHIVED'
      ? 'KNOWLEDGE_ARTICLE_ARCHIVED'
      : 'KNOWLEDGE_ARTICLE_UPDATED';
  await recordAudit(req, { action, targetType: 'KnowledgeBaseArticle', targetId: article._id, metadata: { title: article.title, category: article.category, fromStatus: previousStatus, status: article.status } });
  return res.json({ article: serialize(article) });
}
async function deleteArticle(req, res) {
  if (!canManage(req)) throw new AppError('knowledge:manage permission is required.', 403, 'FORBIDDEN');
  const article = await KnowledgeBaseArticle.findOneAndDelete({ _id: req.params.articleId, organisationId: req.auth.organisationId });
  if (!article) throw new AppError('Article was not found.', 404, 'ARTICLE_NOT_FOUND');
  await recordAudit(req, { action: 'KNOWLEDGE_ARTICLE_DELETED', targetType: 'KnowledgeBaseArticle', targetId: article._id, metadata: { title: article.title, category: article.category, status: article.status } });
  return res.json({ message: 'Article deleted.' });
}
module.exports = { listArticles, getArticle, createArticle, updateArticle, deleteArticle };
