const express = require('express');
const db = require('../db');
const { VALID_PLATFORMS, normalizeCode, getHubUrl, generateDeviceToken } = require('../lib/pairing');

const router = express.Router();

router.post('/redeem', (req, res) => {
  const code = normalizeCode(req.body.code);
  const deviceName = String(req.body.device_name || req.body.deviceName || '').trim();
  const platform = String(req.body.platform || '').trim().toLowerCase();
  const deviceIdentifier = String(req.body.device_identifier || req.body.deviceIdentifier || '').trim() || null;

  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Management code must be 6 digits' });
  }
  if (!VALID_PLATFORMS.has(platform)) {
    return res.status(400).json({ error: 'Platform is not supported' });
  }

  const managementCode = db.prepare('SELECT * FROM management_codes WHERE code = ?').get(code);
  if (!managementCode) return res.status(404).json({ error: 'Management code not found' });
  if (managementCode.redeemed_device_id) {
    return res.status(409).json({ error: 'Management code has already been redeemed' });
  }
  if (new Date(`${managementCode.expires_at}Z`) <= new Date()) {
    return res.status(410).json({ error: 'Management code has expired' });
  }

  const token = generateDeviceToken();
  const finalDeviceName = deviceName || managementCode.device_name;

  const existingDevice = deviceIdentifier
    ? db
        .prepare('SELECT * FROM devices WHERE household_id = ? AND device_identifier = ?')
        .get(managementCode.household_id, deviceIdentifier)
    : null;

  const redeem = db.transaction(() => {
    let deviceId;
    if (existingDevice) {
      db.prepare('UPDATE devices SET name = ?, platform = ?, auth_token = ? WHERE id = ?').run(
        finalDeviceName,
        platform,
        token,
        existingDevice.id
      );
      deviceId = existingDevice.id;
    } else {
      const result = db
        .prepare(
          `INSERT INTO devices (
            household_id, name, platform, auth_token, device_identifier, assigned_profile_id, assigned_playlist_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          managementCode.household_id,
          finalDeviceName,
          platform,
          token,
          deviceIdentifier,
          managementCode.assigned_profile_id,
          managementCode.assigned_playlist_id
        );
      deviceId = result.lastInsertRowid;
    }

    db.prepare('UPDATE management_codes SET redeemed_device_id = ? WHERE id = ?').run(deviceId, managementCode.id);

    return deviceId;
  });

  const deviceId = redeem();
  res.status(201).json({ authToken: token, hubUrl: getHubUrl(req), deviceId });
});

module.exports = router;
