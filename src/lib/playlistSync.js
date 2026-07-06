async function fetchWithTimeout(url, ms = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Server responded with HTTP ${res.status}`);
    return res;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out');
    throw new Error(err.cause?.code || err.cause?.message || err.message);
  } finally {
    clearTimeout(timeout);
  }
}

function attr(line, name) {
  const match = line.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return match ? match[1].trim() : null;
}

function parseExtinfName(line) {
  const commaIndex = line.lastIndexOf(',');
  if (commaIndex === -1) return attr(line, 'tvg-name') || 'Untitled channel';
  return line.slice(commaIndex + 1).trim() || attr(line, 'tvg-name') || 'Untitled channel';
}

function parseM3u(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const categories = new Map();
  const channels = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith('#EXTINF')) continue;

    const streamUrl = lines.slice(i + 1).find((candidate) => candidate && !candidate.startsWith('#'));
    if (!streamUrl) continue;

    const groupTitle = attr(line, 'group-title') || 'Uncategorized';
    const categoryKey = groupTitle.toLowerCase();
    if (!categories.has(categoryKey)) {
      categories.set(categoryKey, {
        remote_id: categoryKey,
        name: groupTitle,
        item_count: 0,
      });
    }
    categories.get(categoryKey).item_count += 1;

    channels.push({
      remote_id: attr(line, 'tvg-id') || attr(line, 'tvg-name') || null,
      name: parseExtinfName(line),
      stream_url: streamUrl,
      logo_url: attr(line, 'tvg-logo'),
      tvg_id: attr(line, 'tvg-id'),
      group_title: groupTitle,
      category_remote_id: categoryKey,
      sort_order: channels.length,
    });
  }

  if (channels.length === 0 && !text.trimStart().startsWith('#EXTM3U')) {
    throw new Error('That URL did not return a valid M3U playlist');
  }

  return { categories: Array.from(categories.values()), channels };
}

async function fetchM3uPlaylist(playlist) {
  const res = await fetchWithTimeout(playlist.url);
  const text = await res.text();
  return parseM3u(text);
}

async function fetchXtreamPlaylist(playlist) {
  const base = playlist.server_url.replace(/\/+$/, '');
  const auth = `username=${encodeURIComponent(playlist.username)}&password=${encodeURIComponent(playlist.password)}`;
  const apiUrl = `${base}/player_api.php?${auth}`;

  const [categoriesRes, streamsRes] = await Promise.all([
    fetchWithTimeout(`${apiUrl}&action=get_live_categories`),
    fetchWithTimeout(`${apiUrl}&action=get_live_streams`),
  ]);
  const [rawCategories, rawStreams] = await Promise.all([categoriesRes.json(), streamsRes.json()]);

  const categories = Array.isArray(rawCategories)
    ? rawCategories.map((category) => ({
        remote_id: String(category.category_id ?? category.id ?? category.category_name),
        name: category.category_name || 'Uncategorized',
        item_count: 0,
      }))
    : [];
  const categoryCounts = new Map();

  const channels = Array.isArray(rawStreams)
    ? rawStreams.map((stream, index) => {
        const categoryRemoteId = stream.category_id != null ? String(stream.category_id) : null;
        if (categoryRemoteId) {
          categoryCounts.set(categoryRemoteId, (categoryCounts.get(categoryRemoteId) || 0) + 1);
        }

        const extension = stream.container_extension || 'ts';
        return {
          remote_id: stream.stream_id != null ? String(stream.stream_id) : null,
          name: stream.name || 'Untitled channel',
          stream_url: `${base}/live/${encodeURIComponent(playlist.username)}/${encodeURIComponent(
            playlist.password
          )}/${stream.stream_id}.${extension}`,
          logo_url: stream.stream_icon || null,
          tvg_id: stream.epg_channel_id || null,
          group_title: stream.category_name || null,
          category_remote_id: categoryRemoteId,
          sort_order: Number(stream.num) || index,
        };
      })
    : [];

  for (const category of categories) {
    category.item_count = categoryCounts.get(category.remote_id) || 0;
  }

  return { categories, channels };
}

function persistPlaylistItems(db, playlistId, data) {
  const insertCategory = db.prepare(
    `INSERT INTO playlist_categories (playlist_id, remote_id, name, enabled, item_count)
     VALUES (?, ?, ?, ?, ?)`
  );
  const insertChannel = db.prepare(
    `INSERT INTO playlist_channels (
      playlist_id, category_id, remote_id, name, custom_name, stream_url, logo_url, enabled, sort_order, tvg_id, group_title
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const getCategory = db.prepare(
    `SELECT id FROM playlist_categories
     WHERE playlist_id = ?
       AND ((remote_id IS NULL AND ? IS NULL) OR remote_id = ?)
     LIMIT 1`
  );

  const save = db.transaction(() => {
    const existingCategories = db.prepare('SELECT * FROM playlist_categories WHERE playlist_id = ?').all(playlistId);
    const existingChannels = db.prepare('SELECT * FROM playlist_channels WHERE playlist_id = ?').all(playlistId);
    const categoryPrefs = new Map();
    const channelPrefs = new Map();

    for (const category of existingCategories) {
      categoryPrefs.set(category.remote_id || category.name.toLowerCase(), category);
    }
    for (const channel of existingChannels) {
      channelPrefs.set(channel.remote_id || `${channel.name}|${channel.group_title || ''}`, channel);
    }

    db.prepare('DELETE FROM playlist_channels WHERE playlist_id = ?').run(playlistId);
    db.prepare('DELETE FROM playlist_categories WHERE playlist_id = ?').run(playlistId);

    for (const category of data.categories) {
      const previous = categoryPrefs.get(category.remote_id || category.name.toLowerCase());
      insertCategory.run(
        playlistId,
        category.remote_id || null,
        category.name,
        previous ? previous.enabled : 1,
        category.item_count || 0
      );
    }

    for (const channel of data.channels) {
      const category = channel.category_remote_id
        ? getCategory.get(playlistId, channel.category_remote_id, channel.category_remote_id)
        : null;
      const previous = channelPrefs.get(channel.remote_id || `${channel.name}|${channel.group_title || ''}`);
      insertChannel.run(
        playlistId,
        category?.id || null,
        channel.remote_id || null,
        channel.name,
        previous?.custom_name || null,
        channel.stream_url,
        channel.logo_url || null,
        previous ? previous.enabled : 1,
        channel.sort_order || 0,
        channel.tvg_id || null,
        channel.group_title || null
      );
    }

    db.prepare(
      `UPDATE playlists
       SET sync_status = 'synced', sync_error = NULL, last_synced_at = datetime('now')
       WHERE id = ?`
    ).run(playlistId);
  });

  save();
}

async function syncPlaylist(db, playlist) {
  db.prepare("UPDATE playlists SET sync_status = 'syncing', sync_error = NULL WHERE id = ?").run(playlist.id);

  try {
    const data = playlist.type === 'xtream' ? await fetchXtreamPlaylist(playlist) : await fetchM3uPlaylist(playlist);
    persistPlaylistItems(db, playlist.id, data);
    return {
      ok: true,
      categoryCount: data.categories.length,
      channelCount: data.channels.length,
    };
  } catch (err) {
    db.prepare("UPDATE playlists SET sync_status = 'error', sync_error = ? WHERE id = ?").run(err.message, playlist.id);
    throw err;
  }
}

module.exports = { parseM3u, syncPlaylist };
