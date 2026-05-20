import Card from '../ui/Card'
import EmptyState from '../ui/EmptyState'
import Field from '../ui/Field'
import Info from '../ui/Info'

function TrackingSection({
  token,
  lookupLoading,
  selectedReferralId,
  setSelectedReferralId,
  handleLookupReferral,
  selectedReferral,
  timeline,
  referrals,
  loadReferralDetails,
  loadNdaDetails,
  setError,
}) {
  return (
    <section className="space-y-6">
      <Card title="Referral lookup" eyebrow="Tracking">
        <form className="space-y-3" onSubmit={handleLookupReferral}>
          <Field label="Referral ID" name="referralId" value={selectedReferralId} onChange={(event) => setSelectedReferralId(event.target.value)} placeholder="Paste a referral UUID" />
          <button className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-60" disabled={lookupLoading || !token}>
            {lookupLoading ? 'Loading...' : 'Load referral'}
          </button>
        </form>
      </Card>

      <Card title="Selected referral" eyebrow="Live details">
        {selectedReferral ? (
          <div className="space-y-3 text-sm">
            <Info label="Referral ID" value={selectedReferral.id} mono />
            <Info label="State" value={selectedReferral.state} />
            <Info label="Status" value={selectedReferral.status} />
            <Info label="Referrer" value={selectedReferral.referrer_id} mono />
            <Info label="Candidate" value={selectedReferral.candidate_id} mono />
            <Info label="Mentor" value={selectedReferral.mentor_id} mono />
          </div>
        ) : (
          <EmptyState title="No referral selected" description="Create or load a referral to inspect its state and timeline." />
        )}
      </Card>

      <Card title="Timeline" eyebrow="Audit trail">
        {timeline.length ? (
          <div className="space-y-3">
            {timeline.map((event) => (
              <div key={event.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-4 text-xs uppercase tracking-[0.2em] text-slate-500">
                  <span>{event.event_type}</span>
                  <span>{new Date(event.timestamp).toLocaleString()}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-900">{event.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No audit entries yet" description="Timeline events will appear after referral creation, eligibility checks, and state transitions." />
        )}
      </Card>

      <Card title="Recent referrals" eyebrow="List view">
        {referrals.length ? (
          <div className="space-y-3">
            {referrals.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedReferralId(item.id)
                  loadReferralDetails(item.id).catch((err) => setError(err.message))
                  loadNdaDetails(item.id).catch(() => null)
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-slate-400 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{item.project_overview || 'Untitled referral'}</div>
                    <div className="text-xs text-slate-500">{item.location || 'No location set'}</div>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{item.state}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState title="No referrals loaded" description="Sign in to see your referral list here." />
        )}
      </Card>
    </section>
  )
}

export default TrackingSection
