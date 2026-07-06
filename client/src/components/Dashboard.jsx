import { useEffect, useState } from 'react'
import { api } from '../api'
import AdminSettings from './AdminSettings'
import DashboardHome from './DashboardHome'
import Households from './Households'
import HouseholdDetail from './HouseholdDetail'

function Dashboard({ user, onLogout }) {
  const [selectedHousehold, setSelectedHousehold] = useState(null)
  const [view, setView] = useState('home')
  const [branding, setBranding] = useState({
    hubName: 'Meridian Hub',
    logoUrl: '/meridian-logo.png',
    defaultLogoUrl: '/meridian-logo.png',
    hasCustomLogo: false,
    logoMime: 'image/png',
  })
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    api('/hub/branding')
      .then(setBranding)
      .catch(() => {})
  }, [])

  useEffect(() => {
    const logoUrl = branding.logoUrl || '/meridian-logo.png'
    let icon = document.querySelector("link[rel='icon']")
    if (!icon) {
      icon = document.createElement('link')
      icon.rel = 'icon'
      document.head.appendChild(icon)
    }
    icon.type = branding.logoMime || 'image/png'
    icon.href = logoUrl
    document.title = branding.hubName || 'Meridian Hub'
  }, [branding])

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <span className="dashboard-brand">
          <img src={branding.logoUrl || '/meridian-logo.png'} alt="" />
          <span>{branding.hubName || 'Meridian Hub'}</span>
        </span>
        <div className="dashboard-user">
          <button type="button" className="dashboard-user-menu" onClick={() => setSettingsOpen(!settingsOpen)}>
            {user.username}
          </button>
          <button type="button" onClick={onLogout}>
            Log out
          </button>
          {settingsOpen && (
            <AdminSettings
              branding={branding}
              onClose={() => setSettingsOpen(false)}
              onBrandingChange={setBranding}
            />
          )}
        </div>
      </header>
      <main className="dashboard-main">
        {selectedHousehold ? (
          <HouseholdDetail household={selectedHousehold} onBack={() => setSelectedHousehold(null)} />
        ) : (
          <>
            <nav className="dashboard-tabs">
              <button
                type="button"
                className={view === 'home' ? 'active' : ''}
                onClick={() => setView('home')}
              >
                Home
              </button>
              <button
                type="button"
                className={view === 'households' ? 'active' : ''}
                onClick={() => setView('households')}
              >
                Households
              </button>
            </nav>
            {view === 'home' ? <DashboardHome /> : <Households onManage={setSelectedHousehold} />}
          </>
        )}
      </main>
    </div>
  )
}

export default Dashboard
