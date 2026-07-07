import { useEffect, useState } from 'react'
import { api } from '../api'

function AccountSettings({ user, onClose }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const [newUsername, setNewUsername] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [addingUser, setAddingUser] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setUsers(await api('/auth/users'))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function changePassword(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }
    setChangingPassword(true)
    try {
      await api('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage('Password updated')
    } catch (err) {
      setError(err.message)
    } finally {
      setChangingPassword(false)
    }
  }

  async function addUser(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setAddingUser(true)
    try {
      await api('/auth/users', {
        method: 'POST',
        body: JSON.stringify({ username: newUsername.trim(), password: newUserPassword }),
      })
      setNewUsername('')
      setNewUserPassword('')
      setMessage('User added')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setAddingUser(false)
    }
  }

  async function removeUser(targetUser) {
    if (!confirm(`Remove admin access for "${targetUser.username}"?`)) return
    setError('')
    try {
      await api(`/auth/users/${targetUser.id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="settings-popover">
      <div className="settings-header">
        <strong>Account settings</strong>
        <button type="button" className="btn-small" onClick={onClose}>
          Close
        </button>
      </div>

      <form className="settings-form" onSubmit={changePassword}>
        <label>
          Current password
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </label>
        <label>
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
          />
        </label>
        <button type="submit" className="btn-small primary" disabled={changingPassword}>
          {changingPassword ? 'Saving...' : 'Change password'}
        </button>
      </form>

      <div className="settings-divider" />

      <strong>Admin users</strong>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul className="settings-user-list">
          {users.map((u) => (
            <li key={u.id}>
              <span>
                {u.username}
                {u.id === user.id ? ' (you)' : ''}
              </span>
              {u.id !== user.id && (
                <button type="button" className="btn-small danger" onClick={() => removeUser(u)}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className="settings-form" onSubmit={addUser}>
        <label>
          New admin username
          <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            value={newUserPassword}
            onChange={(e) => setNewUserPassword(e.target.value)}
            minLength={8}
          />
        </label>
        <button type="submit" className="btn-small primary" disabled={addingUser}>
          {addingUser ? 'Adding...' : 'Add admin user'}
        </button>
      </form>

      {message && <p className="test-result ok">{message}</p>}
      {error && <p className="auth-error">{error}</p>}
    </div>
  )
}

export default AccountSettings
