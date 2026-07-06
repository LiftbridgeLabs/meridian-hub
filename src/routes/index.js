const express = require('express');
const db = require('../db');
const authRoutes = require('./auth');
const householdRoutes = require('./households');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', authRoutes);
router.use('/households', householdRoutes);

router.get('/hub/settings', requireAuth, (req, res) => {
  const settings = db
    .prepare('SELECT id, hub_name, setup_complete, license_key, max_households, created_at FROM hub_settings WHERE id = 1')
    .get();
  res.json(settings);
});

module.exports = router;
