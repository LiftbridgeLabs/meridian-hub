const crypto = require('crypto');

const VALID_PLATFORMS = new Set(['ios', 'tvos', 'android', 'androidtv', 'firetv']);

function normalizeCode(code) {
  return String(code || '').trim();
}

function getHubUrl(req) {
  if (process.env.HUB_URL) return process.env.HUB_URL;
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}`;
}

function generateDeviceToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { VALID_PLATFORMS, normalizeCode, getHubUrl, generateDeviceToken };
