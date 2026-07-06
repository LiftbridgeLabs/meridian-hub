import { useEffect, useState } from 'react'
import { api } from '../api'

const TIMEZONES = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC']

function Households({ onManage }) {
  const [households, setHouseholds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editTimezone, setEditTimezone] = useState('UTC')

  async function load() {
    setLoading(true)
    try {
      setHouseholds(await api('/households'))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    setError('')
    try {
      await api('/households', {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      setName('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function toggleEnabled(household) {
    try {
      await api(`/households/${household.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: !household.enabled }),
      })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(household) {
    if (!confirm(`Delete "${household.name}"? This removes all its playlists, profiles, and devices.`)) return
    try {
      await api(`/households/${household.id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  function startEdit(household) {
    setEditingId(household.id)
    setEditName(household.name)
    setEditTimezone(household.timezone)
  }

  async function saveEdit(id) {
    try {
      await api(`/households/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editName, timezone: editTimezone }),
      })
      setEditingId(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="households">
      <form className="household-form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Household name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={creating}>
          {creating ? 'Adding...' : 'Add household'}
        </button>
      </form>

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : households.length === 0 ? (
        <p className="households-empty">No households yet. Add one above to get started.</p>
      ) : (
        <table className="households-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Timezone</th>
              <th>Devices</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {households.map((h) =>
              editingId === h.id ? (
                <tr key={h.id}>
                  <td>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </td>
                  <td>
                    <select value={editTimezone} onChange={(e) => setEditTimezone(e.target.value)}>
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{h.device_count}</td>
                  <td colSpan={2}>
                    <div className="row-actions">
                      <button type="button" className="btn-small primary" onClick={() => saveEdit(h.id)}>
                        Save
                      </button>
                      <button type="button" className="btn-small" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={h.id}>
                  <td>
                    <button type="button" className="text-link" onClick={() => onManage(h)}>
                      {h.name}
                    </button>
                  </td>
                  <td>{h.timezone}</td>
                  <td>{h.device_count}</td>
                  <td>
                    <button type="button" className="btn-small" onClick={() => toggleEnabled(h)}>
                      {h.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn-small" onClick={() => startEdit(h)}>
                        Edit
                      </button>
                      <button type="button" className="btn-small danger" onClick={() => handleDelete(h)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default Households
