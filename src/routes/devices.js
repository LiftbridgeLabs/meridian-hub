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

router.delete('/:deviceId', (req, res) => {
  const result = db
    .prepare('DELETE FROM devices WHERE id = ? AND household_id = ?')
    .run(req.params.deviceId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Device not found' });
  res.status(204).send();
});

module.exports = router;
