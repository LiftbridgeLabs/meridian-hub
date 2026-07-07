import { useEffect, useState } from 'react'
import { api, getToken, setToken, clearToken } from './api'
import AuthForm from './components/AuthForm'
import ClaimDevice from './components/ClaimDevice'
import Dashboard from './components/Dashboard'
import Footer from './components/Footer'
import './App.css'

function getPairCodeFromLocation() {
  const pathMatch = window.location.pathname.match(/^\/pair\/(\d{6})$/)
  if (pathMatch) return pathMatch[1]
  const queryCode = new URLSearchParams(window.location.search).get('code')
  return queryCode && /^\d{6}$/.test(queryCode) ? queryCode : null
}

function App() {
  const [status, setStatus] = useState('loading')
  const [setupComplete, setSetupComplete] = useState(true)
  const [user, setUser] = useState(null)
  const [pairCode, setPairCode] = useState(getPairCodeFromLocation)

  useEffect(() => {
    async function bootstrap() {
      const token = getToken()
      if (token) {
        try {
          const me = await api('/auth/me')
          setUser(me)
          setStatus('authenticated')
          return
        } catch {
          clearToken()
        }
      }

      const { setupComplete } = await api('/auth/setup-status')
      setSetupComplete(setupComplete)
      setStatus(setupComplete ? 'login' : 'setup')
    }

    bootstrap().catch(() => setStatus('error'))
  }, [])

  async function handleSetup({ username, password }) {
    const { token } = await api('/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    setToken(token)
    const me = await api('/auth/me')
    setUser(me)
    setStatus('authenticated')
  }

  async function handleLogin({ username, password }) {
    const { token } = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    setToken(token)
    const me = await api('/auth/me')
    setUser(me)
    setStatus('authenticated')
  }

  function handleLogout() {
    clearToken()
    setUser(null)
    setStatus(setupComplete ? 'login' : 'setup')
  }

  function clearPairCode() {
    window.history.replaceState({}, '', '/')
    setPairCode(null)
  }

  if (status === 'loading') return null

  let content
  if (status === 'error') {
    content = (
      <div className="app-shell">
        <h1>Meridian Hub</h1>
        <p>Could not reach the backend. Check the container logs.</p>
      </div>
    )
  } else if (status === 'setup') {
    content = <AuthForm mode="setup" onSubmit={handleSetup} />
  } else if (status === 'login') {
    content = <AuthForm mode="login" onSubmit={handleLogin} />
  } else if (pairCode) {
    content = <ClaimDevice code={pairCode} onDone={clearPairCode} />
  } else {
    content = <Dashboard user={user} onLogout={handleLogout} />
  }

  return (
    <div className="app-root">
      <div className="app-content">{content}</div>
      <Footer />
    </div>
  )
}

export default App
