const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { getJwtSecret } = require('../db/settings');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function issueToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, getJwtSecret(), { expiresIn: '30d' });
}

router.get('/setup-status', (req, res) => {
  const settings = db.prepare('SELECT setup_complete FROM hub_settings WHERE id = 1').get();
  res.json({ setupComplete: !!settings.setup_complete });
});

router.post('/setup', (req, res) => {
  const settings = db.prepare('SELECT setup_complete FROM hub_settings WHERE id = 1').get();
  if (settings.setup_complete) {
    return res.status(409).json({ error: 'Setup has already been completed' });
  }

  const { username, password } = req.body;
  if (!username || !password || password.length < 8) {
    return res.status(400).json({ error: 'Username and a password of at least 8 characters are required' });
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  const result = db
    .prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)')
    .run(username, passwordHash);
  db.prepare('UPDATE hub_settings SET setup_complete = 1 WHERE id = 1').run();

  const token = issueToken({ id: result.lastInsertRowid, username });
  res.status(201).json({ token });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  res.json({ token: issueToken(user) });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db
    .prepare('SELECT id, username, role, created_at FROM admin_users WHERE id = ?')
    .get(req.admin.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

module.exports = router;
