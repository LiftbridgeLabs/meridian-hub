const express = require('express');
const db = require('../db');
const { requireDeviceAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireDeviceAuth);

function parseIds(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.map((id) => Number(id)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function playlistForDevice(device, profile) {
  if (profile?.assigned_playlist_id) {
    return db
      .prepare('SELECT * FROM playlists WHERE id = ? AND household_id = ?')
      .get(profile.assigned_playlist_id, device.household_id);
  }

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
     SET last_seen = datetime('now'), app_version = COALESCE(?, app_version), push_pending = 0
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
  const playlist = playlistForDevice(req.device, profile);
  const allowedCategoryIds = parseIds(profile?.allowed_categories);
  const categoryFilter =
    allowedCategoryIds.length > 0 ? `AND ch.category_id IN (${allowedCategoryIds.map(() => '?').join(',')})` : '';
  const channels = playlist
    ? db
        .prepare(
          `SELECT
            ch.id,
            ch.remote_id,
            COALESCE(NULLIF(ch.custom_name, ''), ch.name) AS name,
            ch.stream_url,
            ch.logo_url,
            ch.tvg_id,
            COALESCE(NULLIF(c.custom_name, ''), c.name, ch.group_title) AS group_title,
            ch.sort_order
           FROM playlist_channels ch
           LEFT JOIN playlist_categories c ON c.id = ch.category_id
           WHERE ch.playlist_id = ?
             AND ch.enabled = 1
             AND (c.enabled IS NULL OR c.enabled = 1)
             ${categoryFilter}
           ORDER BY ch.sort_order ASC, name COLLATE NOCASE ASC`
        )
        .all(playlist.id, ...allowedCategoryIds)
    : [];
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
      pushPending: false,
    },
    household,
    profile: profile
      ? {
          id: profile.id,
          name: profile.name,
          icon: profile.icon,
          isDefault: !!profile.is_default,
          assignedPlaylistId: profile.assigned_playlist_id,
          pin: profile.pin,
          allowedCategoryIds: parseIds(profile.allowed_categories),
          blockedCategoryIds: parseIds(profile.blocked_categories),
          favoriteChannelIds: parseIds(profile.favorites),
        }
      : null,
    playlist: playlist || null,
    channels,
    epgSources,
  });
});

module.exports = router;
