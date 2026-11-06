const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
  category: { type: String, required: true, trim: true, maxlength: 100 },
  summary: { type: String, trim: true, maxlength: 500, default: '' },
  content: { type: String, trim: true, maxlength: 50000, default: '' },
  status: { type: String, enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], default: 'DRAFT', required: true },
  createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  publishedAt: { type: Date, default: null },
  archivedAt: { type: Date, default: null },
}, { timestamps: true });

articleSchema.index({ organisationId: 1, slug: 1 }, { unique: true });
articleSchema.index({ organisationId: 1, status: 1, updatedAt: -1 });
articleSchema.index({ organisationId: 1, category: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model('KnowledgeBaseArticle', articleSchema);
