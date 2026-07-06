const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../db/settings');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    req.admin = jwt.verify(token, getJwtSecret());
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireDeviceAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing device token' });

  const db = require('../db');
  const device = db
    .prepare(
      `SELECT d.*, h.enabled AS household_enabled
       FROM devices d
       JOIN households h ON h.id = d.household_id
       WHERE d.auth_token = ?`
    )
    .get(token);

  if (!device) return res.status(401).json({ error: 'Invalid device token' });
  if (!device.household_enabled) return res.status(403).json({ error: 'Household is disabled' });

  req.device = device;
  next();
}

module.exports = { requireAuth, requireDeviceAuth };
