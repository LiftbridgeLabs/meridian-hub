import { useEffect, useState } from 'react'
import { api } from '../api'

function DashboardHome() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        setStats(await api('/hub/stats'))
        setError('')
      } catch (err) {
        setError(err.message)
      }
    }
    load()
  }, [])

  if (error) return <p className="auth-error">{error}</p>
  if (!stats) return <p>Loading...</p>

  const statCards = [
    { label: 'Households', value: `${stats.enabledHouseholds}/${stats.max_households}` },
    { label: 'Devices', value: stats.devices },
    { label: 'Playlists', value: stats.playlists },
    { label: 'Channels', value: stats.channels },
    { label: 'Seen today', value: stats.recentlySeenDevices },
    { label: 'Pending pairings', value: stats.pendingPairings },
  ]

  return (
    <div className="dashboard-home">
      <div className="dashboard-home-header">
        <h2>{stats.hub_name}</h2>
        <p>Created {new Date(stats.created_at).toLocaleDateString()}</p>
      </div>
      <div className="stats-grid">
        {statCards.map((card) => (
          <div className="stat-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

export default DashboardHome
