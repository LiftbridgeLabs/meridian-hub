import { useState } from 'react'
import AccountSettings from './AccountSettings'
import DashboardHome from './DashboardHome'
import Households from './Households'
import HouseholdDetail from './HouseholdDetail'

function Dashboard({ user, onLogout }) {
  const [selectedHousehold, setSelectedHousehold] = useState(null)
  const [view, setView] = useState('home')
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <span className="dashboard-brand">
          <img src="/meridian-logo.png" alt="" />
          <span>Meridian Hub</span>
        </span>
        <div className="dashboard-user">
          <button type="button" className="dashboard-user-menu" onClick={() => setSettingsOpen((open) => !open)}>
            {user.username}
          </button>
          <button type="button" onClick={onLogout}>
            Log out
          </button>
          {settingsOpen && <AccountSettings user={user} onClose={() => setSettingsOpen(false)} />}
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
