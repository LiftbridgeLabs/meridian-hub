const crypto = require('crypto');
const db = require('./index');

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  const row = db.prepare('SELECT jwt_secret FROM hub_settings WHERE id = 1').get();
  if (row.jwt_secret) return row.jwt_secret;

  const secret = crypto.randomBytes(48).toString('hex');
  db.prepare('UPDATE hub_settings SET jwt_secret = ? WHERE id = 1').run(secret);
  return secret;
}

module.exports = { getJwtSecret };
