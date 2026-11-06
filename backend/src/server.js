const http = require('node:http');
const app = require('./app');
const config = require('./config/env');
const { connectDatabase, disconnectDatabase } = require('./config/database');

async function startServer() {
  try {
    await connectDatabase();
    console.log('MongoDB connected.');
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    console.error('The API will start; the health endpoint will return HTTP 503 until the database is available.');
  }

  const server = http.createServer(app);
  server.listen(config.port, config.host, () => {
    console.log(`SmartTracker API listening at http://${config.host}:${config.port}`);
    console.log(`Swagger UI available at http://localhost:${config.port}/api-docs`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received. Closing server...`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  return server;
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start SmartTracker API:', error);
    process.exitCode = 1;
  });
}

module.exports = { startServer };
