import Card from '../ui/Card'
import CheckboxField from '../ui/CheckboxField'
import EmptyState from '../ui/EmptyState'
import Field from '../ui/Field'
import Info from '../ui/Info'
import SelectField from '../ui/SelectField'
import TextArea from '../ui/TextArea'

function WorkflowSection(props) {
  const {
    token,
    loading,
    selectedReferralId,
    referralForm,
    eligibilityForm,
    transitionForm,
    nextStates,
    joiningForm,
    joiningFormData,
    joiningFormLoading,
    ndaSendForm,
    ndaDetails,
    ndaLoading,
    currentUserRole,
    canIssueNda,
    canSignNda,
    canRejectNda,
    canExpireNda,
    handleReferralChange,
    handleCreateReferral,
    handleEligibilityChange,
    handleEligibilitySubmit,
    handleTransitionChange,
    handleStateTransition,
    handleJoiningFormPersonalChange,
    handleJoiningFormAddressChange,
    handleJoiningFormEmergencyChange,
    setJoiningForm,
    handleJoiningFormSaveDraft,
    handleJoiningFormSubmit,
    handleNdaSendChange,
    handleSendNda,
    handleSignNda,
    handleRejectNda,
    handleExpireNda,
  } = props

  const canSeeReferralWorkspace = currentUserRole === 'referrer'

  return (
    <section className="space-y-6">
      <Card title="Referral workspace" eyebrow="Phase 2">
        {canSeeReferralWorkspace ? (
          <form className="space-y-4" onSubmit={handleCreateReferral}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Candidate Email" name="candidate_email" type="email" value={referralForm.candidate_email} onChange={handleReferralChange} placeholder="candidate@example.com" />
              <Field label="Mentor Email" name="mentor_email" type="email" value={referralForm.mentor_email} onChange={handleReferralChange} placeholder="mentor@example.com" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Start date" name="start_date" type="date" value={referralForm.start_date} onChange={handleReferralChange} />
              <Field label="End date" name="end_date" type="date" value={referralForm.end_date} onChange={handleReferralChange} />
            </div>
            <Field label="Location" name="location" value={referralForm.location} onChange={handleReferralChange} />
            <Field label="Relationship to mentor" name="relationship_to_mentor" value={referralForm.relationship_to_mentor} onChange={handleReferralChange} placeholder="Team member, peer, friend..." />
            <button className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60" disabled={loading || !token}>
              {loading ? 'Submitting...' : 'Create referral'}
            </button>
          </form>
        ) : (
          <EmptyState
            title="Referrer-only section"
            description="Only users with the referrer role can create new referrals."
          />
        )}
      </Card>

      <Card title="Eligibility gate" eyebrow="Workflow">
        <form className="space-y-4" onSubmit={handleEligibilitySubmit}>
          <div className="grid gap-3 md:grid-cols-3">
            <CheckboxField label="Unpaid consent" name="unpaid_consent_confirmed" checked={eligibilityForm.unpaid_consent_confirmed} onChange={handleEligibilityChange} />
            <CheckboxField label="In-person ready" name="in_person_ready_confirmed" checked={eligibilityForm.in_person_ready_confirmed} onChange={handleEligibilityChange} />
            <CheckboxField label="Location matches" name="location_match_confirmed" checked={eligibilityForm.location_match_confirmed} onChange={handleEligibilityChange} />
          </div>
          <TextArea label="Eligibility notes" name="notes" value={eligibilityForm.notes} onChange={handleEligibilityChange} />
          <button className="w-full rounded-2xl border border-emerald-300 bg-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60" disabled={loading || !selectedReferralId}>
            {loading ? 'Checking...' : 'Run eligibility check'}
          </button>
        </form>
      </Card>

      <Card title="State control" eyebrow="Transition">
        <form className="space-y-4" onSubmit={handleStateTransition}>
          <SelectField label="Next state" name="next_state" value={transitionForm.next_state} onChange={handleTransitionChange} options={nextStates.map((value) => ({ value, label: value }))} />
          <TextArea label="Transition notes" name="notes" value={transitionForm.notes} onChange={handleTransitionChange} />
          <button className="w-full rounded-2xl border border-indigo-300 bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-60" disabled={loading || !selectedReferralId}>
            {loading ? 'Updating...' : 'Move referral state'}
          </button>
        </form>
      </Card>

      <Card title="Joining form" eyebrow="Phase 3 - Onboarding">
        {!selectedReferralId ? (
          <EmptyState title="Select a referral" description="Load or create a referral above to access the joining form." />
        ) : (
          <div className="space-y-4">
            {joiningFormData && joiningFormData.status && (
              <div className="rounded-2xl bg-slate-100 p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-slate-600">Form Status</div>
                <div className="mt-1 font-semibold text-slate-900">{joiningFormData.status}</div>
              </div>
            )}

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-semibold text-slate-900">Step 1: Personal Details</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Full name" name="name" value={joiningForm.personal_details.name} onChange={handleJoiningFormPersonalChange} />
                <Field label="Email" name="email" type="email" value={joiningForm.personal_details.email} onChange={handleJoiningFormPersonalChange} />
                <Field label="Date of birth" name="date_of_birth" type="date" value={joiningForm.personal_details.date_of_birth} onChange={handleJoiningFormPersonalChange} />
                <Field label="Phone" name="phone" value={joiningForm.personal_details.phone} onChange={handleJoiningFormPersonalChange} />
                <Field label="Gender" name="gender" value={joiningForm.personal_details.gender} onChange={handleJoiningFormPersonalChange} placeholder="Optional" />
                <Field label="Nationality" name="nationality" value={joiningForm.personal_details.nationality} onChange={handleJoiningFormPersonalChange} placeholder="Optional" />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-semibold text-slate-900">Step 2: Address</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Street" name="street" value={joiningForm.address.street} onChange={handleJoiningFormAddressChange} />
                <Field label="City" name="city" value={joiningForm.address.city} onChange={handleJoiningFormAddressChange} />
                <Field label="State / Province" name="state" value={joiningForm.address.state} onChange={handleJoiningFormAddressChange} />
                <Field label="ZIP / Postal code" name="zip_code" value={joiningForm.address.zip_code} onChange={handleJoiningFormAddressChange} />
                <Field label="Country" name="country" value={joiningForm.address.country} onChange={handleJoiningFormAddressChange} />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-semibold text-slate-900">Step 3: Emergency Contact</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Contact name" name="name" value={joiningForm.emergency_contact.name} onChange={handleJoiningFormEmergencyChange} />
                <Field label="Phone" name="phone" value={joiningForm.emergency_contact.phone} onChange={handleJoiningFormEmergencyChange} />
                <Field label="Relationship" name="relationship" value={joiningForm.emergency_contact.relationship} onChange={handleJoiningFormEmergencyChange} />
              </div>
            </div>

            <div className="space-y-3">
              <CheckboxField
                label="I declare the information provided is accurate and complete"
                name="declarations_signed"
                checked={joiningForm.declarations_signed}
                onChange={(event) => {
                  setJoiningForm((current) => ({
                    ...current,
                    declarations_signed: event.target.checked,
                  }))
                }}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={handleJoiningFormSaveDraft}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-60"
                disabled={joiningFormLoading}
              >
                {joiningFormLoading ? 'Saving...' : 'Save as draft'}
              </button>
              <button
                type="button"
                onClick={handleJoiningFormSubmit}
                className="rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:opacity-60"
                disabled={joiningFormLoading || !joiningForm.declarations_signed}
              >
                {joiningFormLoading ? 'Submitting...' : 'Submit for HR review'}
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card title="NDA workflow" eyebrow="Option B">
        {!selectedReferralId ? (
          <EmptyState title="Select a referral" description="Load a referral before issuing or signing NDA." />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="E-sign provider" name="esign_provider" value={ndaSendForm.esign_provider} onChange={handleNdaSendChange} disabled={!canIssueNda} />
              <Field label="Template version" name="template_version" value={ndaSendForm.template_version} onChange={handleNdaSendChange} disabled={!canIssueNda} />
              <Field label="Expires in hours" name="expires_in_hours" type="number" value={ndaSendForm.expires_in_hours} onChange={handleNdaSendChange} disabled={!canIssueNda} />
            </div>

            {ndaDetails ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Info label="NDA Status" value={ndaDetails.status} />
                <Info label="Provider" value={ndaDetails.esign_provider || 'N/A'} />
                <Info label="E-sign URL" value={ndaDetails.esign_url || 'Not issued'} mono />
                <Info label="Expires At" value={ndaDetails.expires_at ? new Date(ndaDetails.expires_at).toLocaleString() : 'N/A'} />
              </div>
            ) : (
              <EmptyState title="No NDA loaded" description="Issue NDA to create NDA record for this referral." />
            )}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <button type="button" onClick={handleSendNda} disabled={ndaLoading || !canIssueNda} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60">
                {ndaLoading ? 'Working...' : 'Issue NDA'}
              </button>
              <button type="button" onClick={handleSignNda} disabled={ndaLoading || !canSignNda} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60">
                {ndaLoading ? 'Working...' : 'Sign NDA'}
              </button>
              <button type="button" onClick={handleRejectNda} disabled={ndaLoading || !canRejectNda} className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-60">
                {ndaLoading ? 'Working...' : 'Reject NDA'}
              </button>
              <button type="button" onClick={handleExpireNda} disabled={ndaLoading || !canExpireNda} className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60">
                {ndaLoading ? 'Working...' : 'Expire NDA'}
              </button>
            </div>

            {!canIssueNda && !canSignNda && (
              <p className="text-xs text-slate-500">
                NDA actions are role-gated. Issue/Expire: referrer or HR/admin. Sign/Reject: candidate or HR/admin.
              </p>
            )}
          </div>
        )}
      </Card>
    </section>
  )
}

export default WorkflowSection
