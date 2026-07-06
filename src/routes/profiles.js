const express = require('express');
const db = require('../db');

const router = express.Router({ mergeParams: true });

function getHousehold(householdId) {
  return db.prepare('SELECT id FROM households WHERE id = ?').get(householdId);
}

function parseIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
}

function serializeIds(value) {
  return JSON.stringify(parseIds(value));
}

function decorateProfile(profile) {
  if (!profile) return null;
  return {
    ...profile,
    is_default: !!profile.is_default,
    allowed_categories: JSON.parse(profile.allowed_categories || '[]'),
    blocked_categories: JSON.parse(profile.blocked_categories || '[]'),
    favorites: JSON.parse(profile.favorites || '[]'),
  };
}

function validatePlaylist(householdId, playlistId) {
  if (!playlistId) return true;
  return !!db.prepare('SELECT id FROM playlists WHERE id = ? AND household_id = ?').get(playlistId, householdId);
}

function validateCategories(playlistId, categoryIds) {
  if (!playlistId || categoryIds.length === 0) return true;
  const rows = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM playlist_categories
       WHERE playlist_id = ?
         AND id IN (${categoryIds.map(() => '?').join(',')})`
    )
    .get(playlistId, ...categoryIds);
  return rows.count === categoryIds.length;
}

router.get('/', (req, res) => {
  if (!getHousehold(req.params.id)) return res.status(404).json({ error: 'Household not found' });

  const profiles = db
    .prepare(
      `SELECT pr.*, p.name AS assigned_playlist_name
       FROM profiles pr
       LEFT JOIN playlists p ON p.id = pr.assigned_playlist_id
       WHERE pr.household_id = ?
       ORDER BY pr.is_default DESC, pr.created_at ASC`
    )
    .all(req.params.id)
    .map(decorateProfile);
  res.json(profiles);
});

router.post('/', (req, res) => {
  if (!getHousehold(req.params.id)) return res.status(404).json({ error: 'Household not found' });

  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Profile name is required' });

  const assignedPlaylistId = req.body.assigned_playlist_id || req.body.assignedPlaylistId || null;
  if (!validatePlaylist(req.params.id, assignedPlaylistId)) {
    return res.status(400).json({ error: 'Assigned playlist does not belong to this household' });
  }

  const allowedCategories = parseIds(req.body.allowed_categories || req.body.allowedCategories || []);
  if (!validateCategories(assignedPlaylistId, allowedCategories)) {
    return res.status(400).json({ error: 'Allowed categories must belong to the assigned playlist' });
  }

  const isDefault = req.body.is_default || req.body.isDefault ? 1 : 0;
  const createProfile = db.transaction(() => {
    if (isDefault) db.prepare('UPDATE profiles SET is_default = 0 WHERE household_id = ?').run(req.params.id);
    const result = db
      .prepare(
        `INSERT INTO profiles (
          household_id, name, icon, is_default, assigned_playlist_id, pin, allowed_categories, blocked_categories, favorites
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.params.id,
        name,
        req.body.icon || null,
        isDefault,
        assignedPlaylistId || null,
        req.body.pin || null,
        serializeIds(allowedCategories),
        serializeIds(req.body.blocked_categories || req.body.blockedCategories || []),
        serializeIds(req.body.favorites || [])
      );
    return db.prepare('SELECT * FROM profiles WHERE id = ?').get(result.lastInsertRowid);
  });

  res.status(201).json(decorateProfile(createProfile()));
});

router.put('/:profileId', (req, res) => {
  const profile = db
    .prepare('SELECT * FROM profiles WHERE id = ? AND household_id = ?')
    .get(req.params.profileId, req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  const updates = {};
  if ('name' in req.body) {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Profile name is required' });
    updates.name = name;
  }
  if ('icon' in req.body) updates.icon = req.body.icon || null;
  if ('pin' in req.body) updates.pin = req.body.pin || null;
  if ('is_default' in req.body || 'isDefault' in req.body) {
    updates.is_default = req.body.is_default || req.body.isDefault ? 1 : 0;
  }
  if ('assigned_playlist_id' in req.body || 'assignedPlaylistId' in req.body) {
    const assignedPlaylistId = req.body.assigned_playlist_id ?? req.body.assignedPlaylistId;
    if (assignedPlaylistId && !validatePlaylist(req.params.id, assignedPlaylistId)) {
      return res.status(400).json({ error: 'Assigned playlist does not belong to this household' });
    }
    updates.assigned_playlist_id = assignedPlaylistId || null;
  }

  const effectivePlaylistId =
    'assigned_playlist_id' in updates ? updates.assigned_playlist_id : profile.assigned_playlist_id;
  if ('allowed_categories' in req.body || 'allowedCategories' in req.body) {
    const allowedCategories = parseIds(req.body.allowed_categories || req.body.allowedCategories || []);
    if (!validateCategories(effectivePlaylistId, allowedCategories)) {
      return res.status(400).json({ error: 'Allowed categories must belong to the assigned playlist' });
    }
    updates.allowed_categories = serializeIds(allowedCategories);
  }
  if ('blocked_categories' in req.body || 'blockedCategories' in req.body) {
    updates.blocked_categories = serializeIds(req.body.blocked_categories || req.body.blockedCategories || []);
  }
  if ('favorites' in req.body) updates.favorites = serializeIds(req.body.favorites);

  const updateProfile = db.transaction(() => {
    if (updates.is_default) {
      db.prepare('UPDATE profiles SET is_default = 0 WHERE household_id = ? AND id != ?').run(
        req.params.id,
        req.params.profileId
      );
    }

    const fields = Object.keys(updates);
    if (fields.length > 0) {
      const setClause = fields.map((field) => `${field} = ?`).join(', ');
      db.prepare(`UPDATE profiles SET ${setClause} WHERE id = ?`).run(
        ...fields.map((field) => updates[field]),
        req.params.profileId
      );
    }

    return db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.params.profileId);
  });

  res.json(decorateProfile(updateProfile()));
});

router.delete('/:profileId', (req, res) => {
  const result = db.prepare('DELETE FROM profiles WHERE id = ? AND household_id = ?').run(
    req.params.profileId,
    req.params.id
  );
  if (result.changes === 0) return res.status(404).json({ error: 'Profile not found' });
  res.status(204).send();
});

module.exports = router;
