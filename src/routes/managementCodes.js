const crypto = require('crypto');
const express = require('express');
const db = require('../db');

const router = express.Router({ mergeParams: true });

const MANAGEMENT_CODE_TTL_DAYS = 7;

function getHousehold(householdId) {
  return db.prepare('SELECT id FROM households WHERE id = ?').get(householdId);
}

function generateUniqueCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const existing = db.prepare('SELECT id FROM management_codes WHERE code = ?').get(code);
    if (!existing) return code;
  }
  throw new Error('Could not generate a unique management code');
}

router.get('/', (req, res) => {
  if (!getHousehold(req.params.id)) return res.status(404).json({ error: 'Household not found' });
  const codes = db
    .prepare('SELECT * FROM management_codes WHERE household_id = ? ORDER BY created_at DESC')
    .all(req.params.id);
  res.json(codes);
});

router.post('/', (req, res) => {
  if (!getHousehold(req.params.id)) return res.status(404).json({ error: 'Household not found' });

  const deviceName = String(req.body.device_name || req.body.deviceName || '').trim();
  if (!deviceName) return res.status(400).json({ error: 'Device name is required' });

  const assignedProfileId = req.body.assigned_profile_id || req.body.assignedProfileId || null;
  const assignedPlaylistId = req.body.assigned_playlist_id || req.body.assignedPlaylistId || null;

  if (assignedProfileId) {
    const profile = db
      .prepare('SELECT id FROM profiles WHERE id = ? AND household_id = ?')
      .get(assignedProfileId, req.params.id);
    if (!profile) return res.status(400).json({ error: 'Assigned profile does not belong to this household' });
  }
  if (assignedPlaylistId) {
    const playlist = db
      .prepare('SELECT id FROM playlists WHERE id = ? AND household_id = ?')
      .get(assignedPlaylistId, req.params.id);
    if (!playlist) return res.status(400).json({ error: 'Assigned playlist does not belong to this household' });
  }

  const code = generateUniqueCode();
  const expiresAt = db
    .prepare(`SELECT datetime('now', ?) AS expires_at`)
    .get(`+${MANAGEMENT_CODE_TTL_DAYS} days`).expires_at;

  const result = db
    .prepare(
      `INSERT INTO management_codes (code, household_id, device_name, assigned_profile_id, assigned_playlist_id, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(code, req.params.id, deviceName, assignedProfileId, assignedPlaylistId, expiresAt);

  res.status(201).json(db.prepare('SELECT * FROM management_codes WHERE id = ?').get(result.lastInsertRowid));
});

router.delete('/:codeId', (req, res) => {
  const result = db
    .prepare('DELETE FROM management_codes WHERE id = ? AND household_id = ?')
    .run(req.params.codeId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Management code not found' });
  res.status(204).send();
});

module.exports = router;
