const express = require('express');
const swaggerUi = require('swagger-ui-express');
const config = require('./config/env');
const openApiDocument = require('./openapi');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const organisationRoutes = require('./routes/organisationRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const knowledgeBaseRoutes = require('./routes/knowledgeBaseRoutes');
const reportRoutes = require('./routes/reportRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { createCorsMiddleware } = require('./middleware/cors');

const app = express();

app.disable('x-powered-by');
app.use(createCorsMiddleware(config.corsOrigins));
app.use(express.json({ limit: config.jsonBodyLimit }));

app.get('/openapi.json', (req, res) => res.json(openApiDocument));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, {
  explorer: true,
  swaggerOptions: { persistAuthorization: false },
}));
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/organisations', organisationRoutes);
app.use('/api/v1', ticketRoutes);
app.use('/api/v1/knowledge-base', knowledgeBaseRoutes);
app.use('/api/v1/reports', reportRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
