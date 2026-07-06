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
if (!hubSettingsColumns.includes('logo_mime')) {
  db.exec('ALTER TABLE hub_settings ADD COLUMN logo_mime TEXT');
}
if (!hubSettingsColumns.includes('logo_data')) {
  db.exec('ALTER TABLE hub_settings ADD COLUMN logo_data BLOB');
}
if (!hubSettingsColumns.includes('logo_updated_at')) {
  db.exec('ALTER TABLE hub_settings ADD COLUMN logo_updated_at TEXT');
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
if (!playlistCategoryColumns.includes('enabled')) {
  db.exec('ALTER TABLE playlist_categories ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1');
}

const playlistChannelColumns = db.prepare('PRAGMA table_info(playlist_channels)').all().map((c) => c.name);
if (!playlistChannelColumns.includes('custom_name')) {
  db.exec('ALTER TABLE playlist_channels ADD COLUMN custom_name TEXT');
}
if (!playlistChannelColumns.includes('enabled')) {
  db.exec('ALTER TABLE playlist_channels ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1');
}

module.exports = db;
