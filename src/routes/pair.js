const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_PLATFORMS = new Set(['ios', 'tvos', 'android', 'androidtv', 'firetv']);
const PAIRING_TTL_MINUTES = 15;

function cleanExpiredPairingRequests() {
  db.prepare(
    `DELETE FROM pairing_requests
     WHERE claimed_device_id IS NULL
       AND datetime(expires_at) <= datetime('now')`
  ).run();
}

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

function pairingPayload(req, code) {
  const hubUrl = getHubUrl(req);
  return {
    hubUrl,
    code,
    deepLink: `meridian://pair?hub=${encodeURIComponent(hubUrl)}&code=${encodeURIComponent(code)}`,
  };
}

router.post('/register', (req, res) => {
  cleanExpiredPairingRequests();

  const code = normalizeCode(req.body.code);
  const deviceName = String(req.body.device_name || req.body.deviceName || '').trim();
  const platform = String(req.body.platform || '').trim().toLowerCase();

  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Pairing code must be 6 digits' });
  }
  if (!deviceName) {
    return res.status(400).json({ error: 'Device name is required' });
  }
  if (!VALID_PLATFORMS.has(platform)) {
    return res.status(400).json({ error: 'Platform is not supported' });
  }

  const existing = db.prepare('SELECT * FROM pairing_requests WHERE code = ?').get(code);
  if (existing && existing.claimed_device_id) {
    return res.status(409).json({ error: 'Pairing code has already been claimed' });
  }
  if (existing) {
    return res.status(409).json({ error: 'Pairing code is already pending' });
  }

  const expiresAt = db
    .prepare(`SELECT datetime('now', ?) AS expires_at`)
    .get(`+${PAIRING_TTL_MINUTES} minutes`).expires_at;

  db.prepare(
    `INSERT INTO pairing_requests (code, device_name, platform, expires_at)
     VALUES (?, ?, ?, ?)`
  ).run(code, deviceName, platform, expiresAt);

  res.status(201).json({
    status: 'pending',
    code,
    expiresAt,
    pairing: pairingPayload(req, code),
  });
});

router.get('/status/:code', (req, res) => {
  const code = normalizeCode(req.params.code);
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Pairing code must be 6 digits' });
  }

  const request = db.prepare('SELECT * FROM pairing_requests WHERE code = ?').get(code);
  if (!request) return res.status(404).json({ status: 'not_found' });

  if (!request.claimed_device_id && new Date(`${request.expires_at}Z`) <= new Date()) {
    db.prepare('DELETE FROM pairing_requests WHERE id = ?').run(request.id);
    return res.status(410).json({ status: 'expired' });
  }

  if (!request.claimed_device_id) {
    return res.json({
      status: 'pending',
      code,
      deviceName: request.device_name,
      platform: request.platform,
      expiresAt: request.expires_at,
      pairing: pairingPayload(req, code),
    });
  }

  res.json({
    status: 'claimed',
    code,
    deviceId: request.claimed_device_id,
    authToken: request.claimed_token,
    hubUrl: getHubUrl(req),
    pairing: pairingPayload(req, code),
  });
});

router.post('/claim', requireAuth, (req, res) => {
  cleanExpiredPairingRequests();

  const code = normalizeCode(req.body.code);
  const householdId = Number(req.body.household_id || req.body.householdId);
  const requestedName = String(req.body.device_name || req.body.deviceName || '').trim();
  const assignedProfileId = req.body.assigned_profile_id || req.body.assignedProfileId || null;
  const assignedPlaylistId = req.body.assigned_playlist_id || req.body.assignedPlaylistId || null;

  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Pairing code must be 6 digits' });
  }
  if (!householdId) {
    return res.status(400).json({ error: 'Household is required' });
  }

  const household = db.prepare('SELECT id FROM households WHERE id = ?').get(householdId);
  if (!household) return res.status(404).json({ error: 'Household not found' });

  const request = db.prepare('SELECT * FROM pairing_requests WHERE code = ?').get(code);
  if (!request) return res.status(404).json({ error: 'Pairing code not found' });
  if (request.claimed_device_id) return res.status(409).json({ error: 'Pairing code has already been claimed' });
  if (new Date(`${request.expires_at}Z`) <= new Date()) {
    db.prepare('DELETE FROM pairing_requests WHERE id = ?').run(request.id);
    return res.status(410).json({ error: 'Pairing code has expired' });
  }

  if (assignedProfileId) {
    const profile = db
      .prepare('SELECT id FROM profiles WHERE id = ? AND household_id = ?')
      .get(assignedProfileId, householdId);
    if (!profile) return res.status(400).json({ error: 'Assigned profile does not belong to this household' });
  }

  if (assignedPlaylistId) {
    const playlist = db
      .prepare('SELECT id FROM playlists WHERE id = ? AND household_id = ?')
      .get(assignedPlaylistId, householdId);
    if (!playlist) return res.status(400).json({ error: 'Assigned playlist does not belong to this household' });
  }

  const token = generateDeviceToken();
  const deviceName = requestedName || request.device_name;

  const claimPairing = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO devices (
          household_id, name, platform, auth_token, assigned_profile_id, assigned_playlist_id
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(householdId, deviceName, request.platform, token, assignedProfileId, assignedPlaylistId);

    db.prepare(
      `UPDATE pairing_requests
       SET claimed_device_id = ?, claimed_token = ?
       WHERE id = ?`
    ).run(result.lastInsertRowid, token, request.id);

    return db.prepare('SELECT * FROM devices WHERE id = ?').get(result.lastInsertRowid);
  });

  const device = claimPairing();
  res.status(201).json({
    status: 'claimed',
    device,
    authToken: token,
    hubUrl: getHubUrl(req),
  });
});

module.exports = router;
