import { useEffect, useState } from 'react'
import { api } from '../api'

function AdminSettings({ branding, onClose, onBrandingChange }) {
  const [hubName, setHubName] = useState(branding.hubName || 'Meridian Hub')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    setHubName(branding.hubName || 'Meridian Hub')
  }, [branding.hubName])

  async function saveName(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const settings = await api('/hub/settings', {
        method: 'PUT',
        body: JSON.stringify({ hub_name: hubName }),
      })
      onBrandingChange({ ...branding, hubName: settings.hub_name })
      setMessage('Settings saved')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function uploadLogo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const logoDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('Could not read logo file'))
        reader.readAsDataURL(file)
      })
      const result = await api('/hub/logo', {
        method: 'PUT',
        body: JSON.stringify({ logoDataUrl }),
      })
      onBrandingChange({
        ...branding,
        hasCustomLogo: true,
        logoMime: result.logoMime || file.type || 'image/png',
        logoUrl: result.logoUrl,
        logoUpdatedAt: result.logoUpdatedAt,
      })
      setMessage('Logo updated')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
      e.target.value = ''
    }
  }

  async function resetLogo() {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await api('/hub/logo', { method: 'DELETE' })
      onBrandingChange({
        ...branding,
        hasCustomLogo: false,
        logoMime: 'image/png',
        logoUrl: branding.defaultLogoUrl || '/meridian-logo.png',
        logoUpdatedAt: null,
      })
      setMessage('Logo reset')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-popover">
      <div className="settings-header">
        <strong>Admin settings</strong>
        <button type="button" className="btn-small" onClick={onClose}>
          Close
        </button>
      </div>
      <form className="settings-form" onSubmit={saveName}>
        <label>
          Hub name
          <input type="text" value={hubName} onChange={(e) => setHubName(e.target.value)} />
        </label>
        <button type="submit" className="btn-small primary" disabled={saving}>
          Save name
        </button>
      </form>
      <div className="settings-logo-row">
        <img src={branding.logoUrl || '/meridian-logo.png'} alt="" />
        <label className="btn-small">
          Upload logo
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={uploadLogo} />
        </label>
        {branding.hasCustomLogo && (
          <button type="button" className="btn-small danger" onClick={resetLogo} disabled={saving}>
            Reset
          </button>
        )}
      </div>
      {message && <p className="test-result ok">{message}</p>}
      {error && <p className="auth-error">{error}</p>}
    </div>
  )
}

export default AdminSettings
