import WorkflowSection from '../pages/WorkflowSection'

function ReferrerDashboard({
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
}) {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="text-xl font-semibold text-blue-900">Referrer Workspace</h2>
        <p className="text-blue-700 mt-1">Create and manage referrals for candidates</p>
      </div>

      <WorkflowSection
        token={token}
        loading={loading}
        selectedReferralId={selectedReferralId}
        referralForm={referralForm}
        eligibilityForm={eligibilityForm}
        transitionForm={transitionForm}
        nextStates={nextStates}
        joiningForm={joiningForm}
        joiningFormData={joiningFormData}
        joiningFormLoading={joiningFormLoading}
        ndaSendForm={ndaSendForm}
        ndaDetails={ndaDetails}
        ndaLoading={ndaLoading}
        currentUserRole={currentUserRole}
        canIssueNda={canIssueNda}
        canSignNda={canSignNda}
        canRejectNda={canRejectNda}
        canExpireNda={canExpireNda}
        handleReferralChange={handleReferralChange}
        handleCreateReferral={handleCreateReferral}
        handleEligibilityChange={handleEligibilityChange}
        handleEligibilitySubmit={handleEligibilitySubmit}
        handleTransitionChange={handleTransitionChange}
        handleStateTransition={handleStateTransition}
        handleJoiningFormPersonalChange={handleJoiningFormPersonalChange}
        handleJoiningFormAddressChange={handleJoiningFormAddressChange}
        handleJoiningFormEmergencyChange={handleJoiningFormEmergencyChange}
        setJoiningForm={setJoiningForm}
        handleJoiningFormSaveDraft={handleJoiningFormSaveDraft}
        handleJoiningFormSubmit={handleJoiningFormSubmit}
        handleNdaSendChange={handleNdaSendChange}
        handleSendNda={handleSendNda}
        handleSignNda={handleSignNda}
        handleRejectNda={handleRejectNda}
        handleExpireNda={handleExpireNda}
      />
    </div>
  )
}

export default ReferrerDashboard
