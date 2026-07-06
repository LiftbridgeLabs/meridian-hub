const express = require('express');
const db = require('../db');
const authRoutes = require('./auth');
const deviceRoutes = require('./device');
const householdRoutes = require('./households');
const pairRoutes = require('./pair');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', authRoutes);
router.use('/device', deviceRoutes);
router.use('/pair', pairRoutes);
router.use('/households', householdRoutes);

router.get('/hub/branding', (req, res) => {
  const settings = db
    .prepare('SELECT hub_name, logo_mime, logo_updated_at FROM hub_settings WHERE id = 1')
    .get();
  res.json({
    hubName: settings.hub_name,
    hasCustomLogo: !!settings.logo_mime,
    logoMime: settings.logo_mime || 'image/png',
    logoUpdatedAt: settings.logo_updated_at,
    defaultLogoUrl: '/meridian-logo.png',
    logoUrl: settings.logo_mime
      ? `/api/hub/logo?v=${encodeURIComponent(settings.logo_updated_at || 'custom')}`
      : '/meridian-logo.png',
  });
});

router.get('/hub/logo', (req, res) => {
  const settings = db.prepare('SELECT logo_mime, logo_data FROM hub_settings WHERE id = 1').get();
  if (!settings.logo_data || !settings.logo_mime) return res.status(404).json({ error: 'No custom logo set' });
  res.set('Content-Type', settings.logo_mime);
  res.set('Cache-Control', 'public, max-age=300');
  res.send(settings.logo_data);
});

router.get('/hub/settings', requireAuth, (req, res) => {
  const settings = db
    .prepare(
      `SELECT
        id,
        hub_name,
        setup_complete,
        license_key,
        max_households,
        logo_mime,
        logo_updated_at,
        created_at
       FROM hub_settings
       WHERE id = 1`
    )
    .get();
  res.json({ ...settings, hasCustomLogo: !!settings.logo_mime, logo_mime: undefined });
});

router.put('/hub/settings', requireAuth, (req, res) => {
  const hubName = String(req.body.hub_name || req.body.hubName || '').trim();
  if (!hubName) return res.status(400).json({ error: 'Hub name is required' });

  db.prepare('UPDATE hub_settings SET hub_name = ? WHERE id = 1').run(hubName);
  const settings = db
    .prepare('SELECT id, hub_name, setup_complete, license_key, max_households, logo_updated_at, created_at FROM hub_settings WHERE id = 1')
    .get();
  res.json({ ...settings, hasCustomLogo: !!settings.logo_updated_at });
});

router.put('/hub/logo', requireAuth, (req, res) => {
  const dataUrl = String(req.body.logoDataUrl || '').trim();
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return res.status(400).json({ error: 'Logo must be a base64 data URL' });

  const mime = match[1].toLowerCase();
  if (!LOGO_TYPES.has(mime)) {
    return res.status(400).json({ error: 'Logo must be PNG, JPEG, WebP, or SVG' });
  }

  const data = Buffer.from(match[2], 'base64');
  if (!data.length || data.length > 1024 * 1024) {
    return res.status(400).json({ error: 'Logo must be smaller than 1 MB' });
  }

  const { updated_at: updatedAt } = db.prepare("SELECT datetime('now') AS updated_at").get();
  db.prepare('UPDATE hub_settings SET logo_mime = ?, logo_data = ?, logo_updated_at = ? WHERE id = 1').run(
    mime,
    data,
    updatedAt
  );

  res.json({
    hasCustomLogo: true,
    logoMime: mime,
    logoUpdatedAt: updatedAt,
    logoUrl: `/api/hub/logo?v=${encodeURIComponent(updatedAt)}`,
  });
});

router.delete('/hub/logo', requireAuth, (req, res) => {
  db.prepare('UPDATE hub_settings SET logo_mime = NULL, logo_data = NULL, logo_updated_at = NULL WHERE id = 1').run();
  res.status(204).send();
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
