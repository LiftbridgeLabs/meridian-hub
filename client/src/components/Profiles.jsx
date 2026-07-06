import { useEffect, useState } from 'react'
import { api } from '../api'

function Profiles({ householdId, onProfilesChange }) {
  const [profiles, setProfiles] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [allowedCategories, setAllowedCategories] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [profileData, playlistData] = await Promise.all([
        api(`/households/${householdId}/profiles`),
        api(`/households/${householdId}/playlists`),
      ])
      setProfiles(profileData)
      setPlaylists(playlistData)
      onProfilesChange?.(profileData)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [householdId])

  useEffect(() => {
    async function loadCategories() {
      if (!selectedPlaylistId) {
        setCategories([])
        setAllowedCategories([])
        return
      }
      try {
        setCategories(await api(`/households/${householdId}/playlists/${selectedPlaylistId}/categories`))
      } catch (err) {
        setError(err.message)
      }
    }
    loadCategories()
  }, [householdId, selectedPlaylistId])

  function resetForm() {
    setName('')
    setPin('')
    setIsDefault(false)
    setSelectedPlaylistId('')
    setAllowedCategories([])
    setEditingId(null)
  }

  function toggleCategory(categoryId) {
    setAllowedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    )
  }

  async function saveProfile(e) {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    const body = {
      name,
      pin,
      is_default: isDefault,
      assigned_playlist_id: selectedPlaylistId || null,
      allowed_categories: allowedCategories,
    }
    try {
      if (editingId) {
        await api(`/households/${householdId}/profiles/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      } else {
        await api(`/households/${householdId}/profiles`, {
          method: 'POST',
          body: JSON.stringify(body),
        })
      }
      resetForm()
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteProfile(profile) {
    if (!confirm(`Delete profile "${profile.name}"? Devices assigned to it will fall back to the default profile.`)) return
    try {
      await api(`/households/${householdId}/profiles/${profile.id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  function startEdit(profile) {
    setEditingId(profile.id)
    setName(profile.name)
    setPin(profile.pin || '')
    setIsDefault(!!profile.is_default)
    setSelectedPlaylistId(profile.assigned_playlist_id || '')
    setAllowedCategories(profile.allowed_categories || [])
  }

  return (
    <div className="profiles">
      <form className="profile-form" onSubmit={saveProfile}>
        <div className="profile-form-row">
          <input type="text" placeholder="Profile name" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={selectedPlaylistId} onChange={(e) => setSelectedPlaylistId(e.target.value)}>
            <option value="">Default playlist</option>
            {playlists.map((playlist) => (
              <option key={playlist.id} value={playlist.id}>
                {playlist.name}
              </option>
            ))}
          </select>
          <input type="text" placeholder="PIN (optional)" value={pin} onChange={(e) => setPin(e.target.value)} />
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          Default profile
        </label>
        {selectedPlaylistId && categories.length > 0 && (
          <div className="profile-category-picker">
            {categories.map((category) => (
              <label key={category.id}>
                <input
                  type="checkbox"
                  checked={allowedCategories.includes(category.id)}
                  onChange={() => toggleCategory(category.id)}
                />
                {category.display_name || category.name}
              </label>
            ))}
          </div>
        )}
        <div className="row-actions">
          <button type="submit" className="btn-small primary">
            {editingId ? 'Save profile' : 'Add profile'}
          </button>
          {editingId && (
            <button type="button" className="btn-small" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : profiles.length === 0 ? (
        <p className="households-empty">No profiles yet. Add one above.</p>
      ) : (
        <table className="households-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Playlist</th>
              <th>Groups</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id}>
                <td>{profile.name}</td>
                <td>{profile.assigned_playlist_name || 'Default'}</td>
                <td>{profile.allowed_categories?.length ? `${profile.allowed_categories.length} selected` : 'All visible'}</td>
                <td>{profile.is_default ? 'Default' : 'Manual'}</td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn-small" onClick={() => startEdit(profile)}>
                      Edit
                    </button>
                    <button type="button" className="btn-small danger" onClick={() => deleteProfile(profile)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default Profiles
