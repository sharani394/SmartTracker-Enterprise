const mongoose = require('mongoose');
const config = require('./env');

async function removeLegacyTicketSequenceIndex() {
  const collection = mongoose.connection.collection('tickets');
  let indexes;
  try {
    indexes = await collection.indexes();
  } catch (error) {
    if (error.code === 26 || error.codeName === 'NamespaceNotFound') return;
    throw error;
  }

  const legacyIndex = indexes.find((index) => (
    index.name === 'organisationId_1_sequence_1'
    && index.unique === true
    && JSON.stringify(index.key) === JSON.stringify({ organisationId: 1, sequence: 1 })
  ));
  if (legacyIndex) await collection.dropIndex(legacyIndex.name);
}

async function connectDatabase() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: config.mongoServerSelectionTimeoutMs,
  });
  await removeLegacyTicketSequenceIndex();
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

module.exports = {
  connectDatabase,
  disconnectDatabase,
  getDatabaseStatus,
  removeLegacyTicketSequenceIndex,
};
