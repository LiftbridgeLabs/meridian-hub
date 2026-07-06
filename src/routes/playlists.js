const express = require('express');
const db = require('../db');
const { testPlaylist } = require('../lib/playlistTest');
const { syncPlaylist } = require('../lib/playlistSync');

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

function refreshCategoryCounts(playlistId) {
  db.prepare(
    `UPDATE playlist_categories
     SET item_count = (
       SELECT COUNT(*) FROM playlist_channels WHERE playlist_channels.category_id = playlist_categories.id
     )
     WHERE playlist_id = ?`
  ).run(playlistId);
}

router.get('/', (req, res) => {
  if (!getHousehold(req.params.id)) return res.status(404).json({ error: 'Household not found' });
  const playlists = db
    .prepare(
      `SELECT
        p.*,
        COUNT(DISTINCT c.id) AS category_count,
        COUNT(DISTINCT ch.id) AS channel_count
       FROM playlists p
       LEFT JOIN playlist_categories c ON c.playlist_id = p.id
       LEFT JOIN playlist_channels ch ON ch.playlist_id = p.id
       WHERE p.household_id = ?
       GROUP BY p.id
       ORDER BY p.created_at DESC`
    )
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

router.post('/:playlistId/sync', async (req, res) => {
  const playlist = db
    .prepare('SELECT * FROM playlists WHERE id = ? AND household_id = ?')
    .get(req.params.playlistId, req.params.id);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

  try {
    const result = await syncPlaylist(db, playlist);
    res.json({
      ...result,
      playlist: db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.playlistId),
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/:playlistId/categories', (req, res) => {
  const playlist = db
    .prepare('SELECT id FROM playlists WHERE id = ? AND household_id = ?')
    .get(req.params.playlistId, req.params.id);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

  const categories = db
    .prepare(
      `SELECT
        *,
        COALESCE(NULLIF(custom_name, ''), name) AS display_name
       FROM playlist_categories
       WHERE playlist_id = ?
       ORDER BY is_custom DESC, display_name COLLATE NOCASE ASC`
    )
    .all(req.params.playlistId);
  res.json(categories);
});

router.post('/:playlistId/categories', (req, res) => {
  const playlist = db
    .prepare('SELECT id FROM playlists WHERE id = ? AND household_id = ?')
    .get(req.params.playlistId, req.params.id);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Category name is required' });

  const result = db
    .prepare(
      `INSERT INTO playlist_categories (playlist_id, remote_id, name, custom_name, enabled, is_custom, item_count)
       VALUES (?, NULL, ?, NULL, 1, 1, 0)`
    )
    .run(req.params.playlistId, name);

  res.status(201).json(
    db
      .prepare(
        `SELECT *, COALESCE(NULLIF(custom_name, ''), name) AS display_name
         FROM playlist_categories
         WHERE id = ?`
      )
      .get(result.lastInsertRowid)
  );
});

router.patch('/:playlistId/categories/:categoryId', (req, res) => {
  const category = db
    .prepare(
      `SELECT c.*
       FROM playlist_categories c
       JOIN playlists p ON p.id = c.playlist_id
       WHERE c.id = ? AND c.playlist_id = ? AND p.household_id = ?`
    )
    .get(req.params.categoryId, req.params.playlistId, req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found' });

  const updates = {};
  if ('enabled' in req.body) updates.enabled = req.body.enabled ? 1 : 0;
  if ('custom_name' in req.body || 'customName' in req.body) {
    const value = String(req.body.custom_name ?? req.body.customName ?? '').trim();
    updates.custom_name = value || null;
  }
  if ('name' in req.body && category.is_custom) {
    const value = String(req.body.name || '').trim();
    if (!value) return res.status(400).json({ error: 'Category name is required' });
    updates.name = value;
  }

  const fields = Object.keys(updates);
  if (fields.length > 0) {
    const setClause = fields.map((field) => `${field} = ?`).join(', ');
    db.prepare(`UPDATE playlist_categories SET ${setClause} WHERE id = ?`).run(
      ...fields.map((field) => updates[field]),
      req.params.categoryId
    );
  }

  if ('enabled' in updates && req.body.applyToChannels) {
    db.prepare('UPDATE playlist_channels SET enabled = ? WHERE category_id = ?').run(
      updates.enabled,
      req.params.categoryId
    );
  }

  res.json(
    db
      .prepare(
        `SELECT *, COALESCE(NULLIF(custom_name, ''), name) AS display_name
         FROM playlist_categories
         WHERE id = ?`
      )
      .get(req.params.categoryId)
  );
});

router.delete('/:playlistId/categories/:categoryId', (req, res) => {
  const category = db
    .prepare(
      `SELECT c.*
       FROM playlist_categories c
       JOIN playlists p ON p.id = c.playlist_id
       WHERE c.id = ? AND c.playlist_id = ? AND p.household_id = ?`
    )
    .get(req.params.categoryId, req.params.playlistId, req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  if (!category.is_custom) return res.status(400).json({ error: 'Only custom categories can be deleted' });

  const removeCategory = db.transaction(() => {
    db.prepare('UPDATE playlist_channels SET category_id = NULL WHERE category_id = ?').run(req.params.categoryId);
    db.prepare('DELETE FROM playlist_categories WHERE id = ?').run(req.params.categoryId);
    refreshCategoryCounts(req.params.playlistId);
  });
  removeCategory();
  res.status(204).send();
});

router.get('/:playlistId/channels', (req, res) => {
  const playlist = db
    .prepare('SELECT id FROM playlists WHERE id = ? AND household_id = ?')
    .get(req.params.playlistId, req.params.id);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const categoryId = req.query.category_id || req.query.categoryId || null;
  const search = String(req.query.search || '').trim();
  const visibility = String(req.query.visibility || 'all');
  const conditions = ['ch.playlist_id = ?'];
  const params = [req.params.playlistId];

  if (categoryId) {
    conditions.push('ch.category_id = ?');
    params.push(categoryId);
  }
  if (search) {
    conditions.push('(ch.name LIKE ? OR ch.custom_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (visibility === 'visible') {
    conditions.push('ch.enabled = 1');
  }
  if (visibility === 'hidden') {
    conditions.push('ch.enabled = 0');
  }

  const channels = db
    .prepare(
      `SELECT
        ch.id,
        ch.playlist_id,
        ch.category_id,
        ch.remote_id,
        ch.name,
        ch.custom_name,
        COALESCE(NULLIF(ch.custom_name, ''), ch.name) AS display_name,
        ch.logo_url,
        ch.enabled,
        ch.sort_order,
        ch.tvg_id,
        ch.group_title,
        c.name AS category_name,
        c.custom_name AS category_custom_name,
        COALESCE(NULLIF(c.custom_name, ''), c.name) AS category_display_name
       FROM playlist_channels ch
       LEFT JOIN playlist_categories c ON c.id = ch.category_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ch.sort_order ASC, ch.name COLLATE NOCASE ASC
       LIMIT ?`
    )
    .all(...params, limit);
  res.json(channels);
});

router.patch('/:playlistId/channels/:channelId', (req, res) => {
  const channel = db
    .prepare(
      `SELECT ch.*
       FROM playlist_channels ch
       JOIN playlists p ON p.id = ch.playlist_id
       WHERE ch.id = ? AND ch.playlist_id = ? AND p.household_id = ?`
    )
    .get(req.params.channelId, req.params.playlistId, req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const updates = {};
  if ('enabled' in req.body) updates.enabled = req.body.enabled ? 1 : 0;
  if ('custom_name' in req.body || 'customName' in req.body) {
    const value = String(req.body.custom_name ?? req.body.customName ?? '').trim();
    updates.custom_name = value || null;
  }
  if ('category_id' in req.body || 'categoryId' in req.body) {
    const categoryId = req.body.category_id ?? req.body.categoryId;
    if (categoryId === null || categoryId === '') {
      updates.category_id = null;
    } else {
      const category = db
        .prepare('SELECT id FROM playlist_categories WHERE id = ? AND playlist_id = ?')
        .get(categoryId, req.params.playlistId);
      if (!category) return res.status(400).json({ error: 'Category does not belong to this playlist' });
      updates.category_id = categoryId;
    }
  }

  const fields = Object.keys(updates);
  if (fields.length > 0) {
    const setClause = fields.map((field) => `${field} = ?`).join(', ');
    db.prepare(`UPDATE playlist_channels SET ${setClause} WHERE id = ?`).run(
      ...fields.map((field) => updates[field]),
      req.params.channelId
    );
    if ('category_id' in updates) refreshCategoryCounts(req.params.playlistId);
  }

  res.json(
    db
      .prepare(
        `SELECT
          ch.*,
          COALESCE(NULLIF(ch.custom_name, ''), ch.name) AS display_name,
          c.name AS category_name,
          c.custom_name AS category_custom_name,
          COALESCE(NULLIF(c.custom_name, ''), c.name) AS category_display_name
         FROM playlist_channels ch
         LEFT JOIN playlist_categories c ON c.id = ch.category_id
         WHERE ch.id = ?`
      )
      .get(req.params.channelId)
  );
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
