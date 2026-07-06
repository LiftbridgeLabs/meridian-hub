const express = require('express');
const db = require('../db');
const { testPlaylist } = require('../lib/playlistTest');

const router = express.Router({ mergeParams: true });

const PLAYLIST_FIELDS = ['name', 'type', 'server_url', 'username', 'password', 'url'];

function getHousehold(householdId) {
  return db.prepare('SELECT id FROM households WHERE id = ?').get(householdId);
}

function validatePlaylist(body, { partial = false, skipName = false } = {}) {
  if (!skipName && (!partial || 'name' in body)) {
    if (!body.name || !body.name.trim()) return 'Playlist name is required';
  }
  if (!partial || 'type' in body) {
    if (!['xtream', 'm3u'].includes(body.type)) return 'Type must be xtream or m3u';
  }
  if (body.type === 'xtream' && (!body.server_url || !body.username || !body.password)) {
    return 'Xtream playlists require a server URL, username, and password';
  }
  if (body.type === 'm3u' && !body.url) {
    return 'M3U playlists require a URL';
  }
  return null;
}

router.get('/', (req, res) => {
  if (!getHousehold(req.params.id)) return res.status(404).json({ error: 'Household not found' });
  const playlists = db
    .prepare('SELECT * FROM playlists WHERE household_id = ? ORDER BY created_at DESC')
    .all(req.params.id);
  res.json(playlists);
});

router.post('/', (req, res) => {
  if (!getHousehold(req.params.id)) return res.status(404).json({ error: 'Household not found' });

  const error = validatePlaylist(req.body);
  if (error) return res.status(400).json({ error });

  const { name, type, server_url, username, password, url } = req.body;
  const result = db
    .prepare(
      'INSERT INTO playlists (household_id, name, type, server_url, username, password, url) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(req.params.id, name.trim(), type, server_url || null, username || null, password || null, url || null);

  res.status(201).json(db.prepare('SELECT * FROM playlists WHERE id = ?').get(result.lastInsertRowid));
});

router.post('/test', async (req, res) => {
  if (!getHousehold(req.params.id)) return res.status(404).json({ error: 'Household not found' });

  const error = validatePlaylist(req.body, { skipName: true });
  if (error) return res.status(400).json({ error });

  try {
    const result = await testPlaylist(req.body);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.put('/:playlistId', (req, res) => {
  const playlist = db
    .prepare('SELECT * FROM playlists WHERE id = ? AND household_id = ?')
    .get(req.params.playlistId, req.params.id);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

  const merged = { ...playlist, ...req.body };
  const error = validatePlaylist(merged);
  if (error) return res.status(400).json({ error });

  const updates = {};
  for (const field of PLAYLIST_FIELDS) {
    if (field in req.body) updates[field] = req.body[field];
  }

  const keys = Object.keys(updates);
  if (keys.length > 0) {
    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    db.prepare(`UPDATE playlists SET ${setClause} WHERE id = ?`).run(
      ...keys.map((k) => updates[k]),
      req.params.playlistId
    );
  }

  res.json(db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.playlistId));
});

router.delete('/:playlistId', (req, res) => {
  const result = db
    .prepare('DELETE FROM playlists WHERE id = ? AND household_id = ?')
    .run(req.params.playlistId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Playlist not found' });
  res.status(204).send();
});

module.exports = router;
