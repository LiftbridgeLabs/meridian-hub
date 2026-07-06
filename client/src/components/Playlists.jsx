import { useEffect, useState } from 'react'
import { api } from '../api'

const emptyForm = { name: '', type: 'xtream', server_url: '', username: '', password: '', url: '' }

function formatTestResult(result) {
  if (result.channelCount !== undefined) {
    return `✓ Connected — ${result.channelCount} channel${result.channelCount === 1 ? '' : 's'} found`
  }
  const parts = [`${result.liveChannels} live`, `${result.vodEntries} VOD`, `${result.seriesEntries} series`]
  const expiry = result.expiresAt ? ` — expires ${new Date(result.expiresAt).toLocaleDateString()}` : ''
  const connections =
    result.maxConnections != null ? ` (${result.activeConnections ?? 0}/${result.maxConnections} connections)` : ''
  return `✓ ${result.status || 'Active'}${expiry} — ${parts.join(', ')}${connections}`
}

function Playlists({ householdId }) {
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [testResults, setTestResults] = useState({})
  const [syncResults, setSyncResults] = useState({})
  const [selectedPlaylist, setSelectedPlaylist] = useState(null)
  const [categories, setCategories] = useState([])
  const [channels, setChannels] = useState([])
  const [channelLoading, setChannelLoading] = useState(false)
  const [channelSearch, setChannelSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')

  async function load() {
    setLoading(true)
    try {
      setPlaylists(await api(`/households/${householdId}/playlists`))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [householdId])

  async function runTest(key, data) {
    setTestResults((prev) => ({ ...prev, [key]: { loading: true } }))
    try {
      const result = await api(`/households/${householdId}/playlists/test`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      setTestResults((prev) => ({ ...prev, [key]: { loading: false, ok: true, message: formatTestResult(result) } }))
    } catch (err) {
      setTestResults((prev) => ({ ...prev, [key]: { loading: false, ok: false, message: err.message } }))
    }
  }

  async function syncPlaylist(playlist) {
    setSyncResults((prev) => ({ ...prev, [playlist.id]: { loading: true } }))
    setError('')
    try {
      const result = await api(`/households/${householdId}/playlists/${playlist.id}/sync`, { method: 'POST' })
      setSyncResults((prev) => ({
        ...prev,
        [playlist.id]: {
          loading: false,
          ok: true,
          message: `Synced ${result.channelCount} channel${result.channelCount === 1 ? '' : 's'}`,
        },
      }))
      await load()
      if (selectedPlaylist?.id === playlist.id) {
        await loadChannels(playlist.id)
      }
    } catch (err) {
      setSyncResults((prev) => ({ ...prev, [playlist.id]: { loading: false, ok: false, message: err.message } }))
    }
  }

  async function loadChannels(playlistId, options = {}) {
    setChannelLoading(true)
    try {
      const nextCategoryId = options.categoryId ?? categoryId
      const nextSearch = options.search ?? channelSearch
      const params = new URLSearchParams({ limit: '100' })
      if (nextCategoryId) params.set('category_id', nextCategoryId)
      if (nextSearch.trim()) params.set('search', nextSearch.trim())
      const [categoryData, channelData] = await Promise.all([
        api(`/households/${householdId}/playlists/${playlistId}/categories`),
        api(`/households/${householdId}/playlists/${playlistId}/channels?${params.toString()}`),
      ])
      setCategories(categoryData)
      setChannels(channelData)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setChannelLoading(false)
    }
  }

  async function selectPlaylist(playlist) {
    setSelectedPlaylist(playlist)
    setCategoryId('')
    setChannelSearch('')
    await loadChannels(playlist.id, { categoryId: '', search: '' })
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      await api(`/households/${householdId}/playlists`, {
        method: 'POST',
        body: JSON.stringify(form),
      })
      setForm(emptyForm)
      setTestResults((prev) => ({ ...prev, create: undefined }))
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(playlist) {
    if (!confirm(`Delete playlist "${playlist.name}"?`)) return
    try {
      await api(`/households/${householdId}/playlists/${playlist.id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  function startEdit(playlist) {
    setEditingId(playlist.id)
    setEditForm({
      name: playlist.name,
      type: playlist.type,
      server_url: playlist.server_url || '',
      username: playlist.username || '',
      password: playlist.password || '',
      url: playlist.url || '',
    })
  }

  async function saveEdit(id) {
    setError('')
    try {
      await api(`/households/${householdId}/playlists/${id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      })
      setEditingId(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  function sourceSummary(p) {
    return p.type === 'xtream' ? `${p.server_url} (${p.username})` : p.url
  }

  function syncSummary(p) {
    if (p.sync_status === 'synced') {
      const when = p.last_synced_at ? ` | ${new Date(`${p.last_synced_at}Z`).toLocaleString()}` : ''
      return `${p.channel_count || 0} channels | ${p.category_count || 0} categories${when}`
    }
    if (p.sync_status === 'syncing') return 'Sync in progress'
    if (p.sync_status === 'error') return p.sync_error || 'Last sync failed'
    return 'Not synced yet'
  }

  function TestResult({ resultKey }) {
    const result = testResults[resultKey]
    if (!result) return null
    if (result.loading) return <p className="test-result">Testing...</p>
    return <p className={`test-result ${result.ok ? 'ok' : 'fail'}`}>{result.ok ? result.message : `✗ ${result.message}`}</p>
  }

  function SyncResult({ playlistId }) {
    const result = syncResults[playlistId]
    if (!result) return null
    if (result.loading) return <p className="test-result">Syncing...</p>
    return <p className={`test-result ${result.ok ? 'ok' : 'fail'}`}>{result.ok ? result.message : `✗ ${result.message}`}</p>
  }

  return (
    <div className="playlists">
      <form className="playlist-form" onSubmit={handleCreate}>
        <div className="playlist-form-row">
          <input
            type="text"
            placeholder="Playlist name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="xtream">Xtream</option>
            <option value="m3u">M3U</option>
          </select>
        </div>
        {form.type === 'xtream' ? (
          <div className="playlist-form-row">
            <input
              type="text"
              placeholder="Server URL"
              value={form.server_url}
              onChange={(e) => setForm({ ...form, server_url: e.target.value })}
            />
            <input
              type="text"
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
        ) : (
          <div className="playlist-form-row">
            <input
              type="text"
              placeholder="M3U URL"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
          </div>
        )}
        <div className="row-actions">
          <button type="submit" className="btn-small primary" disabled={creating}>
            {creating ? 'Adding...' : 'Add playlist'}
          </button>
          <button type="button" className="btn-small" onClick={() => runTest('create', form)}>
            Test connection
          </button>
        </div>
        <TestResult resultKey="create" />
      </form>

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : playlists.length === 0 ? (
        <p className="households-empty">No playlists yet. Add one above.</p>
      ) : (
        <table className="households-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Source</th>
              <th>Imported</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {playlists.map((p) =>
              editingId === p.id ? (
                <tr key={p.id}>
                  <td colSpan={5}>
                    <div className="playlist-form-row">
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      />
                      <select
                        value={editForm.type}
                        onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                      >
                        <option value="xtream">Xtream</option>
                        <option value="m3u">M3U</option>
                      </select>
                    </div>
                    {editForm.type === 'xtream' ? (
                      <div className="playlist-form-row">
                        <input
                          type="text"
                          placeholder="Server URL"
                          value={editForm.server_url}
                          onChange={(e) => setEditForm({ ...editForm, server_url: e.target.value })}
                        />
                        <input
                          type="text"
                          placeholder="Username"
                          value={editForm.username}
                          onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                        />
                        <input
                          type="password"
                          placeholder="Password"
                          value={editForm.password}
                          onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                        />
                      </div>
                    ) : (
                      <div className="playlist-form-row">
                        <input
                          type="text"
                          placeholder="M3U URL"
                          value={editForm.url}
                          onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                        />
                      </div>
                    )}
                    <div className="row-actions">
                      <button type="button" className="btn-small primary" onClick={() => saveEdit(p.id)}>
                        Save
                      </button>
                      <button type="button" className="btn-small" onClick={() => runTest(p.id, editForm)}>
                        Test connection
                      </button>
                      <button type="button" className="btn-small" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                    <TestResult resultKey={p.id} />
                  </td>
                </tr>
              ) : (
                <>
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.type === 'xtream' ? 'Xtream' : 'M3U'}</td>
                    <td>{sourceSummary(p)}</td>
                    <td>{syncSummary(p)}</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="btn-small" onClick={() => runTest(p.id, p)}>
                          Test
                        </button>
                        <button
                          type="button"
                          className="btn-small primary"
                          onClick={() => syncPlaylist(p)}
                          disabled={syncResults[p.id]?.loading}
                        >
                          {syncResults[p.id]?.loading ? 'Syncing...' : 'Sync'}
                        </button>
                        <button type="button" className="btn-small" onClick={() => selectPlaylist(p)}>
                          Browse
                        </button>
                        <button type="button" className="btn-small" onClick={() => startEdit(p)}>
                          Edit
                        </button>
                        <button type="button" className="btn-small danger" onClick={() => handleDelete(p)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  {testResults[p.id] && (
                    <tr key={`${p.id}-result`}>
                      <td colSpan={5}>
                        <TestResult resultKey={p.id} />
                      </td>
                    </tr>
                  )}
                  {syncResults[p.id] && (
                    <tr key={`${p.id}-sync-result`}>
                      <td colSpan={5}>
                        <SyncResult playlistId={p.id} />
                      </td>
                    </tr>
                  )}
                </>
              )
            )}
          </tbody>
        </table>
      )}

      {selectedPlaylist && (
        <section className="channel-browser">
          <div className="channel-browser-header">
            <h4>{selectedPlaylist.name} channels</h4>
            <button type="button" className="btn-small" onClick={() => setSelectedPlaylist(null)}>
              Close
            </button>
          </div>
          <div className="channel-filters">
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value)
                loadChannels(selectedPlaylist.id, { categoryId: e.target.value })
              }}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} ({category.item_count})
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Search channels"
              value={channelSearch}
              onChange={(e) => setChannelSearch(e.target.value)}
            />
            <button type="button" className="btn-small" onClick={() => loadChannels(selectedPlaylist.id)}>
              Search
            </button>
          </div>
          {channelLoading ? (
            <p>Loading...</p>
          ) : channels.length === 0 ? (
            <p className="households-empty">No imported channels found. Sync this playlist first.</p>
          ) : (
            <table className="households-table">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Category</th>
                  <th>EPG ID</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((channel) => (
                  <tr key={channel.id}>
                    <td>{channel.name}</td>
                    <td>{channel.category_name || channel.group_title || 'Uncategorized'}</td>
                    <td>{channel.tvg_id || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  )
}

export default Playlists
