-- Meridian Hub SQLite schema

CREATE TABLE IF NOT EXISTS hub_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  setup_complete INTEGER NOT NULL DEFAULT 0,
  license_key TEXT,
  max_households INTEGER NOT NULL DEFAULT 5,
  jwt_secret TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO hub_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS households (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'en',
  theme TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('xtream', 'm3u')),
  server_url TEXT,
  username TEXT,
  password TEXT,
  url TEXT,
  sync_status TEXT NOT NULL DEFAULT 'never',
  sync_error TEXT,
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playlist_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  remote_id TEXT,
  name TEXT NOT NULL,
  custom_name TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  is_custom INTEGER NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (playlist_id, remote_id)
);

CREATE TABLE IF NOT EXISTS playlist_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES playlist_categories(id) ON DELETE SET NULL,
  remote_id TEXT,
  name TEXT NOT NULL,
  custom_name TEXT,
  stream_url TEXT NOT NULL,
  logo_url TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  tvg_id TEXT,
  group_title TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS epg_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('xmltv', 'xtream_builtin')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  assigned_playlist_id INTEGER REFERENCES playlists(id) ON DELETE SET NULL,
  pin TEXT,
  allowed_categories TEXT,
  blocked_categories TEXT,
  favorites TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'tvos', 'android', 'androidtv', 'firetv')),
  auth_token TEXT UNIQUE NOT NULL,
  assigned_profile_id INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_playlist_id INTEGER REFERENCES playlists(id) ON DELETE SET NULL,
  last_seen TEXT,
  app_version TEXT,
  push_pending INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Unclaimed pairing requests: created when the app registers a code, before
-- any household/device exists. Claimed (and deleted) once an admin matches
-- the code to a household, at which point a row is created in `devices`.
CREATE TABLE IF NOT EXISTS pairing_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  device_name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'tvos', 'android', 'androidtv', 'firetv')),
  claimed_device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
  claimed_token TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_playlists_household ON playlists(household_id);
CREATE INDEX IF NOT EXISTS idx_playlist_categories_playlist ON playlist_categories(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_channels_playlist ON playlist_channels(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_channels_category ON playlist_channels(category_id);
CREATE INDEX IF NOT EXISTS idx_epg_sources_household ON epg_sources(household_id);
CREATE INDEX IF NOT EXISTS idx_profiles_household ON profiles(household_id);
CREATE INDEX IF NOT EXISTS idx_devices_household ON devices(household_id);
CREATE INDEX IF NOT EXISTS idx_devices_auth_token ON devices(auth_token);
CREATE INDEX IF NOT EXISTS idx_pairing_requests_code ON pairing_requests(code);
