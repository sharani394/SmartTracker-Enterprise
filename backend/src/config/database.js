const mongoose = require('mongoose');
const config = require('./env');

async function connectDatabase() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: config.mongoServerSelectionTimeoutMs,
  });
  return mongoose.connection;
}

function getDatabaseStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return {
    status: states[mongoose.connection.readyState] || 'unknown',
    ready: mongoose.connection.readyState === 1,
    name: mongoose.connection.name || null,
  };
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = { connectDatabase, disconnectDatabase, getDatabaseStatus };
