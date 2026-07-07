import { useEffect, useState } from 'react'
import { api } from '../api'

function formatDate(sqliteTimestamp) {
  return new Date(sqliteTimestamp.replace(' ', 'T') + 'Z').toLocaleString()
}

function ManagementCodes({ householdId }) {
  const [codes, setCodes] = useState([])
  const [profiles, setProfiles] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deviceName, setDeviceName] = useState('')
  const [profileId, setProfileId] = useState('')
  const [playlistId, setPlaylistId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [justGenerated, setJustGenerated] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const [codeData, profileData, playlistData] = await Promise.all([
        api(`/households/${householdId}/management-codes`),
        api(`/households/${householdId}/profiles`),
        api(`/households/${householdId}/playlists`),
      ])
      setCodes(codeData)
      setProfiles(profileData)
      setPlaylists(playlistData)
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

  async function generateCode(e) {
    e.preventDefault()
    if (!deviceName.trim()) {
      setError('Device name is required')
      return
    }
    setGenerating(true)
    setError('')
    setJustGenerated(null)
    try {
      const result = await api(`/households/${householdId}/management-codes`, {
        method: 'POST',
        body: JSON.stringify({
          device_name: deviceName.trim(),
          assigned_profile_id: profileId ? Number(profileId) : undefined,
          assigned_playlist_id: playlistId ? Number(playlistId) : undefined,
        }),
      })
      setJustGenerated(result)
      setDeviceName('')
      setProfileId('')
      setPlaylistId('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function revokeCode(codeRow) {
    if (!confirm(`Revoke the management code for "${codeRow.device_name}"?`)) return
    try {
      await api(`/households/${householdId}/management-codes/${codeRow.id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="management-codes">
      <form className="playlist-form" onSubmit={generateCode}>
        <div className="playlist-form-row">
          <input
            type="text"
            placeholder="Device name (e.g. for the customer)"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
          />
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            <option value="">Default profile</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={playlistId} onChange={(e) => setPlaylistId(e.target.value)}>
            <option value="">Default playlist</option>
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-small primary" disabled={generating}>
          {generating ? 'Generating...' : 'Generate management code'}
        </button>
      </form>

      {justGenerated && (
        <p className="test-result ok">
          Code <strong>{justGenerated.code}</strong> generated for "{justGenerated.device_name}" — give this to the
          user. Expires {formatDate(justGenerated.expires_at)}.
        </p>
      )}
      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : codes.length === 0 ? (
        <p className="households-empty">No management codes generated yet.</p>
      ) : (
        <table className="households-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Device</th>
              <th>Status</th>
              <th>Expires</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td>{c.device_name}</td>
                <td>{c.redeemed_device_id ? 'Redeemed' : 'Pending'}</td>
                <td>{formatDate(c.expires_at)}</td>
                <td>
                  {!c.redeemed_device_id && (
                    <button type="button" className="btn-small danger" onClick={() => revokeCode(c)}>
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default ManagementCodes
