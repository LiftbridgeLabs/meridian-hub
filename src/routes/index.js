const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.get('/hub/settings', (req, res) => {
  const settings = db.prepare('SELECT * FROM hub_settings WHERE id = 1').get();
  res.json(settings);
});

module.exports = router;
