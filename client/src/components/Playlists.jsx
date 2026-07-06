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

  function TestResult({ resultKey }) {
    const result = testResults[resultKey]
    if (!result) return null
    if (result.loading) return <p className="test-result">Testing...</p>
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {playlists.map((p) =>
              editingId === p.id ? (
                <tr key={p.id}>
                  <td colSpan={4}>
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
                    <td>
                      <div className="row-actions">
                        <button type="button" className="btn-small" onClick={() => runTest(p.id, p)}>
                          Test
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
                      <td colSpan={4}>
                        <TestResult resultKey={p.id} />
                      </td>
                    </tr>
                  )}
                </>
              )
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default Playlists
