import { useEffect, useMemo, useState } from 'react'

const NAV = [
  { id: 'my-interns', label: 'My Interns', description: 'Summary and assigned interns' },
  { id: 'evaluation', label: 'Upcoming candidate Evaluation', description: 'Review candidates before onboarding' },
  { id: 'ongoing', label: 'Ongoing Internships', description: 'Track progress and guidance' },
  { id: 'closure', label: 'Internship Extension/ Completion', description: 'Extensions, closure, and completion' },
]

const NOTICE_TIMEOUT_MS = 3000

const MENTOR_WORKFLOW_STEPS = [
  {
    key: 'documents',
    label: 'Review Documents',
    statuses: ['SUBMITTED', 'ELIGIBILITY_REVIEW', 'ELIGIBILITY_PASSED'],
  },
  {
    key: 'evaluation',
    label: 'Mentor Evaluation',
    statuses: ['ADMIN_APPROVED', 'JOINING_FORM_PENDING', 'JOINING_FORM_SUBMITTED', 'NDA_PENDING', 'NDA_SIGNED'],
  },
  {
    key: 'mentoring',
    label: 'Active Mentoring',
    statuses: ['READY_TO_START', 'IN_PROGRESS', 'EXTENDED', 'DELAYED'],
  },
  {
    key: 'closure',
    label: 'Closure & Completion',
    statuses: ['IN_CLOSURE', 'COMPLETED', 'CLOSED'],
  },
]

const MENTOR_PHASE_DETAILS = {
  documents: {
    label: 'Document Review',
    title: 'Review candidate documents',
    subtitle: 'Validate the joining form, supporting documents, and the fit of the internship request.',
    primaryPoints: ['Joining form completeness', 'Resume and profile verification', 'Project scope clarity'],
    secondaryPoints: ['Candidate profile', 'Submitted documents', 'Initial suitability check'],
    summaryLabel: 'Document status',
    summaryValue: 'Under review',
    actionLabel: 'Review Documents',
  },
  evaluation: {
    label: 'Mentor Evaluation',
    title: 'Assess candidate suitability',
    subtitle: 'Review skills, education, projects, and internship alignment before approving or rejecting.',
    primaryPoints: ['Skills and technical background', 'Educational qualifications', 'Relevant projects and experience', 'Project alignment'],
    secondaryPoints: ['Evaluation notes', 'Approve / Reject / Clarify', 'Readiness for onboarding'],
    summaryLabel: 'Evaluation status',
    summaryValue: 'Ready for mentor review',
    actionLabel: 'Evaluate Candidate',
  },
  mentoring: {
    label: 'Active Mentoring',
    title: 'Guide the internship in progress',
    subtitle: 'Confirm start, add remarks, and keep the internship on track while it is active.',
    primaryPoints: ['Confirm onboarding', 'Track progress remarks', 'Manage extension requests'],
    secondaryPoints: ['Start confirmation', 'Weekly updates', 'Issue resolution'],
    summaryLabel: 'Mentoring status',
    summaryValue: 'Active supervision',
    actionLabel: 'Manage Active Intern',
  },
  closure: {
    label: 'Closure & Completion',
    title: 'Finalize internship completion',
    subtitle: 'Review participation, project completion, and closure notes before marking complete.',
    primaryPoints: ['Completion review', 'Participation assessment', 'Closure decision'],
    secondaryPoints: ['Final remarks', 'HR closure handoff', 'Certificate readiness'],
    summaryLabel: 'Closure status',
    summaryValue: 'Awaiting completion review',
    actionLabel: 'Complete Internship',
  },
}

function MentorDashboard({ token, currentUser, setError, setMessage, onLogout }) {
  const [activeTab, setActiveTab] = useState('my-interns')
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

  useEffect(() => {
    if (!notice.text) {
      return undefined
    }

    const timeoutId = setTimeout(() => {
      setNotice({ type: '', text: '' })
    }, NOTICE_TIMEOUT_MS)

    return () => clearTimeout(timeoutId)
  }, [notice])

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

  const upcomingEvaluationItems = useMemo(() => referrals.filter((item) => ['SUBMITTED', 'ELIGIBILITY_REVIEW', 'ELIGIBILITY_PASSED', 'ADMIN_APPROVED', 'JOINING_FORM_PENDING', 'JOINING_FORM_SUBMITTED', 'NDA_PENDING', 'NDA_SIGNED'].includes(item.state || item.status)), [referrals])
  const ongoingInternships = useMemo(() => referrals.filter((item) => ['READY_TO_START', 'IN_PROGRESS', 'EXTENDED', 'DELAYED'].includes(item.state || item.status)), [referrals])
  const closureItems = useMemo(() => referrals.filter((item) => ['IN_CLOSURE', 'COMPLETED', 'CLOSED'].includes(item.state || item.status)), [referrals])

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

  const handleRequestClarification = async () => {
    if (!selectedReferralId) return
    if (!reviewNotes.trim()) {
      setNotice({ type: 'error', text: 'Please add clarification details before requesting clarification.' })
      return
    }

    setActionLoading('mentor-clarification')
    try {
      await apiRequest(`/referrals/${selectedReferralId}/mentor-remarks`, {
        method: 'POST',
        body: JSON.stringify({
          remarks: `Clarification requested: ${reviewNotes.trim()}`,
          progress_status: 'AT_RISK',
        }),
      })
      setMessage('Clarification requested by mentor')
      setNotice({ type: 'success', text: 'Clarification requested and shared with stakeholders.' })
      setReviewNotes('')
      await loadMentorReferrals()
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Failed to request clarification' })
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

  const mentorWorkflow = useMemo(() => {
    if (!selectedReferral) {
      return {
        stageIndex: 0,
        progressPercent: 0,
        currentLabel: 'Select an intern to begin review',
      }
    }

    const status = selectedReferral.status || selectedReferral.state || 'SUBMITTED'
    const matchedIndex = MENTOR_WORKFLOW_STEPS.findIndex((step) => step.statuses.includes(status))
    const stageIndex = matchedIndex >= 0 ? matchedIndex : 0
    const progressPercent = MENTOR_WORKFLOW_STEPS.length > 1
      ? Math.round((stageIndex / (MENTOR_WORKFLOW_STEPS.length - 1)) * 100)
      : 0

    return {
      stageIndex,
      progressPercent,
      currentLabel: MENTOR_WORKFLOW_STEPS[stageIndex]?.label || MENTOR_WORKFLOW_STEPS[0].label,
    }
  }, [selectedReferral])

  const selectedPhaseKey = MENTOR_WORKFLOW_STEPS[mentorWorkflow.stageIndex]?.key || 'documents'
  const phaseDetails = MENTOR_PHASE_DETAILS[selectedPhaseKey] || MENTOR_PHASE_DETAILS.documents

  const activeSection = useMemo(() => NAV.find((item) => item.id === activeTab) || NAV[0], [activeTab])

  const getCandidateDisplayName = (item) =>
    item?.additional_data?.candidate_details?.name
    || item?.additional_data?.candidate_details?.full_name
    || item?.candidate_name
    || item?.candidate?.name
    || item?.candidate?.full_name
    || item?.candidate?.email
    || 'Candidate'

  const phaseChecklist = useMemo(() => {
    if (!selectedReferral) return []

    if (selectedPhaseKey === 'documents') {
      return [
        { label: 'Joining form', value: selectedReferral.status ? 'Available' : 'Pending' },
        { label: 'Candidate profile', value: candidateDetails?.name || candidateDetails?.email || 'Pending' },
        { label: 'Resume', value: additionalData?.uploaded_resume_url ? 'Uploaded' : 'Pending' },
        { label: 'Project scope', value: selectedReferral.project_overview ? 'Defined' : 'Pending' },
      ]
    }

    if (selectedPhaseKey === 'evaluation') {
      return [
        { label: 'Skills', value: projectInfo?.technologies_skills_required || 'Pending' },
        { label: 'Education', value: candidateDetails?.education?.degree || 'Pending' },
        { label: 'Projects', value: candidateDetails?.experience_summary || projectInfo?.project_description || 'Pending' },
        { label: 'Alignment', value: projectInfo?.project_title || selectedReferral.project_overview || 'Pending' },
      ]
    }

    if (selectedPhaseKey === 'mentoring') {
      return [
        { label: 'Start confirmation', value: selectedReferral.state === 'IN_PROGRESS' ? 'Completed' : 'Pending' },
        { label: 'Remarks', value: selectedInternRemarks.length ? `${selectedInternRemarks.length} updates` : 'None yet' },
        { label: 'Extension requests', value: extensionReason ? 'In progress' : 'None' },
        { label: 'Current health', value: progressStatus === 'BLOCKED' ? 'Blocked' : progressStatus === 'AT_RISK' ? 'At risk' : 'On track' },
      ]
    }

    return [
      { label: 'Participation review', value: participationReview ? 'Captured' : 'Pending' },
      { label: 'Project completion', value: projectCompletionReview ? 'Captured' : 'Pending' },
      { label: 'Closure notes', value: completionNotes ? 'Added' : 'Optional' },
      { label: 'Certificate', value: certificateStatus?.status || 'Not requested' },
    ]
  }, [
    additionalData?.uploaded_resume_url,
    candidateDetails?.education?.degree,
    candidateDetails?.email,
    candidateDetails?.experience_summary,
    candidateDetails?.name,
    completionNotes,
    certificateStatus?.status,
    extensionReason,
    projectCompletionReview,
    projectInfo?.project_description,
    projectInfo?.project_title,
    projectInfo?.technologies_skills_required,
    progressStatus,
    participationReview,
    selectedPhaseKey,
    selectedInternRemarks.length,
    selectedReferral,
  ])

  return (
    <div className="flex min-h-screen overflow-hidden rounded-none border-none bg-white shadow-none">
      <aside className="flex w-64 flex-col bg-[#07153a] text-white">
        <div className="border-b border-white/10 p-6">
          <p className="text-3xl font-bold tracking-tight text-indigo-300">Intern Flow</p>
          <p className="mt-1 text-sm text-slate-300">MENTOR PORTAL</p>
        </div>
        <nav className="space-y-2 p-4">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full rounded-2xl px-3 py-3 text-left transition ${activeTab === item.id ? 'bg-indigo-700/30 text-indigo-200 shadow-lg shadow-black/10' : 'text-slate-200 hover:bg-white/10'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold leading-5">{item.label}</p>
                  <p className="mt-1 text-xs leading-4 text-slate-400">{item.description}</p>
                </div>
                {item.id === 'evaluation' && upcomingEvaluationItems.length > 0 && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">{upcomingEvaluationItems.length}</span>}
                {item.id === 'ongoing' && ongoingInternships.length > 0 && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">{ongoingInternships.length}</span>}
                {item.id === 'closure' && closureItems.length > 0 && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">{closureItems.length}</span>}
              </div>
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
          <h1 className="text-4xl font-bold text-slate-800">{activeSection.label}</h1>
          <p className="mt-1 text-xl text-slate-500">{activeSection.description}</p>
        </header>

        {notice.text && (
          <div className={`mx-8 mt-5 rounded-lg border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {notice.text}
          </div>
        )}

        {activeTab === 'my-interns' && (
          <div className="space-y-6 p-8">
            <div>
              <h3 className="text-3xl font-bold text-slate-800">Requires Attention</h3>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border-l-4 border-amber-500 bg-white p-5 shadow-sm">
                  <p className="text-2xl font-bold text-slate-800">Confirm Start Date</p>
                  <p className="text-sm text-slate-500">Intern reports starting today.</p>
                  <button onClick={() => setActiveTab('ongoing')} className="mt-3 w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white">Open Ongoing Internships</button>
                </div>
                <div className="rounded-2xl border-l-4 border-amber-500 bg-white p-5 shadow-sm">
                  <p className="text-2xl font-bold text-slate-800">Review Candidate Evaluation</p>
                  <p className="text-sm text-slate-500">Candidate has submitted documents.</p>
                  <button onClick={() => setActiveTab('evaluation')} className="mt-3 w-full rounded-lg border border-slate-300 py-2 text-sm font-semibold text-slate-700">Open Evaluation</button>
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
                    <option key={item.id} value={item.id}>{getCandidateDisplayName(item)} · {item.state}</option>
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
                          <button onClick={() => { setSelectedReferralId(r.id); setActiveTab('evaluation') }} className="block rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">View Profile</button>
                          <button onClick={() => { setSelectedReferralId(r.id); setActiveTab('ongoing') }} className="block rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Track Progress</button>
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

        {activeTab !== 'my-interns' && (
          <div className="grid gap-6 p-8 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border bg-white p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Mentor Workflow</p>
                    <h3 className="mt-1 text-3xl font-bold text-slate-800">{phaseDetails.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">{phaseDetails.subtitle}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{phaseDetails.label}</p>
                    <p className="text-lg font-bold text-slate-800">{mentorWorkflow.stageIndex + 1} / {MENTOR_WORKFLOW_STEPS.length}</p>
                  </div>
                </div>
                <div className="mt-5">
                  <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <span>Review Progress</span>
                    <span>{mentorWorkflow.progressPercent}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 transition-all" style={{ width: `${mentorWorkflow.progressPercent}%` }} />
                  </div>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  {MENTOR_WORKFLOW_STEPS.map((step, index) => {
                    const isActive = index === mentorWorkflow.stageIndex
                    const isCompleted = index < mentorWorkflow.stageIndex
                    return (
                      <div
                        key={step.key}
                        className={`rounded-xl border p-4 ${isCompleted ? 'border-emerald-200 bg-emerald-50' : isActive ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}
                      >
                        <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isCompleted ? 'text-emerald-700' : isActive ? 'text-indigo-700' : 'text-slate-500'}`}>
                          Step {index + 1}
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-800">{step.label}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-6">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{phaseDetails.label}</p>
                    <h3 className="mt-1 text-4xl font-bold text-slate-800">{phaseDetails.title}</h3>
                    <p className="mt-2 text-sm text-slate-600">{phaseDetails.subtitle}</p>
                  </div>
                  <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700">{phaseDetails.actionLabel}</button>
                </div>

                <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">What to review now</p>
                    <ul className="mt-3 list-disc pl-5 text-sm text-slate-700">
                      {phaseDetails.primaryPoints.map((point) => <li key={point}>{point}</li>)}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Checklist</p>
                    <div className="mt-3 space-y-3">
                      {phaseChecklist.map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                          <span className="text-sm font-medium text-slate-700">{item.label}</span>
                          <span className="text-sm font-semibold text-slate-900">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-3xl font-bold text-slate-800">{phaseDetails.summaryLabel}</h4>
                    <p className="text-sm text-slate-500">{phaseDetails.summaryValue}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Stage</p>
                    <p className="text-lg font-bold text-slate-800">{mentorWorkflow.stageIndex + 1}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="font-semibold text-emerald-800">Current phase</p>
                    <p className="text-sm text-emerald-700">{phaseDetails.label}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-slate-700">Next action</p>
                    <p className="text-sm text-slate-500">{phaseDetails.actionLabel}</p>
                  </div>
                </div>
              </div>

              {activeTab === 'ongoing' && (
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
              )}

            </div>

            <div className="space-y-6">
              {activeTab === 'closure' && (
              <div className="rounded-2xl border bg-white p-6">
                <p className="text-2xl font-bold text-slate-800">Intern Summary</p>
                <p className="mt-2 text-sm text-slate-500">{selectedReferral?.id || 'Select an intern from My Interns'}</p>
                <p className="mt-1 text-sm text-slate-500">Certificate: {certificateStatus?.status || 'Not requested'}</p>
                <p className="mt-1 text-sm text-slate-500">Current Status: {selectedReferral?.status || 'N/A'}</p>
                <p className="mt-1 text-sm text-slate-500">Phase: {phaseDetails.label}</p>
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
              )}

              {activeTab === 'evaluation' && (
              <div className="rounded-2xl border bg-white p-6">
                <p className="text-2xl font-bold text-slate-800">{phaseDetails.actionLabel}</p>
                <p className="mt-2 text-sm text-slate-600">Evaluate skills, educational background, projects/experience, and alignment with internship requirements.</p>
                {!selectedReferral ? (
                  <p className="mt-2 text-sm text-slate-600">Select a referral to review candidate suitability.</p>
                ) : (
                  <div className="mt-3 space-y-3 text-sm text-slate-700">
                    <p><span className="font-semibold text-slate-900">Candidate:</span> {candidateDetails?.name || candidateDetails?.full_name || candidateDetails?.email || getCandidateDisplayName(selectedReferral)}</p>
                    <p><span className="font-semibold text-slate-900">Resume:</span> {additionalData?.uploaded_resume_url ? <a href={additionalData.uploaded_resume_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Open Resume</a> : 'Not uploaded'}</p>
                    <p><span className="font-semibold text-slate-900">Skills:</span> {projectInfo?.technologies_skills_required || 'Not provided'}</p>
                    <p><span className="font-semibold text-slate-900">Educational Qualifications:</span> {candidateDetails?.education?.degree || candidateDetails?.education?.college || 'Not provided'}</p>
                    <p><span className="font-semibold text-slate-900">Relevant Projects/Experience:</span> {projectInfo?.project_description || candidateDetails?.experience_summary || 'Not provided'}</p>
                    <p><span className="font-semibold text-slate-900">Project Alignment:</span> {projectInfo?.project_title || selectedReferral.project_overview || 'Not provided'}</p>
                    <p><span className="font-semibold text-slate-900">Internship Duration:</span> {internshipDetails?.duration || `${selectedReferral.start_date || 'TBD'} - ${selectedReferral.end_date || 'TBD'}`}</p>

                    <textarea
                      value={reviewNotes}
                      onChange={(event) => setReviewNotes(event.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Add mentor evaluation notes"
                    />

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
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
                      <button
                        onClick={handleRequestClarification}
                        disabled={!selectedReferralId || actionLoading === 'mentor-clarification'}
                        className="rounded-lg bg-amber-500 py-2 text-sm font-semibold text-slate-900 disabled:bg-slate-300"
                      >
                        {actionLoading === 'mentor-clarification' ? 'Requesting...' : 'Request Clarification'}
                      </button>
                    </div>
                    {!isMentorReviewEligible && (
                      <p className="text-xs text-slate-500">Mentor review is enabled when referral status is ADMIN_APPROVED.</p>
                    )}
                  </div>
                )}
              </div>
              )}

              {activeTab === 'ongoing' && (
              <div className="rounded-2xl border bg-white p-6">
                <p className="text-2xl font-bold text-slate-800">Required Action</p>
                <p className="mt-2 text-sm text-slate-600">Confirm intern start to trigger IT access provisioning.</p>
                <button onClick={handleConfirmInternStarted} disabled={actionLoading === 'confirm-start' || !selectedReferralId} className="mt-3 w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white">Confirm Intern Started</button>
              </div>
              )}

              {activeTab === 'closure' && (
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
              )}

              {activeTab === 'evaluation' && (
              <div className="rounded-2xl border bg-white p-6">
                <p className="text-2xl font-bold text-slate-800">Dossier & Documents</p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>Joining Form: Submitted</p>
                  <p>NDA: {timeline.some((event) => event.event_type?.includes('NDA_SIGNED')) ? 'Signed' : 'Pending'}</p>
                </div>
              </div>
              )}
            </div>
          </div>
        )}

        {loading && <div className="px-8 pb-8 text-sm text-slate-500">Loading mentor data...</div>}
      </main>
    </div>
  )
}

export default MentorDashboard
