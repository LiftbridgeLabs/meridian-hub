import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('unreachable'))
  }, [])

  return (
    <div className="app-shell">
      <h1>Meridian Hub</h1>
      <p>
        Backend status: <strong>{status}</strong>
      </p>
    </div>
  )
}

export default App
