import { useEffect, useMemo, useState } from 'react'

const NAV = [
  { id: 'interns', label: 'My Interns' },
  { id: 'pending', label: 'Pending Actions' },
  { id: 'briefs', label: 'Project Briefs' },
  { id: 'notifications', label: 'Notifications' },
]

function MentorDashboard({ token, currentUser, setError, setMessage, onLogout }) {
  const [activeTab, setActiveTab] = useState('interns')
  const [referrals, setReferrals] = useState([])
  const [selectedReferralId, setSelectedReferralId] = useState('')
  const [timeline, setTimeline] = useState([])
  const [certificateStatus, setCertificateStatus] = useState(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [mentorRemark, setMentorRemark] = useState('')
  const [progressStatus, setProgressStatus] = useState('ON_TRACK')
  const [extensionEndDate, setExtensionEndDate] = useState('')
  const [extensionReason, setExtensionReason] = useState('')
  const [participationReview, setParticipationReview] = useState('')
  const [projectCompletionReview, setProjectCompletionReview] = useState('')
  const [completionNotes, setCompletionNotes] = useState('')
  const [notice, setNotice] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState('')

  const apiRequest = async (path, options = {}) => {
    const response = await fetch(`/api/v1${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    })
    const text = await response.text()
    const data = text ? JSON.parse(text) : null
    if (!response.ok) {
      throw new Error(data?.detail || 'Request failed')
    }
    return data
  }

  const loadMentorReferrals = async () => {
    setLoading(true)
    try {
      const list = await apiRequest('/referrals/me/mentor')
      const mine = list.items || []
      setReferrals(mine)
      const nextId = selectedReferralId || mine[0]?.id || ''
      setSelectedReferralId(nextId)
      if (nextId) {
        await Promise.all([loadTimeline(nextId), loadCertificate(nextId)])
      }
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Failed to load mentor referrals' })
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadTimeline = async (referralId) => {
    try {
      const data = await apiRequest(`/referrals/${referralId}/timeline`)
      setTimeline(data.events || [])
    } catch {
      setTimeline([])
    }
  }

  const loadCertificate = async (referralId) => {
    try {
      const data = await apiRequest(`/referrals/${referralId}/certificate`)
      setCertificateStatus(data)
    } catch {
      setCertificateStatus(null)
    }
  }

  useEffect(() => {
    loadMentorReferrals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentUser?.id])

  useEffect(() => {
    if (!selectedReferralId) {
      setTimeline([])
      setCertificateStatus(null)
      return
    }
    Promise.all([loadTimeline(selectedReferralId), loadCertificate(selectedReferralId)])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReferralId])

  const selectedReferral = useMemo(() => referrals.find((item) => item.id === selectedReferralId) || null, [referrals, selectedReferralId])

  const pendingItems = useMemo(() => referrals.filter((item) => ['JOINING_FORM_SUBMITTED', 'READY_TO_START', 'IN_PROGRESS'].includes(item.state)), [referrals])

  const handleConfirmInternStarted = async () => {
    if (!selectedReferralId) return
    setActionLoading('confirm-start')
    try {
      await apiRequest(`/referrals/${selectedReferralId}/state`, {
        method: 'PUT',
        body: JSON.stringify({ next_state: 'IN_PROGRESS', notes: 'Mentor confirmed internship start' }),
      })
      setMessage('Internship confirmed as started')
      setNotice({ type: 'success', text: 'Intern marked as started successfully' })
      await loadMentorReferrals()
    } catch (err) {
      setError(err.message)
      setNotice({ type: 'error', text: err.message || 'Failed to confirm start' })
    } finally {
      setActionLoading('')
    }
  }

  const handleRequestExtension = async () => {
    if (!selectedReferralId) return
    if (!extensionEndDate || !extensionReason.trim()) {
      setNotice({ type: 'error', text: 'Provide new end date and reason for extension request.' })
      return
    }
    setActionLoading('extension')
    try {
      await apiRequest(`/referrals/${selectedReferralId}/extension-request`, {
        method: 'POST',
        body: JSON.stringify({ new_end_date: extensionEndDate, reason: extensionReason }),
      })
      setNotice({ type: 'success', text: 'Extension request submitted for HR review.' })
      setExtensionEndDate('')
      setExtensionReason('')
      await loadMentorReferrals()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleInitiateClosure = async () => {
    if (!selectedReferralId) return
    setActionLoading('closure')
    try {
      await apiRequest(`/referrals/${selectedReferralId}/state`, {
        method: 'PUT',
        body: JSON.stringify({ next_state: 'IN_CLOSURE', notes: 'Mentor initiated closure' }),
      })
      setNotice({ type: 'success', text: 'Closure initiated' })
      await loadMentorReferrals()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleMarkInternshipComplete = async () => {
    if (!selectedReferralId) return
    if (!participationReview.trim() || !projectCompletionReview.trim()) {
      setNotice({ type: 'error', text: 'Please provide internship participation and project completion review.' })
      return
    }

    setActionLoading('mark-complete')
    try {
      await apiRequest(`/referrals/${selectedReferralId}/mentor-complete`, {
        method: 'POST',
        body: JSON.stringify({
          internship_participation: participationReview,
          project_completion: projectCompletionReview,
          notes: completionNotes || null,
        }),
      })
      setNotice({ type: 'success', text: 'Internship marked complete. Status moved to COMPLETED.' })
      setParticipationReview('')
      setProjectCompletionReview('')
      setCompletionNotes('')
      await loadMentorReferrals()
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Failed to mark internship complete' })
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleMentorReview = async (decision) => {
    if (!selectedReferralId) return
    setActionLoading(`mentor-${decision.toLowerCase()}`)
    try {
      await apiRequest(`/referrals/${selectedReferralId}/mentor-review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          notes: reviewNotes || null,
        }),
      })
      const actionText = decision === 'APPROVE' ? 'approved' : 'rejected'
      setMessage(`Candidate ${actionText} by mentor review`)
      setNotice({ type: 'success', text: `Candidate ${actionText}. HR notified${decision === 'APPROVE' ? ' and candidate invited to onboarding.' : '.'}` })
      setReviewNotes('')
      await loadMentorReferrals()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleAddRemark = async () => {
    if (!selectedReferralId || !mentorRemark.trim()) {
      setNotice({ type: 'error', text: 'Select an intern and enter remarks before submitting.' })
      return
    }

    setActionLoading('add-remark')
    try {
      await apiRequest(`/referrals/${selectedReferralId}/mentor-remarks`, {
        method: 'POST',
        body: JSON.stringify({ remarks: mentorRemark, progress_status: progressStatus }),
      })
      setMessage('Mentor remark added successfully')
      setNotice({ type: 'success', text: 'Remark added and progress timeline updated.' })
      setMentorRemark('')
      await loadMentorReferrals()
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Failed to add mentor remark' })
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const additionalData = selectedReferral?.additional_data || {}
  const candidateDetails = additionalData?.candidate_details || {}
  const internshipDetails = additionalData?.internship_details || {}
  const projectInfo = additionalData?.project_information || {}
  const isMentorReviewEligible = selectedReferral && ['ADMIN_APPROVED', 'ACTIVE'].includes(selectedReferral.status)
  const activeInterns = useMemo(() => referrals.filter((item) => ['IN_PROGRESS', 'EXTENDED'].includes(item.state)), [referrals])
  const selectedInternRemarks = selectedReferral?.additional_data?.mentor_remarks || []

  return (
    <div className="flex min-h-screen overflow-hidden rounded-none border-none bg-white shadow-none">
      <aside className="flex w-64 flex-col bg-[#07153a] text-white">
        <div className="border-b border-white/10 p-6">
          <p className="text-3xl font-bold tracking-tight text-indigo-300">Intern Flow</p>
          <p className="mt-1 text-sm text-slate-300">MENTOR PORTAL</p>
        </div>
        <nav className="space-y-1 p-4">
          {NAV.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full rounded-lg px-3 py-3 text-left text-lg font-semibold ${activeTab === item.id ? 'bg-indigo-700/30 text-indigo-300' : 'text-slate-200 hover:bg-white/10'}`}>
              {item.label}
              {item.id === 'pending' && pendingItems.length > 0 && <span className="ml-2 rounded-full bg-indigo-600 px-2 py-0.5 text-xs text-white">{pendingItems.length}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/10 p-4">
          <div className="text-sm text-slate-300">
            <p className="font-semibold text-white">{currentUser?.full_name || 'Mentor User'}</p>
            <p>{currentUser?.department || 'Platform Team'}</p>
          </div>
          <button
            onClick={onLogout}
            className="mt-4 w-full rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-8 py-6">
          <h1 className="text-4xl font-bold text-slate-800">My Interns</h1>
          <p className="mt-1 text-xl text-slate-500">Overview of active internships and required actions.</p>
        </header>

        {notice.text && (
          <div className={`mx-8 mt-5 rounded-lg border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {notice.text}
          </div>
        )}

        {activeTab === 'interns' && (
          <div className="space-y-6 p-8">
            <div>
              <h3 className="text-3xl font-bold text-slate-800">Requires Attention</h3>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border-l-4 border-amber-500 bg-white p-5 shadow-sm">
                  <p className="text-2xl font-bold text-slate-800">Confirm Start Date</p>
                  <p className="text-sm text-slate-500">Intern reports starting today.</p>
                  <button onClick={handleConfirmInternStarted} disabled={actionLoading === 'confirm-start' || !selectedReferralId} className="mt-3 w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white">{actionLoading === 'confirm-start' ? 'Confirming...' : 'Confirm Onboarding'}</button>
                </div>
                <div className="rounded-2xl border-l-4 border-amber-500 bg-white p-5 shadow-sm">
                  <p className="text-2xl font-bold text-slate-800">Review Joining Form</p>
                  <p className="text-sm text-slate-500">Candidate has submitted documents.</p>
                  <button onClick={() => setActiveTab('briefs')} className="mt-3 w-full rounded-lg border border-slate-300 py-2 text-sm font-semibold text-slate-700">Review Documents</button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-6">
              <h3 className="mb-4 text-3xl font-bold text-slate-800">Active Interns</h3>
              <div className="mb-4">
                <label className="text-sm font-semibold text-slate-700">Assigned Intern</label>
                <select
                  value={selectedReferralId}
                  onChange={(event) => setSelectedReferralId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select assigned intern</option>
                  {referrals.map((item) => (
                    <option key={item.id} value={item.id}>{item.id} · {item.state}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-600">Assigned interns: {referrals.length} · Active now: {activeInterns.length}</p>
              </div>
              <div className="space-y-4">
                {referrals.map((r, idx) => (
                  <div key={r.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-2xl font-bold text-slate-800">Intern #{idx + 1}</p>
                        <p className="text-sm text-slate-500">{r.project_overview || 'Project details pending'}</p>
                        <p className="text-sm text-slate-500">{r.start_date || 'Start TBD'} - {r.end_date || 'End TBD'}</p>
                      </div>
                      <div className="text-right">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{r.state}</span>
                        <div className="mt-3 space-y-2">
                          <button onClick={() => { setSelectedReferralId(r.id); setActiveTab('briefs') }} className="block rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">View Profile</button>
                          <button onClick={() => { setSelectedReferralId(r.id); setActiveTab('briefs') }} className="block rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Project Brief</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {!referrals.length && <p className="text-sm text-slate-500">No interns assigned yet.</p>}
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'briefs' || activeTab === 'pending' || activeTab === 'notifications') && (
          <div className="grid gap-6 p-8 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border bg-white p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-4xl font-bold text-slate-800">{selectedReferral?.project_overview || "Project Brief"}</h3>
                  <button className="text-sm font-semibold text-indigo-600">Edit Brief</button>
                </div>
                <p className="text-lg font-semibold text-slate-800">Objective</p>
                <p className="mt-2 text-sm text-slate-600">{selectedReferral?.project_overview || 'Design and implement assigned module with secure, scalable best practices.'}</p>

                <p className="mt-6 text-lg font-semibold text-slate-800">Key Deliverables</p>
                <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
                  <li>Architecture and implementation document</li>
                  <li>Production-ready service implementation</li>
                  <li>Integration and load test artifacts</li>
                  <li>Monitoring dashboard setup</li>
                </ul>

                <p className="mt-6 text-lg font-semibold text-slate-800">Tech Stack</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {['Go', 'Redis', 'gRPC', 'Docker'].map((tech) => (
                    <span key={tech} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{tech}</span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-6">
                <h4 className="text-3xl font-bold text-slate-800">Milestone Tracker</h4>
                <p className="text-sm text-slate-500">Track progress against the 12-week timeline.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-semibold text-emerald-800">Design & Architecture</p><p className="text-sm text-emerald-700">Completed</p></div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-semibold text-slate-700">Implementation</p><p className="text-sm text-slate-500">In Progress</p></div>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-6">
                <h4 className="text-2xl font-bold text-slate-800">Progress Remarks</h4>
                <p className="mt-1 text-sm text-slate-600">Add internship remarks and monitor progress updates.</p>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_200px]">
                  <textarea
                    value={mentorRemark}
                    onChange={(event) => setMentorRemark(event.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Add mentor remark"
                  />
                  <select
                    value={progressStatus}
                    onChange={(event) => setProgressStatus(event.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="ON_TRACK">On Track</option>
                    <option value="AT_RISK">At Risk</option>
                    <option value="BLOCKED">Blocked</option>
                  </select>
                </div>
                <button
                  onClick={handleAddRemark}
                  disabled={actionLoading === 'add-remark' || !selectedReferralId}
                  className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
                >
                  {actionLoading === 'add-remark' ? 'Saving...' : 'Add Remark'}
                </button>
                <div className="mt-4 space-y-2">
                  {!selectedInternRemarks.length ? (
                    <p className="text-sm text-slate-500">No remarks yet for selected intern.</p>
                  ) : (
                    selectedInternRemarks.slice().reverse().slice(0, 4).map((item, index) => (
                      <div key={`${item.recorded_at || ''}-${index}`} className="rounded border border-slate-200 p-2 text-sm">
                        <p className="font-semibold text-slate-700">{item.progress_status || 'Update'}</p>
                        <p className="text-slate-600">{item.remarks}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border bg-white p-6">
                <p className="text-2xl font-bold text-slate-800">Intern Summary</p>
                <p className="mt-2 text-sm text-slate-500">{selectedReferral?.id || 'Select an intern from My Interns'}</p>
                <p className="mt-1 text-sm text-slate-500">Certificate: {certificateStatus?.status || 'Not requested'}</p>
                <p className="mt-1 text-sm text-slate-500">Current Status: {selectedReferral?.status || 'N/A'}</p>
                <div className="mt-4 space-y-2">
                  <input
                    type="date"
                    value={extensionEndDate}
                    onChange={(event) => setExtensionEndDate(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="New end date"
                  />
                  <textarea
                    value={extensionReason}
                    onChange={(event) => setExtensionReason(event.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Reason for extension"
                  />
                </div>
                <div className="mt-4 space-y-2">
                  <button onClick={handleRequestExtension} disabled={actionLoading === 'extension' || !selectedReferralId} className="w-full rounded-lg border border-slate-300 py-2 text-sm font-semibold text-slate-700">{actionLoading === 'extension' ? 'Requesting...' : 'Request Extension'}</button>
                  <button onClick={handleInitiateClosure} disabled={actionLoading === 'closure' || !selectedReferralId} className="w-full rounded-lg bg-[#0b1638] py-2 text-sm font-semibold text-white">{actionLoading === 'closure' ? 'Initiating...' : 'Initiate Closure'}</button>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-6">
                <p className="text-2xl font-bold text-slate-800">Phase 3: Mentor Evaluation</p>
                {!selectedReferral ? (
                  <p className="mt-2 text-sm text-slate-600">Select a referral to review candidate suitability.</p>
                ) : (
                  <div className="mt-3 space-y-3 text-sm text-slate-700">
                    <p><span className="font-semibold text-slate-900">Candidate:</span> {candidateDetails?.name || candidateDetails?.email || selectedReferral.candidate_id}</p>
                    <p><span className="font-semibold text-slate-900">Resume:</span> {additionalData?.uploaded_resume_url ? <a href={additionalData.uploaded_resume_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Open Resume</a> : 'Not uploaded'}</p>
                    <p><span className="font-semibold text-slate-900">Skills:</span> {projectInfo?.technologies_skills_required || 'Not provided'}</p>
                    <p><span className="font-semibold text-slate-900">Project Alignment:</span> {projectInfo?.project_title || selectedReferral.project_overview || 'Not provided'}</p>
                    <p><span className="font-semibold text-slate-900">Internship Duration:</span> {internshipDetails?.duration || `${selectedReferral.start_date || 'TBD'} - ${selectedReferral.end_date || 'TBD'}`}</p>

                    <textarea
                      value={reviewNotes}
                      onChange={(event) => setReviewNotes(event.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Add mentor evaluation notes"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleMentorReview('APPROVE')}
                        disabled={!isMentorReviewEligible || actionLoading === 'mentor-approve'}
                        className="rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
                      >
                        {actionLoading === 'mentor-approve' ? 'Approving...' : 'Approve Candidate'}
                      </button>
                      <button
                        onClick={() => handleMentorReview('REJECT')}
                        disabled={!isMentorReviewEligible || actionLoading === 'mentor-reject'}
                        className="rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
                      >
                        {actionLoading === 'mentor-reject' ? 'Rejecting...' : 'Reject Candidate'}
                      </button>
                    </div>
                    {!isMentorReviewEligible && (
                      <p className="text-xs text-slate-500">Mentor review is enabled when referral status is ADMIN_APPROVED.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border bg-white p-6">
                <p className="text-2xl font-bold text-slate-800">Required Action</p>
                <p className="mt-2 text-sm text-slate-600">Confirm intern start to trigger IT access provisioning.</p>
                <button onClick={handleConfirmInternStarted} disabled={actionLoading === 'confirm-start' || !selectedReferralId} className="mt-3 w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white">Confirm Intern Started</button>
              </div>

              <div className="rounded-2xl border bg-white p-6">
                <p className="text-2xl font-bold text-slate-800">Step 11: Mark Internship Complete</p>
                <p className="mt-2 text-sm text-slate-600">Review participation and project completion before marking complete.</p>
                <div className="mt-3 space-y-2">
                  <textarea
                    value={participationReview}
                    onChange={(event) => setParticipationReview(event.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Internship participation review"
                  />
                  <textarea
                    value={projectCompletionReview}
                    onChange={(event) => setProjectCompletionReview(event.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Project completion review"
                  />
                  <textarea
                    value={completionNotes}
                    onChange={(event) => setCompletionNotes(event.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Additional notes (optional)"
                  />
                </div>
                <button
                  onClick={handleMarkInternshipComplete}
                  disabled={actionLoading === 'mark-complete' || !selectedReferralId}
                  className="mt-3 w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
                >
                  {actionLoading === 'mark-complete' ? 'Submitting...' : 'Mark Internship Complete'}
                </button>
              </div>

              <div className="rounded-2xl border bg-white p-6">
                <p className="text-2xl font-bold text-slate-800">Dossier & Documents</p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>Joining Form: Submitted</p>
                  <p>NDA: {timeline.some((event) => event.event_type?.includes('NDA_SIGNED')) ? 'Signed' : 'Pending'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && <div className="px-8 pb-8 text-sm text-slate-500">Loading mentor data...</div>}
      </main>
    </div>
  )
}

export default MentorDashboard
