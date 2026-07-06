const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const playlistRoutes = require('./playlists');

const router = express.Router();
router.use(requireAuth);
router.use('/:id/playlists', playlistRoutes);

const HOUSEHOLD_FIELDS = ['name', 'enabled', 'timezone', 'language', 'theme'];

router.get('/', (req, res) => {
  const households = db
    .prepare(
      `SELECT h.*, COUNT(d.id) AS device_count
       FROM households h
       LEFT JOIN devices d ON d.household_id = h.id
       GROUP BY h.id
       ORDER BY h.created_at DESC`
    )
    .all();
  res.json(households);
});

router.post('/', (req, res) => {
  const { name, timezone, language } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Household name is required' });
  }

  const { count } = db.prepare('SELECT COUNT(*) AS count FROM households').get();
  const { max_households: maxHouseholds } = db
    .prepare('SELECT max_households FROM hub_settings WHERE id = 1')
    .get();
  if (count >= maxHouseholds) {
    return res.status(403).json({
      error: `Household limit reached (${maxHouseholds}). Upgrade to Pro for unlimited households.`,
    });
  }

  const result = db
    .prepare('INSERT INTO households (name, timezone, language) VALUES (?, ?, ?)')
    .run(name.trim(), timezone || 'UTC', language || 'en');
  const household = db.prepare('SELECT * FROM households WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(household);
});

router.get('/:id', (req, res) => {
  const household = db.prepare('SELECT * FROM households WHERE id = ?').get(req.params.id);
  if (!household) return res.status(404).json({ error: 'Household not found' });
  res.json(household);
});

router.put('/:id', (req, res) => {
  const household = db.prepare('SELECT * FROM households WHERE id = ?').get(req.params.id);
  if (!household) return res.status(404).json({ error: 'Household not found' });

  const updates = {};
  for (const field of HOUSEHOLD_FIELDS) {
    if (field in req.body) updates[field] = req.body[field];
  }
  if ('name' in updates && !updates.name.trim()) {
    return res.status(400).json({ error: 'Household name cannot be empty' });
  }
  if ('enabled' in updates) updates.enabled = updates.enabled ? 1 : 0;

  const fields = Object.keys(updates);
  if (fields.length > 0) {
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    db.prepare(`UPDATE households SET ${setClause} WHERE id = ?`).run(
      ...fields.map((f) => updates[f]),
      req.params.id
    );
  }

  res.json(db.prepare('SELECT * FROM households WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM households WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Household not found' });
  res.status(204).send();
});

module.exports = router;
