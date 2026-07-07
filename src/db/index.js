const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/meridian.db');

fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });

const db = new Database(DATABASE_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

const hubSettingsColumns = db.prepare('PRAGMA table_info(hub_settings)').all().map((c) => c.name);
if (!hubSettingsColumns.includes('jwt_secret')) {
  db.exec('ALTER TABLE hub_settings ADD COLUMN jwt_secret TEXT');
}
for (const column of ['hub_name', 'logo_mime', 'logo_data', 'logo_updated_at']) {
  if (hubSettingsColumns.includes(column)) {
    db.exec(`ALTER TABLE hub_settings DROP COLUMN ${column}`);
  }
}

const playlistColumns = db.prepare('PRAGMA table_info(playlists)').all().map((c) => c.name);
if (!playlistColumns.includes('sync_status')) {
  db.exec("ALTER TABLE playlists ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'never'");
}
if (!playlistColumns.includes('sync_error')) {
  db.exec('ALTER TABLE playlists ADD COLUMN sync_error TEXT');
}
if (!playlistColumns.includes('last_synced_at')) {
  db.exec('ALTER TABLE playlists ADD COLUMN last_synced_at TEXT');
}

const playlistCategoryColumns = db.prepare('PRAGMA table_info(playlist_categories)').all().map((c) => c.name);
if (!playlistCategoryColumns.includes('custom_name')) {
  db.exec('ALTER TABLE playlist_categories ADD COLUMN custom_name TEXT');
}
if (!playlistCategoryColumns.includes('enabled')) {
  db.exec('ALTER TABLE playlist_categories ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1');
}
if (!playlistCategoryColumns.includes('is_custom')) {
  db.exec('ALTER TABLE playlist_categories ADD COLUMN is_custom INTEGER NOT NULL DEFAULT 0');
}

const playlistChannelColumns = db.prepare('PRAGMA table_info(playlist_channels)').all().map((c) => c.name);
if (!playlistChannelColumns.includes('custom_name')) {
  db.exec('ALTER TABLE playlist_channels ADD COLUMN custom_name TEXT');
}
if (!playlistChannelColumns.includes('enabled')) {
  db.exec('ALTER TABLE playlist_channels ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1');
}

const profileColumns = db.prepare('PRAGMA table_info(profiles)').all().map((c) => c.name);
if (!profileColumns.includes('assigned_playlist_id')) {
  db.exec('ALTER TABLE profiles ADD COLUMN assigned_playlist_id INTEGER REFERENCES playlists(id) ON DELETE SET NULL');
}

const deviceColumns = db.prepare('PRAGMA table_info(devices)').all().map((c) => c.name);
if (!deviceColumns.includes('device_identifier')) {
  db.exec('ALTER TABLE devices ADD COLUMN device_identifier TEXT');
}
db.exec(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_household_identifier
   ON devices(household_id, device_identifier)
   WHERE device_identifier IS NOT NULL`
);

const pairingRequestColumns = db.prepare('PRAGMA table_info(pairing_requests)').all().map((c) => c.name);
if (!pairingRequestColumns.includes('device_identifier')) {
  db.exec('ALTER TABLE pairing_requests ADD COLUMN device_identifier TEXT');
}

module.exports = db;
