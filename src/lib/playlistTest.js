async function fetchWithTimeout(url, ms = 10000) {
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

async function testXtream(serverUrl, username, password) {
  const base = serverUrl.replace(/\/+$/, '');
  const authUrl = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

  const authRes = await fetchWithTimeout(authUrl);
  const authData = await authRes.json();
  if (!authData.user_info || Number(authData.user_info.auth) !== 1) {
    throw new Error('Server reachable, but the username/password was rejected');
  }

  const [liveRes, vodRes, seriesRes] = await Promise.all([
    fetchWithTimeout(`${authUrl}&action=get_live_streams`),
    fetchWithTimeout(`${authUrl}&action=get_vod_streams`),
    fetchWithTimeout(`${authUrl}&action=get_series`),
  ]);
  const [live, vod, series] = await Promise.all([liveRes.json(), vodRes.json(), seriesRes.json()]);

  const { user_info: info } = authData;
  return {
    ok: true,
    status: info.status,
    expiresAt: info.exp_date ? new Date(Number(info.exp_date) * 1000).toISOString() : null,
    maxConnections: info.max_connections ?? null,
    activeConnections: info.active_cons ?? null,
    liveChannels: Array.isArray(live) ? live.length : 0,
    vodEntries: Array.isArray(vod) ? vod.length : 0,
    seriesEntries: Array.isArray(series) ? series.length : 0,
  };
}

async function testM3u(url) {
  const res = await fetchWithTimeout(url);
  const text = await res.text();
  const channelCount = (text.match(/^#EXTINF/gm) || []).length;
  if (channelCount === 0 && !text.trimStart().startsWith('#EXTM3U')) {
    throw new Error('That URL did not return a valid M3U playlist');
  }
  return { ok: true, channelCount };
}

async function testPlaylist({ type, server_url, username, password, url }) {
  if (type === 'xtream') return testXtream(server_url, username, password);
  return testM3u(url);
}

module.exports = { testPlaylist };
