import { useEffect, useState } from 'react'
import { api } from '../api'

function Footer() {
  const [version, setVersion] = useState('')

  useEffect(() => {
    api('/health')
      .then((data) => setVersion(data.version || ''))
      .catch(() => {})
  }, [])

  return (
    <footer className="app-footer">
      <span>Meridian Hub{version ? ` v${version}` : ''}</span>
    </footer>
  )
}

export default Footer
