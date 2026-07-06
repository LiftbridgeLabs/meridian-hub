const express = require('express');
const db = require('../db');
const { requireDeviceAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireDeviceAuth);

function playlistForDevice(device) {
  if (device.assigned_playlist_id) {
    return db
      .prepare('SELECT * FROM playlists WHERE id = ? AND household_id = ?')
      .get(device.assigned_playlist_id, device.household_id);
  }

  return db
    .prepare('SELECT * FROM playlists WHERE household_id = ? ORDER BY created_at ASC LIMIT 1')
    .get(device.household_id);
}

router.get('/config', (req, res) => {
  const appVersion = req.get('x-app-version') || req.query.app_version || req.query.appVersion || null;

  db.prepare(
    `UPDATE devices
     SET last_seen = datetime('now'), app_version = COALESCE(?, app_version)
     WHERE id = ?`
  ).run(appVersion, req.device.id);

  const household = db
    .prepare('SELECT id, name, timezone, language, theme FROM households WHERE id = ?')
    .get(req.device.household_id);
  const profile = req.device.assigned_profile_id
    ? db.prepare('SELECT * FROM profiles WHERE id = ? AND household_id = ?').get(
        req.device.assigned_profile_id,
        req.device.household_id
      )
    : db
        .prepare(
          `SELECT * FROM profiles
           WHERE household_id = ?
           ORDER BY is_default DESC, created_at ASC
           LIMIT 1`
        )
        .get(req.device.household_id);
  const playlist = playlistForDevice(req.device);
  const epgSources = db
    .prepare('SELECT id, name, url, format FROM epg_sources WHERE household_id = ? ORDER BY created_at ASC')
    .all(req.device.household_id);

  res.json({
    device: {
      id: req.device.id,
      name: req.device.name,
      platform: req.device.platform,
      assignedProfileId: req.device.assigned_profile_id,
      assignedPlaylistId: req.device.assigned_playlist_id,
      pushPending: !!req.device.push_pending,
    },
    household,
    profile: profile || null,
    playlist: playlist || null,
    epgSources,
  });
});

module.exports = router;
