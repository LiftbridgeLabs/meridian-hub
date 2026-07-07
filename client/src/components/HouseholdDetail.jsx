import Devices from './Devices'
import ManagementCodes from './ManagementCodes'
import Playlists from './Playlists'
import Profiles from './Profiles'

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
        <h3>Devices</h3>
        <Devices householdId={household.id} />
      </section>
      <section>
        <h3>Management codes</h3>
        <ManagementCodes householdId={household.id} />
      </section>
      <section>
        <h3>Profiles</h3>
        <Profiles householdId={household.id} />
      </section>
      <section>
        <h3>Playlists</h3>
        <Playlists householdId={household.id} />
      </section>
    </div>
  )
}

export default HouseholdDetail
