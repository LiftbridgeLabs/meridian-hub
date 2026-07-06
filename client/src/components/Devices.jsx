import { useEffect, useState } from 'react'
import { api } from '../api'

const platformLabels = {
  ios: 'iOS',
  tvos: 'tvOS',
  android: 'Android',
  androidtv: 'Android TV',
  firetv: 'Fire TV',
}

function Devices({ householdId }) {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [deviceName, setDeviceName] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [claimResult, setClaimResult] = useState('')

  async function load() {
    setLoading(true)
    try {
      setDevices(await api(`/households/${householdId}/devices`))
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

  async function claimDevice(e) {
    e.preventDefault()
    const code = pairingCode.replace(/\D/g, '')
    if (code.length !== 6) {
      setError('Enter the 6-digit pairing code shown on the TV app')
      return
    }

    setClaiming(true)
    setError('')
    setClaimResult('')
    try {
      const result = await api('/pair/claim', {
        method: 'POST',
        body: JSON.stringify({
          code,
          household_id: householdId,
          device_name: deviceName.trim() || undefined,
        }),
      })
      setPairingCode('')
      setDeviceName('')
      setClaimResult(`${result.device.name} paired successfully`)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setClaiming(false)
    }
  }

  async function deleteDevice(device) {
    if (!confirm(`Remove "${device.name}" from this household?`)) return
    try {
      await api(`/households/${householdId}/devices/${device.id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  function formatLastSeen(device) {
    if (!device.last_seen) return 'Never'
    return new Date(device.last_seen).toLocaleString()
  }

  return (
    <div className="devices">
      <form className="pairing-form" onSubmit={claimDevice}>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="6-digit code"
          value={pairingCode}
          onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        <input
          type="text"
          placeholder="Device name (optional)"
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
        />
        <button type="submit" className="btn-small primary" disabled={claiming}>
          {claiming ? 'Pairing...' : 'Pair device'}
        </button>
      </form>

      {claimResult && <p className="test-result ok">{claimResult}</p>}
      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : devices.length === 0 ? (
        <p className="households-empty">No devices paired yet.</p>
      ) : (
        <table className="households-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Platform</th>
              <th>Playlist</th>
              <th>Last seen</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id}>
                <td>{device.name}</td>
                <td>{platformLabels[device.platform] || device.platform}</td>
                <td>{device.assigned_playlist_name || 'Default'}</td>
                <td>{formatLastSeen(device)}</td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn-small danger" onClick={() => deleteDevice(device)}>
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default Devices
