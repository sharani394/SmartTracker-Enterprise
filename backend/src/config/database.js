const mongoose = require('mongoose');
const config = require('./env');

const LEGACY_UNIQUE_INDEXES = [
  { collection: 'tickets', name: 'organisationId_1_sequence_1', key: { organisationId: 1, sequence: 1 } },
  { collection: 'departments', name: 'organisationId_1_normalizedName_1', key: { organisationId: 1, normalizedName: 1 } },
  { collection: 'organisations', name: 'slug_1', key: { slug: 1 } },
  { collection: 'passwordresets', name: 'tokenHash_1', key: { tokenHash: 1 } },
  { collection: 'users', name: 'organisationId_1_email_1', key: { organisationId: 1, email: 1 } },
];

function sameIndexKey(left, right) {
  const normalize = (key) => JSON.stringify(Object.entries(key).sort(([a], [b]) => a.localeCompare(b)));
  return normalize(left) === normalize(right);
}

async function removeLegacyUniqueIndexes() {
  for (const legacy of LEGACY_UNIQUE_INDEXES) {
    const collection = mongoose.connection.collection(legacy.collection);
    let indexes;
    try {
      indexes = await collection.indexes();
    } catch (error) {
      if (error.code === 26 || error.codeName === 'NamespaceNotFound') continue;
      throw error;
    }

    const index = indexes.find((item) => (
      item.name === legacy.name
      && item.unique === true
      && sameIndexKey(item.key, legacy.key)
    ));
    if (index) await collection.dropIndex(index.name);
  }
}

async function ensureUniquePasswordResetUserIndex() {
  const collection = mongoose.connection.collection('passwordresets');
  const indexes = await collection.indexes();
  const userIndex = indexes.find((index) => sameIndexKey(index.key, { userId: 1 }));
  if (userIndex?.unique) return;

  const duplicates = await collection.aggregate([
    { $group: { _id: '$userId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 1 },
  ]).toArray();
  const missingUserIds = await collection.countDocuments({
    $or: [{ userId: { $exists: false } }, { userId: null }],
  });
  if (duplicates.length || missingUserIds) {
    throw new Error('Cannot enforce the password-reset user constraint: duplicate or missing user references exist.');
  }

  if (userIndex) await collection.dropIndex(userIndex.name);
  await collection.createIndex({ userId: 1 }, { unique: true, name: 'userId_1' });
}

async function connectDatabase() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: config.mongoServerSelectionTimeoutMs,
  });
  await removeLegacyUniqueIndexes();
  await ensureUniquePasswordResetUserIndex();
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
  removeLegacyUniqueIndexes,
  ensureUniquePasswordResetUserIndex,
};
