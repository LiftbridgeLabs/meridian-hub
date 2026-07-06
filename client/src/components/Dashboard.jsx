import { useState } from 'react'
import Households from './Households'
import HouseholdDetail from './HouseholdDetail'

function Dashboard({ user, onLogout }) {
  const [selectedHousehold, setSelectedHousehold] = useState(null)

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <span className="dashboard-brand">Meridian Hub</span>
        <div className="dashboard-user">
          <span>{user.username}</span>
          <button type="button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className="dashboard-main">
        {selectedHousehold ? (
          <HouseholdDetail household={selectedHousehold} onBack={() => setSelectedHousehold(null)} />
        ) : (
          <Households onManage={setSelectedHousehold} />
        )}
      </main>
    </div>
  )
}

export default Dashboard
