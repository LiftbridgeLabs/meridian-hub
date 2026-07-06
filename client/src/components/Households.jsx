import { useEffect, useState } from 'react'
import { api } from '../api'

function Households() {
  const [households, setHouseholds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [creating, setCreating] = useState(false)

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
        body: JSON.stringify({ name, timezone }),
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

  return (
    <div className="households">
      <form className="household-form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Household name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Timezone (e.g. America/Denver)"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
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
            {households.map((h) => (
              <tr key={h.id}>
                <td>{h.name}</td>
                <td>{h.timezone}</td>
                <td>{h.device_count}</td>
                <td>
                  <button type="button" className="link-button" onClick={() => toggleEnabled(h)}>
                    {h.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </td>
                <td>
                  <button type="button" className="link-button danger" onClick={() => handleDelete(h)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default Households
