import { useEffect, useState } from 'react'
import { api } from '../api'

function ClaimDevice({ code, onDone }) {
  const [status, setStatus] = useState('loading')
  const [pairing, setPairing] = useState(null)
  const [households, setHouseholds] = useState([])
  const [householdId, setHouseholdId] = useState('')
  const [deviceName, setDeviceName] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [pairStatus, householdList] = await Promise.all([api(`/pair/status/${code}`), api('/households')])
        if (pairStatus.status === 'claimed') {
          setStatus('claimed')
          return
        }
        setPairing(pairStatus)
        setHouseholds(householdList)
        if (householdList.length > 0) setHouseholdId(String(householdList[0].id))
        setStatus('ready')
      } catch (err) {
        setStatus(err.message?.toLowerCase().includes('expired') ? 'expired' : 'error')
        setError(err.message)
      }
    }
    load()
  }, [code])

  async function handleClaim(e) {
    e.preventDefault()
    if (!householdId) return
    setClaiming(true)
    setError('')
    try {
      await api('/pair/claim', {
        method: 'POST',
        body: JSON.stringify({
          code,
          household_id: Number(householdId),
          device_name: deviceName.trim() || undefined,
        }),
      })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setClaiming(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="auth-card">
        <p>Checking pairing code...</p>
      </div>
    )
  }

  if (status === 'claimed') {
    return (
      <div className="auth-card">
        <h1>Already paired</h1>
        <p className="auth-subtitle">This pairing code has already been used.</p>
        <button type="button" className="btn-small primary" onClick={onDone}>
          Continue to dashboard
        </button>
      </div>
    )
  }

  if (status === 'expired' || status === 'error') {
    return (
      <div className="auth-card">
        <h1>Pairing code not valid</h1>
        <p className="auth-error">{error || 'This pairing code has expired or does not exist.'}</p>
        <button type="button" className="btn-small primary" onClick={onDone}>
          Continue to dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="auth-card">
      <h1>Pair device</h1>
      <p className="auth-subtitle">
        {pairing.deviceName} ({pairing.platform}) wants to connect to this Hub.
      </p>
      {households.length === 0 ? (
        <p className="auth-error">Create a household first, then rescan the code.</p>
      ) : (
        <form onSubmit={handleClaim}>
          <label>
            Household
            <select value={householdId} onChange={(e) => setHouseholdId(e.target.value)} required>
              {households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Device name (optional)
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder={pairing.deviceName}
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" disabled={claiming}>
            {claiming ? 'Pairing...' : 'Pair device'}
          </button>
        </form>
      )}
    </div>
  )
}

export default ClaimDevice
