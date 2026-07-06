const express = require('express');
const db = require('../db');
const authRoutes = require('./auth');
const deviceRoutes = require('./device');
const householdRoutes = require('./households');
const pairRoutes = require('./pair');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', authRoutes);
router.use('/device', deviceRoutes);
router.use('/pair', pairRoutes);
router.use('/households', householdRoutes);

router.get('/hub/settings', requireAuth, (req, res) => {
  const settings = db
    .prepare('SELECT id, hub_name, setup_complete, license_key, max_households, created_at FROM hub_settings WHERE id = 1')
    .get();
  res.json(settings);
});

router.get('/hub/stats', requireAuth, (req, res) => {
  const settings = db
    .prepare('SELECT hub_name, max_households, created_at FROM hub_settings WHERE id = 1')
    .get();
  const { households } = db.prepare('SELECT COUNT(*) AS households FROM households').get();
  const { enabledHouseholds } = db
    .prepare('SELECT COUNT(*) AS enabledHouseholds FROM households WHERE enabled = 1')
    .get();
  const { devices } = db.prepare('SELECT COUNT(*) AS devices FROM devices').get();
  const { playlists } = db.prepare('SELECT COUNT(*) AS playlists FROM playlists').get();
  const { channels } = db.prepare('SELECT COUNT(*) AS channels FROM playlist_channels').get();
  const { categories } = db.prepare('SELECT COUNT(*) AS categories FROM playlist_categories').get();
  const { pendingPairings } = db
    .prepare(
      `SELECT COUNT(*) AS pendingPairings
       FROM pairing_requests
       WHERE claimed_device_id IS NULL
         AND datetime(expires_at) > datetime('now')`
    )
    .get();
  const { recentlySeenDevices } = db
    .prepare(
      `SELECT COUNT(*) AS recentlySeenDevices
       FROM devices
       WHERE last_seen IS NOT NULL
         AND datetime(last_seen) >= datetime('now', '-24 hours')`
    )
    .get();

  res.json({
    ...settings,
    households,
    enabledHouseholds,
    devices,
    playlists,
    channels,
    categories,
    pendingPairings,
    recentlySeenDevices,
  });
});

module.exports = router;
