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

router.put('/password', requireAuth, (req, res) => {
  const currentPassword = req.body.current_password || req.body.currentPassword;
  const newPassword = req.body.new_password || req.body.newPassword;

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.admin.id);
  if (!user || !bcrypt.compareSync(currentPassword || '', user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const passwordHash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);
  res.json({ ok: true });
});

router.get('/users', requireAuth, (req, res) => {
  const users = db.prepare('SELECT id, username, role, created_at FROM admin_users ORDER BY created_at ASC').all();
  res.json(users);
});

router.post('/users', requireAuth, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || password.length < 8) {
    return res.status(400).json({ error: 'Username and a password of at least 8 characters are required' });
  }

  const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'That username is already taken' });

  const passwordHash = bcrypt.hashSync(password, 12);
  const result = db
    .prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)')
    .run(username, passwordHash);
  res
    .status(201)
    .json(db.prepare('SELECT id, username, role, created_at FROM admin_users WHERE id = ?').get(result.lastInsertRowid));
});

router.delete('/users/:id', requireAuth, (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.admin.id) {
    return res.status(400).json({ error: 'You cannot remove your own account' });
  }

  const { count } = db.prepare('SELECT COUNT(*) AS count FROM admin_users').get();
  if (count <= 1) {
    return res.status(400).json({ error: 'Cannot remove the last remaining admin account' });
  }

  const result = db.prepare('DELETE FROM admin_users WHERE id = ?').run(targetId);
  if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.status(204).send();
});

module.exports = router;
