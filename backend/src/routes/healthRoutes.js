const express = require('express');
const { getDatabaseStatus } = require('../config/database');

const router = express.Router();

router.get('/', (req, res) => {
  const database = getDatabaseStatus();
  const healthy = database.ready;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    service: 'smarttracker-api',
    timestamp: new Date().toISOString(),
    database,
  });
});

module.exports = router;
