import Playlists from './Playlists'

function HouseholdDetail({ household, onBack }) {
  return (
    <div className="household-detail">
      <div className="household-detail-header">
        <button type="button" className="text-link" onClick={onBack}>
          ← Back to households
        </button>
        <h2>{household.name}</h2>
      </div>
      <section>
        <h3>Playlists</h3>
        <Playlists householdId={household.id} />
      </section>
    </div>
  )
}

export default HouseholdDetail
