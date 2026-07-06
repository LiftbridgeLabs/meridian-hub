function Dashboard({ user, onLogout }) {
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
        <p>Signed in. Household and device management is coming soon.</p>
      </main>
    </div>
  )
}

export default Dashboard
