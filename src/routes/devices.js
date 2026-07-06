const express = require('express');
const db = require('../db');

const router = express.Router({ mergeParams: true });

function getHousehold(householdId) {
  return db.prepare('SELECT id FROM households WHERE id = ?').get(householdId);
}

router.get('/', (req, res) => {
  if (!getHousehold(req.params.id)) return res.status(404).json({ error: 'Household not found' });

  const devices = db
    .prepare(
      `SELECT
        d.id,
        d.household_id,
        d.name,
        d.platform,
        d.assigned_profile_id,
        d.assigned_playlist_id,
        d.last_seen,
        d.app_version,
        d.push_pending,
        d.created_at,
        p.name AS assigned_playlist_name,
        pr.name AS assigned_profile_name
       FROM devices d
       LEFT JOIN playlists p ON p.id = d.assigned_playlist_id
       LEFT JOIN profiles pr ON pr.id = d.assigned_profile_id
       WHERE d.household_id = ?
       ORDER BY d.created_at DESC`
    )
    .all(req.params.id);

  res.json(devices);
});

router.put('/:deviceId', (req, res) => {
  const device = db
    .prepare('SELECT * FROM devices WHERE id = ? AND household_id = ?')
    .get(req.params.deviceId, req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const updates = {};
  if ('name' in req.body) {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Device name is required' });
    updates.name = name;
  }
  if ('assigned_profile_id' in req.body || 'assignedProfileId' in req.body) {
    const profileId = req.body.assigned_profile_id ?? req.body.assignedProfileId;
    if (profileId) {
      const profile = db.prepare('SELECT id FROM profiles WHERE id = ? AND household_id = ?').get(profileId, req.params.id);
      if (!profile) return res.status(400).json({ error: 'Profile does not belong to this household' });
    }
    updates.assigned_profile_id = profileId || null;
  }
  if ('assigned_playlist_id' in req.body || 'assignedPlaylistId' in req.body) {
    const playlistId = req.body.assigned_playlist_id ?? req.body.assignedPlaylistId;
    if (playlistId) {
      const playlist = db
        .prepare('SELECT id FROM playlists WHERE id = ? AND household_id = ?')
        .get(playlistId, req.params.id);
      if (!playlist) return res.status(400).json({ error: 'Playlist does not belong to this household' });
    }
    updates.assigned_playlist_id = playlistId || null;
  }

  const fields = Object.keys(updates);
  if (fields.length > 0) {
    const setClause = fields.map((field) => `${field} = ?`).join(', ');
    db.prepare(`UPDATE devices SET ${setClause}, push_pending = 1 WHERE id = ?`).run(
      ...fields.map((field) => updates[field]),
      req.params.deviceId
    );
  }

  res.json(db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.deviceId));
});

router.post('/:deviceId/refresh', (req, res) => {
  const result = db
    .prepare('UPDATE devices SET push_pending = 1 WHERE id = ? AND household_id = ?')
    .run(req.params.deviceId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Device not found' });
  res.json(db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.deviceId));
});

router.delete('/:deviceId', (req, res) => {
  const result = db
    .prepare('DELETE FROM devices WHERE id = ? AND household_id = ?')
    .run(req.params.deviceId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Device not found' });
  res.status(204).send();
});

module.exports = router;
