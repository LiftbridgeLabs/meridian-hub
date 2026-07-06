import { useState } from 'react'

function AuthForm({ mode, onSubmit }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isSetup = mode === 'setup'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onSubmit({ username, password })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-card">
      <h1>{isSetup ? 'Set up Meridian Hub' : 'Meridian Hub'}</h1>
      <p className="auth-subtitle">
        {isSetup ? 'Create your admin account to get started.' : 'Sign in to continue.'}
      </p>
      <form onSubmit={handleSubmit}>
        <label>
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSetup ? 'new-password' : 'current-password'}
            minLength={isSetup ? 8 : undefined}
            required
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Please wait...' : isSetup ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

export default AuthForm
