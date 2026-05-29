import { useEffect, useState } from 'react'

function HRDashboard({ token, currentUser, setError, setMessage, onLogout }) {
  const [hrView, setHrView] = useState('dashboard')
  const [rosterSearch, setRosterSearch] = useState('')
  const [batchFilter, setBatchFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [activeTab, setActiveTab] = useState('forms')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [localNotice, setLocalNotice] = useState({ type: '', text: '' })
  const [pendingForms, setPendingForms] = useState([])
  const [pendingNdas, setPendingNdas] = useState([])
  const [pendingExtensions, setPendingExtensions] = useState([])
  const [pendingClosures, setPendingClosures] = useState([])
  const [queueReferrals, setQueueReferrals] = useState([])
  const [allReferrals, setAllReferrals] = useState([])
  const [activeInterns, setActiveInterns] = useState([])
  const [upcomingCompletions, setUpcomingCompletions] = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  const [selectedReferralId, setSelectedReferralId] = useState('')
  const [selectedFormStatus, setSelectedFormStatus] = useState(null)
  const [selectedFormDetails, setSelectedFormDetails] = useState(null)
  const [generatedId, setGeneratedId] = useState('NW-')
  const [mentorEmail, setMentorEmail] = useState('')
  const [mentorReassignNotes, setMentorReassignNotes] = useState('')
  const [holdReason, setHoldReason] = useState('')
  const [unholdReason, setUnholdReason] = useState('')
  const [certificatePayload, setCertificatePayload] = useState({
    request_form_url: 'https://forms.example.com/certificate-request',
    template_used: 'default-v1',
    certificate_pdf_url: 'https://storage.example.com/certificates/certificate.pdf',
    letterhead_pdf_url: 'https://storage.example.com/certificates/certificate-letterhead.pdf',
    archive_copy_url: 'https://storage.example.com/certificates/certificate-archive.pdf',
    candidate_download_url: 'https://storage.example.com/certificates/certificate.pdf',
    candidate_email_sent_to: currentUser?.email || 'candidate@example.com',
  })

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

  const refreshData = async () => {
    setLoading(true)
    setLocalNotice({ type: '', text: '' })
    setError('')
    try {
      const forms = await apiRequest('/referrals/admin/joining-forms/pending')
      setPendingForms(forms)

      const ndaQueue = await apiRequest('/referrals/admin/ndas/pending')
      setPendingNdas(ndaQueue.items || [])

      const extensionQueue = await apiRequest('/referrals/hr/extension-requests')
      setPendingExtensions(extensionQueue.items || [])

      const closureQueue = await apiRequest('/referrals?state=IN_CLOSURE&status=COMPLETED&limit=200')
      setPendingClosures(closureQueue.items || [])

      const queue = await apiRequest('/referrals/hr/queue')
      const queueItems = queue.items || []
      setQueueReferrals(queueItems)

      const allReferralsResponse = await apiRequest('/referrals?limit=500')
      setAllReferrals(allReferralsResponse.items || [])

      const allActive = await apiRequest('/referrals?status=ACTIVE&limit=200')
      const activeItems = (allActive.items || []).filter((item) => ['IN_PROGRESS', 'EXTENDED'].includes(item.state))
      setActiveInterns(activeItems)

      const now = new Date()
      const upcoming = activeItems
        .map((item) => {
          if (!item.end_date) return null
          const endDate = new Date(item.end_date)
          if (Number.isNaN(endDate.getTime())) return null
          const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))
          return { ...item, days_left: daysLeft }
        })
        .filter((item) => item && item.days_left >= 0 && item.days_left <= 14)
        .sort((a, b) => a.days_left - b.days_left)
      setUpcomingCompletions(upcoming)

      const defaultReferralId = selectedReferralId || forms[0]?.referral_id || queueItems[0]?.id || ''
      if (defaultReferralId !== selectedReferralId) {
        setSelectedReferralId(defaultReferralId)
      }
    } catch (err) {
      setError(err.message)
      setLocalNotice({ type: 'error', text: err.message || 'Failed to refresh HR data' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    const loadTimeline = async () => {
      if (!selectedReferralId) {
        setRecentEvents([])
        setSelectedFormStatus(null)
        setSelectedFormDetails(null)
        return
      }

      try {
        const [timeline, formStatus, formDetails] = await Promise.all([
          apiRequest(`/referrals/${selectedReferralId}/timeline`),
          apiRequest(`/referrals/${selectedReferralId}/joining-form/status`),
          apiRequest(`/referrals/${selectedReferralId}/joining-form`),
        ])
        setRecentEvents(timeline.events || [])
        setSelectedFormStatus(formStatus || null)
        setSelectedFormDetails(formDetails || null)
      } catch (err) {
        setError(err.message)
        setLocalNotice({ type: 'error', text: err.message || 'Failed to load timeline' })
      }
    }

    loadTimeline()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReferralId])

  const handleApprove = async (referralId) => {
    setActionLoading('approve')
    setLoading(true)
    setLocalNotice({ type: '', text: '' })
    setError('')
    try {
      await apiRequest(`/referrals/${referralId}/joining-form/approve`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'APPROVE', notes: 'HR verified joining form details and completeness' }),
      })
      setMessage(`Joining form verified for ${referralId}`)
      setLocalNotice({ type: 'success', text: `Joining form verified. Status updated to HR_VERIFIED for ${referralId}` })
      await refreshData()
    } catch (err) {
      setError(err.message)
      setLocalNotice({ type: 'error', text: err.message || 'Failed to approve joining form' })
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  const handleReject = async (referralId) => {
    setActionLoading('reject')
    setLoading(true)
    setLocalNotice({ type: '', text: '' })
    setError('')
    try {
      await apiRequest(`/referrals/${referralId}/joining-form/reject`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'REJECT', notes: 'Corrections required by HR verification' }),
      })
      setMessage(`Corrections requested for ${referralId}`)
      setLocalNotice({ type: 'success', text: `Corrections requested. Referral returned to candidate for ${referralId}` })
      await refreshData()
    } catch (err) {
      setError(err.message)
      setLocalNotice({ type: 'error', text: err.message || 'Failed to reject joining form' })
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  const handleNonWorkerAction = async (action) => {
    if (!selectedReferralId) {
      setError('Select referral ID first')
      setLocalNotice({ type: 'error', text: 'Select referral ID first' })
      return
    }
    if (action === 'complete' && !generatedId.trim()) {
      setError('Generated Non-Worker ID is required for completion')
      setLocalNotice({ type: 'error', text: 'Generated Non-Worker ID is required for completion' })
      return
    }
    setActionLoading(`nonworker-${action}`)
    setLoading(true)
    setLocalNotice({ type: '', text: '' })
    setError('')
    try {
      if (action === 'create') {
        await apiRequest(`/referrals/${selectedReferralId}/non-worker`, {
          method: 'POST',
          body: JSON.stringify({ assigned_to: null }),
        })
      }
      if (action === 'in-progress') {
        await apiRequest(`/referrals/${selectedReferralId}/non-worker/in-progress`, { method: 'POST' })
      }
      if (action === 'complete') {
        await apiRequest(`/referrals/${selectedReferralId}/non-worker/complete`, {
          method: 'POST',
          body: JSON.stringify({ generated_non_worker_id: generatedId }),
        })
      }
      setMessage(`Non-worker task ${action} completed for ${selectedReferralId}`)
      setLocalNotice({ type: 'success', text: `Non-worker task ${action} completed for ${selectedReferralId}` })
      await refreshData()
    } catch (err) {
      setError(err.message)
      setLocalNotice({ type: 'error', text: err.message || `Failed non-worker action: ${action}` })
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  const handleApproveNda = async (referralId) => {
    const targetReferralId = referralId || selectedReferralId
    if (!targetReferralId) {
      setError('Select referral ID first')
      setLocalNotice({ type: 'error', text: 'Select referral ID first' })
      return
    }

    setActionLoading('nda-approve')
    setLoading(true)
    setLocalNotice({ type: '', text: '' })
    setError('')
    try {
      await apiRequest(`/referrals/${targetReferralId}/nda/approve`, {
        method: 'POST',
        body: JSON.stringify({ notes: 'Approved after HR NDA review' }),
      })
      setMessage(`NDA approved for ${targetReferralId}`)
      setLocalNotice({ type: 'success', text: `NDA approved. Referral status updated to NDA_COMPLETED for ${targetReferralId}` })
      await refreshData()
    } catch (err) {
      setError(err.message)
      setLocalNotice({ type: 'error', text: err.message || 'Failed to approve NDA' })
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  const handleReassignMentor = async () => {
    if (!selectedReferralId) {
      setError('Select referral ID first')
      setLocalNotice({ type: 'error', text: 'Select referral ID first' })
      return
    }
    if (!mentorEmail.trim()) {
      setError('Mentor email is required')
      setLocalNotice({ type: 'error', text: 'Mentor email is required' })
      return
    }

    setActionLoading('mentor-reassign')
    setLoading(true)
    setLocalNotice({ type: '', text: '' })
    setError('')
    try {
      await apiRequest(`/referrals/${selectedReferralId}/reassign-mentor`, {
        method: 'POST',
        body: JSON.stringify({ mentor_email: mentorEmail, notes: mentorReassignNotes || null }),
      })
      setMessage(`Mentor reassigned for ${selectedReferralId}`)
      setLocalNotice({ type: 'success', text: `Mentor reassigned for ${selectedReferralId}` })
      await refreshData()
    } catch (err) {
      setError(err.message)
      setLocalNotice({ type: 'error', text: err.message || 'Failed to reassign mentor' })
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  const handleHoldReferral = async () => {
    if (!selectedReferralId) {
      setError('Select referral ID first')
      setLocalNotice({ type: 'error', text: 'Select referral ID first' })
      return
    }
    if (!holdReason.trim()) {
      setError('Hold reason is required')
      setLocalNotice({ type: 'error', text: 'Hold reason is required' })
      return
    }

    setActionLoading('referral-hold')
    setLoading(true)
    setLocalNotice({ type: '', text: '' })
    setError('')
    try {
      await apiRequest(`/referrals/${selectedReferralId}/hold`, {
        method: 'POST',
        body: JSON.stringify({ reason: holdReason }),
      })
      setMessage(`Referral placed on hold: ${selectedReferralId}`)
      setLocalNotice({ type: 'success', text: `Referral placed on hold: ${selectedReferralId}` })
      await refreshData()
    } catch (err) {
      setError(err.message)
      setLocalNotice({ type: 'error', text: err.message || 'Failed to hold referral' })
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  const handleUnholdReferral = async () => {
    if (!selectedReferralId) {
      setError('Select referral ID first')
      setLocalNotice({ type: 'error', text: 'Select referral ID first' })
      return
    }

    setActionLoading('referral-unhold')
    setLoading(true)
    setLocalNotice({ type: '', text: '' })
    setError('')
    try {
      await apiRequest(`/referrals/${selectedReferralId}/unhold`, {
        method: 'POST',
        body: JSON.stringify({ reason: unholdReason || null }),
      })
      setMessage(`Referral unheld: ${selectedReferralId}`)
      setLocalNotice({ type: 'success', text: `Referral unheld: ${selectedReferralId}` })
      await refreshData()
    } catch (err) {
      setError(err.message)
      setLocalNotice({ type: 'error', text: err.message || 'Failed to unhold referral' })
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  const handleCertificateAction = async (action) => {
    if (!selectedReferralId) {
      setError('Select referral ID first')
      setLocalNotice({ type: 'error', text: 'Select referral ID first' })
      return
    }
    if (action === 'request' && !certificatePayload.request_form_url.trim()) {
      setError('Request form URL is required')
      setLocalNotice({ type: 'error', text: 'Request form URL is required' })
      return
    }
    if (
      action === 'generate' &&
      (!certificatePayload.template_used.trim() || !certificatePayload.certificate_pdf_url.trim() || !certificatePayload.letterhead_pdf_url.trim() || !certificatePayload.archive_copy_url.trim())
    ) {
      setError('Template, certificate PDF, letterhead version, and archive copy URLs are required')
      setLocalNotice({ type: 'error', text: 'Template, certificate PDF, letterhead version, and archive copy URLs are required' })
      return
    }
    if (action === 'issue' && (!certificatePayload.candidate_download_url.trim() || !certificatePayload.candidate_email_sent_to.trim())) {
      setError('Candidate download link and candidate email are required to issue certificate')
      setLocalNotice({ type: 'error', text: 'Candidate download link and candidate email are required to issue certificate' })
      return
    }
    setActionLoading(`certificate-${action}`)
    setLoading(true)
    setLocalNotice({ type: '', text: '' })
    setError('')
    try {
      if (action === 'request') {
        await apiRequest(`/referrals/${selectedReferralId}/certificate/request`, {
          method: 'POST',
          body: JSON.stringify({ request_form_url: certificatePayload.request_form_url }),
        })
      }
      if (action === 'generate') {
        await apiRequest(`/referrals/${selectedReferralId}/certificate/generate`, {
          method: 'POST',
          body: JSON.stringify({
            template_used: certificatePayload.template_used,
            certificate_pdf_url: certificatePayload.certificate_pdf_url,
            letterhead_pdf_url: certificatePayload.letterhead_pdf_url,
            archive_copy_url: certificatePayload.archive_copy_url,
          }),
        })
      }
      if (action === 'issue') {
        await apiRequest(`/referrals/${selectedReferralId}/certificate/issue`, {
          method: 'POST',
          body: JSON.stringify({
            candidate_download_url: certificatePayload.candidate_download_url,
            candidate_email_sent_to: certificatePayload.candidate_email_sent_to,
          }),
        })
      }
      setMessage(`Certificate ${action} action completed for ${selectedReferralId}`)
      setLocalNotice({ type: 'success', text: `Certificate ${action} action completed for ${selectedReferralId}` })
      await refreshData()
    } catch (err) {
      setError(err.message)
      setLocalNotice({ type: 'error', text: err.message || `Failed certificate action: ${action}` })
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  const handleActivateInternship = async () => {
    if (!selectedReferralId) {
      setError('Select referral ID first')
      setLocalNotice({ type: 'error', text: 'Select referral ID first' })
      return
    }

    setActionLoading('activate-internship')
    setLoading(true)
    setLocalNotice({ type: '', text: '' })
    setError('')
    try {
      await apiRequest(`/referrals/${selectedReferralId}/activate`, {
        method: 'POST',
        body: JSON.stringify({ notes: 'Activated by HR after final verification' }),
      })
      setMessage(`Internship activated for ${selectedReferralId}`)
      setLocalNotice({ type: 'success', text: `Internship activated. Status updated to ACTIVE and start confirmation sent to candidate, mentor, and referrer.` })
      await refreshData()
    } catch (err) {
      setError(err.message)
      setLocalNotice({ type: 'error', text: err.message || 'Failed to activate internship' })
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  const handleExtensionReview = async (referralId, decision) => {
    const targetReferralId = referralId || selectedReferralId
    if (!targetReferralId) {
      setError('Select referral ID first')
      setLocalNotice({ type: 'error', text: 'Select referral ID first' })
      return
    }

    setActionLoading(`extension-${decision.toLowerCase()}`)
    setLoading(true)
    setLocalNotice({ type: '', text: '' })
    setError('')
    try {
      await apiRequest(`/referrals/${targetReferralId}/extension-review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          notes: decision === 'APPROVE' ? 'Extension approved by HR' : 'Extension request rejected by HR',
        }),
      })
      setLocalNotice({
        type: 'success',
        text: decision === 'APPROVE'
          ? `Extension approved for ${targetReferralId}. Status remains ACTIVE with updated end date.`
          : `Extension rejected for ${targetReferralId}.`,
      })
      await refreshData()
    } catch (err) {
      setError(err.message)
      setLocalNotice({ type: 'error', text: err.message || 'Failed to review extension request' })
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  const handleClosureReview = async (referralId, decision) => {
    const targetReferralId = referralId || selectedReferralId
    if (!targetReferralId) {
      setError('Select referral ID first')
      setLocalNotice({ type: 'error', text: 'Select referral ID first' })
      return
    }

    setActionLoading(`closure-${decision.toLowerCase()}`)
    setLoading(true)
    setLocalNotice({ type: '', text: '' })
    setError('')
    try {
      await apiRequest(`/referrals/${targetReferralId}/closure-review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          notes: decision === 'APPROVE' ? 'HR closure approved' : 'HR closure review rejected',
        }),
      })
      setLocalNotice({
        type: 'success',
        text: decision === 'APPROVE'
          ? `Closure approved for ${targetReferralId}. Status moved to CLOSURE_APPROVED.`
          : `Closure review rejected for ${targetReferralId}.`,
      })
      await refreshData()
    } catch (err) {
      setError(err.message)
      setLocalNotice({ type: 'error', text: err.message || 'Failed to review closure' })
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  const selectedReferral = queueReferrals.find((item) => item.id === selectedReferralId) || null
  const selectedPendingForm = pendingForms.find((form) => form.referral_id === selectedReferralId) || null
  const selectedStatus = selectedReferral?.status || ''
  const selectedState = selectedReferral?.state || ''
  const hasJoiningFormCompleted = selectedFormStatus?.status === 'APPROVED'
  const hasNdaCompleted = selectedStatus === 'NDA_COMPLETED'
  const hasRequiredDocuments = Boolean(selectedFormDetails?.government_ids?.length)
  const canActivateInternship = Boolean(selectedReferralId) && hasJoiningFormCompleted && hasNdaCompleted && hasRequiredDocuments
  const statusChipClass =
    selectedStatus === 'ON_HOLD'
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : selectedStatus === 'ACTIVE'
        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
        : 'bg-slate-100 text-slate-700 border-slate-200'

  const rosterRows = allReferrals.map((item) => {
    const candidateDetails = item.additional_data?.candidate_details || {}
    const mentorDetails = item.additional_data?.mentor_details || {}
    const candidateName =
      candidateDetails.name ||
      (item.candidate_email ? item.candidate_email.split('@')[0].replace(/[._-]/g, ' ') : '') ||
      `Candidate ${String(item.id || '').slice(-4)}`

    const mentorName = mentorDetails.mentor_name || mentorDetails.name || 'Unassigned'
    const department = candidateDetails.department || item.additional_data?.department || 'General'

    const month = item.start_date ? new Date(item.start_date).getMonth() + 1 : 1
    const year = item.start_date ? String(new Date(item.start_date).getFullYear()) : '2025'
    const batchSuffix = month <= 6 ? 'A' : 'B'
    const batch = `${year}-${batchSuffix}`

    let rosterStatus = 'Active'
    if (['JOINING_FORM_PENDING', 'JOINING_FORM_SUBMITTED', 'NDA_PENDING', 'NDA_SIGNED', 'READY_TO_START'].includes(item.state)) {
      rosterStatus = 'Onboarding'
    } else if (item.status === 'ON_HOLD') {
      rosterStatus = 'Action Needed'
    } else if (item.state === 'IN_CLOSURE') {
      rosterStatus = 'Docs Pending'
    } else if (item.status === 'CERTIFICATE_ISSUED' || item.state === 'CLOSED') {
      rosterStatus = 'Completed'
    } else if (!item.mentor_id) {
      rosterStatus = 'Account Needed'
    }

    return {
      id: item.id,
      name: candidateName.replace(/\b\w/g, (char) => char.toUpperCase()),
      initial: (candidateName.trim()[0] || 'I').toUpperCase(),
      department,
      batch,
      mentor: mentorName,
      startDate: item.start_date,
      status: rosterStatus,
    }
  })

  const rosterRowsFiltered = rosterRows.filter((row) => {
    const byBatch = batchFilter === 'ALL' ? true : row.batch === batchFilter
    const byStatus = statusFilter === 'ALL' ? true : row.status === statusFilter
    const searchValue = rosterSearch.trim().toLowerCase()
    const bySearch =
      !searchValue ||
      row.name.toLowerCase().includes(searchValue) ||
      row.department.toLowerCase().includes(searchValue) ||
      row.batch.toLowerCase().includes(searchValue)
    return byBatch && byStatus && bySearch
  })

  const totalInterns = rosterRows.length
  const activeCount = rosterRows.filter((row) => row.status === 'Active').length
  const onboardingCount = rosterRows.filter((row) => row.status === 'Onboarding').length
  const actionNeededCount = rosterRows.filter((row) => row.status === 'Action Needed' || row.status === 'Docs Pending' || row.status === 'Account Needed').length

  const uniqueBatches = ['ALL', ...Array.from(new Set(rosterRows.map((row) => row.batch))).sort()]
  const rosterStatuses = ['ALL', 'Active', 'Onboarding', 'Docs Pending', 'Account Needed', 'Action Needed', 'Completed']

  const rosterBadgeClass = (status) => {
    if (status === 'Active') return 'border-emerald-300 bg-emerald-50 text-emerald-700'
    if (status === 'Onboarding') return 'border-indigo-300 bg-indigo-50 text-indigo-700'
    if (status === 'Docs Pending') return 'border-amber-300 bg-amber-50 text-amber-700'
    if (status === 'Account Needed') return 'border-rose-300 bg-rose-50 text-rose-700'
    if (status === 'Action Needed') return 'border-orange-300 bg-orange-50 text-orange-700'
    if (status === 'Completed') return 'border-slate-300 bg-slate-100 text-slate-600'
    return 'border-slate-300 bg-slate-50 text-slate-700'
  }

  return (
    <div className="flex min-h-screen bg-[#f3f5f9] text-slate-900">
      <aside className="hidden w-64 flex-col border-r border-[#1c2f59] bg-[#08173a] text-slate-200 lg:flex">
        <div className="border-b border-white/10 px-6 py-6">
          <p className="text-3xl font-bold text-indigo-300">Intern Flow</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">HR Portal</p>
        </div>

        <nav className="flex-1 space-y-8 px-3 py-5 text-[15px]">
          <div>
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Overview</p>
            <div className="mt-2 space-y-1">
              <button
                onClick={() => setHrView('dashboard')}
                className={`w-full rounded-lg px-3 py-2 text-left transition ${hrView === 'dashboard' ? 'bg-[#1a2558] text-indigo-300 shadow-[inset_0_0_0_1px_rgba(129,140,248,0.25)]' : 'text-slate-300 hover:bg-[#131f49]'}`}
              >
                <span className="inline-flex h-2 w-2 rounded-full bg-current mr-2" />Dashboard
              </button>
              <button
                onClick={() => setHrView('roster')}
                className={`w-full rounded-lg px-3 py-2 text-left transition ${hrView === 'roster' ? 'bg-[#1a2558] text-indigo-300 shadow-[inset_0_0_0_1px_rgba(129,140,248,0.25)]' : 'text-slate-300 hover:bg-[#131f49]'}`}
              >
                <span className="inline-flex h-2 w-2 rounded-full bg-current mr-2" />Intern Roster
              </button>
              <button className="w-full rounded-lg px-3 py-2 text-left text-slate-300 hover:bg-[#131f49]"><span className="inline-flex h-2 w-2 rounded-full bg-slate-500 mr-2" />Batch Management</button>
            </div>
          </div>

          <div>
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Workflow</p>
            <div className="mt-2 space-y-1">
              <button className="w-full rounded-lg px-3 py-2 text-left text-slate-300 hover:bg-[#131f49]"><span className="inline-flex h-2 w-2 rounded-full bg-slate-500 mr-2" />Referral Approvals</button>
              <button className="w-full rounded-lg px-3 py-2 text-left text-slate-300 hover:bg-[#131f49]"><span className="inline-flex h-2 w-2 rounded-full bg-slate-500 mr-2" />Onboarding Tasks</button>
              <button className="w-full rounded-lg px-3 py-2 text-left text-slate-300 hover:bg-[#131f49]"><span className="inline-flex h-2 w-2 rounded-full bg-slate-500 mr-2" />NDA & Documents</button>
            </div>
          </div>

          <div>
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Insights</p>
            <div className="mt-2 space-y-1">
              <button className="w-full rounded-lg px-3 py-2 text-left text-slate-300 hover:bg-[#131f49]"><span className="inline-flex h-2 w-2 rounded-full bg-slate-500 mr-2" />Reports</button>
              <button className="w-full rounded-lg px-3 py-2 text-left text-slate-300 hover:bg-[#131f49]"><span className="inline-flex h-2 w-2 rounded-full bg-slate-500 mr-2" />Settings</button>
            </div>
          </div>
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <div className="flex items-center justify-between rounded-xl bg-[#101f47] px-3 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#223268] text-sm font-bold">
                {(currentUser?.full_name || 'H').trim().charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">{currentUser?.full_name || 'HR Manager'}</p>
                <p className="text-xs text-slate-400">{currentUser?.email || 'hr@internflow.com'}</p>
              </div>
            </div>
            <button onClick={onLogout} className="rounded-md px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/10">Exit</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Human Resources</p>
              <h1 className="text-[38px] font-extrabold leading-[0.95] text-[#1f2c45]">
                {hrView === 'dashboard' ? 'Dashboard' : (
                  <>
                    <span className="block">Intern</span>
                    <span className="block">Roster</span>
                  </>
                )}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm">
                <input
                  value={rosterSearch}
                  onChange={(event) => setRosterSearch(event.target.value)}
                  placeholder="Search interns, batches..."
                  className="w-64 bg-transparent text-sm outline-none"
                />
              </div>
              <button className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-sm" aria-label="Notifications">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                  <path d="M9 17a3 3 0 0 0 6 0" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1240px] space-y-6 p-6">
          {hrView === 'dashboard' && (
            <>
              <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-slate-100 px-5 py-4">
                <h2 className="text-xl font-semibold text-indigo-900">HR Dashboard</h2>
                <p className="text-sm text-indigo-700">Review joining forms, manage non-worker IDs, and close with certificates.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <p className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">Pending Form Reviews</p>
                  <p className="mt-1 text-4xl font-bold text-slate-800">{pendingForms.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <p className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">Selected Referral</p>
                  <p className="mt-1 text-xl font-bold text-indigo-600">{selectedReferralId || 'None'}</p>
                </div>
                <div className="flex items-center justify-end rounded-xl px-5 py-4">
                  <button
                    onClick={refreshData}
                    disabled={loading}
                    className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:bg-slate-400"
                  >
                    {loading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4">
                  <p className="text-sm font-bold uppercase tracking-[0.08em] text-emerald-700">Step 9: Active Interns</p>
                  <p className="mt-1 text-4xl font-bold text-emerald-700">{activeInterns.length}</p>
                  <p className="text-sm text-emerald-700">HR monitoring currently active internship records.</p>
                </div>
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4">
                  <p className="text-sm font-bold uppercase tracking-[0.08em] text-amber-700">Upcoming Completions (14 days)</p>
                  <p className="mt-1 text-4xl font-bold text-amber-700">{upcomingCompletions.length}</p>
                  <p className="text-sm text-amber-700">Track interns approaching internship end dates.</p>
                </div>
              </div>

              {localNotice.text && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    localNotice.type === 'error'
                      ? 'border-rose-200 bg-rose-50 text-rose-800'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  }`}
                >
                  {localNotice.text}
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex border-b border-slate-200">
                  <button
                    onClick={() => setActiveTab('forms')}
                    className={`flex-1 px-4 py-3 text-sm font-semibold transition ${
                      activeTab === 'forms' ? 'border-b-2 border-indigo-500 text-slate-700' : 'text-slate-500'
                    }`}
                  >
                    Pending Joining Forms ({pendingForms.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('ops')}
                    className={`flex-1 px-4 py-3 text-sm font-semibold transition ${
                      activeTab === 'ops' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-slate-500'
                    }`}
                  >
                    NDA, Non-Worker & Certificate Ops
                  </button>
                </div>

                <div className="p-6">
          {activeTab === 'forms' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                <h3 className="text-lg font-semibold text-indigo-900">Step 6: HR Reviews Joining Form</h3>
                <p className="text-sm text-indigo-800">Verify candidate details, uploaded documents, eligibility and completeness before decision.</p>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <label className="text-sm font-semibold text-gray-700">Review Referral</label>
                <select
                  value={selectedReferralId}
                  onChange={(event) => setSelectedReferralId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">Select pending joining form</option>
                  {pendingForms.map((form) => (
                    <option key={form.id} value={form.referral_id}>{form.referral_id}</option>
                  ))}
                </select>

                {selectedPendingForm && (
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded border border-gray-200 bg-white p-3">
                        <p className="font-semibold text-gray-800">Candidate Details</p>
                        <p className="text-gray-600">{selectedFormDetails?.personal_details?.name || 'Not available'}</p>
                        <p className="text-gray-600">{selectedFormDetails?.personal_details?.email || 'No email'}</p>
                      </div>
                      <div className="rounded border border-gray-200 bg-white p-3">
                        <p className="font-semibold text-gray-800">Uploaded Documents</p>
                        <p className="text-gray-600">Government IDs: {selectedFormDetails?.government_ids?.length || 0}</p>
                        <p className="text-gray-600">Other docs: {selectedFormDetails?.government_ids?.[0]?.document_url || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="rounded border border-gray-200 bg-white p-3">
                      <p className="font-semibold text-gray-800">Verification Checklist</p>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <p className="text-gray-700">Candidate details: {selectedFormStatus?.has_personal_details ? 'Verified' : 'Missing'}</p>
                        <p className="text-gray-700">Uploaded documents: {selectedFormStatus?.has_government_ids ? 'Verified' : 'Missing'}</p>
                        <p className="text-gray-700">Eligibility: {selectedReferral?.unpaid_consent_confirmed && selectedReferral?.in_person_ready_confirmed && selectedReferral?.location_match_confirmed ? 'Verified' : 'Pending'}</p>
                        <p className="text-gray-700">Completeness: {selectedFormStatus?.has_address && selectedFormStatus?.has_emergency_contact && selectedFormStatus?.has_education ? 'Complete' : 'Incomplete'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!pendingForms.length ? (
                <p className="text-gray-600">No pending forms.</p>
              ) : (
                pendingForms.map((form) => (
                  <div key={form.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-800">Referral: {form.referral_id}</p>
                        <p className="text-sm text-gray-600">Form status: {form.status}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(form.referral_id)}
                          disabled={loading}
                          className="rounded bg-green-600 px-3 py-2 text-white text-sm font-semibold hover:bg-green-700 disabled:bg-gray-400"
                        >
                          {actionLoading === 'approve' ? 'Verifying...' : 'Approve (HR_VERIFIED)'}
                        </button>
                        <button
                          onClick={() => handleReject(form.referral_id)}
                          disabled={loading}
                          className="rounded bg-red-600 px-3 py-2 text-white text-sm font-semibold hover:bg-red-700 disabled:bg-gray-400"
                        >
                          {actionLoading === 'reject' ? 'Sending...' : 'Corrections Required'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'ops' && (
            <div className="space-y-6">
              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <h4 className="font-semibold text-gray-800">NDA Review Queue</h4>
                <p className="text-sm text-gray-600">Approve signed NDA copies uploaded by candidates.</p>
                {!pendingNdas.length ? (
                  <p className="text-sm text-gray-600">No NDAs pending HR approval.</p>
                ) : (
                  <div className="space-y-2">
                    {pendingNdas.map((ndaItem) => (
                      <div key={ndaItem.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-200 p-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">Referral: {ndaItem.referral_id}</p>
                          <p className="text-xs text-gray-600">Status: {ndaItem.status}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {ndaItem.archived_url ? (
                            <a
                              href={ndaItem.archived_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
                            >
                              View Signed Copy
                            </a>
                          ) : (
                            <span className="text-xs text-gray-500">Signed copy unavailable</span>
                          )}
                          <button
                            onClick={() => handleApproveNda(ndaItem.referral_id)}
                            disabled={loading}
                            className="rounded bg-emerald-600 px-3 py-2 text-white text-sm font-semibold hover:bg-emerald-700 disabled:bg-gray-400"
                          >
                            {actionLoading === 'nda-approve' ? 'Approving...' : 'Approve NDA'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <h4 className="font-semibold text-gray-800">Step 10: Extension Requests</h4>
                <p className="text-sm text-gray-600">Mentor-submitted extension requests pending HR review.</p>
                {!pendingExtensions.length ? (
                  <p className="text-sm text-gray-600">No extension requests pending review.</p>
                ) : (
                  <div className="space-y-2">
                    {pendingExtensions.map((item) => {
                      const extensionRequest = item.additional_data?.extension_request || {}
                      return (
                        <div key={item.id} className="rounded border border-gray-200 p-3">
                          <p className="text-sm font-semibold text-gray-800">Referral: {item.id}</p>
                          <p className="text-xs text-gray-600">Current End Date: {item.end_date || 'N/A'}</p>
                          <p className="text-xs text-gray-600">Requested End Date: {extensionRequest.new_end_date || 'N/A'}</p>
                          <p className="text-xs text-gray-600">Reason: {extensionRequest.reason || 'N/A'}</p>
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => handleExtensionReview(item.id, 'APPROVE')}
                              disabled={loading}
                              className="rounded bg-emerald-600 px-3 py-2 text-white text-xs font-semibold hover:bg-emerald-700 disabled:bg-gray-400"
                            >
                              {actionLoading === 'extension-approve' ? 'Approving...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleExtensionReview(item.id, 'REJECT')}
                              disabled={loading}
                              className="rounded bg-rose-600 px-3 py-2 text-white text-xs font-semibold hover:bg-rose-700 disabled:bg-gray-400"
                            >
                              {actionLoading === 'extension-reject' ? 'Rejecting...' : 'Reject'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <h4 className="font-semibold text-gray-800">Step 12: HR Closure Review</h4>
                <p className="text-sm text-gray-600">Verify internship completion and pending activities before approving closure.</p>
                {!pendingClosures.length ? (
                  <p className="text-sm text-gray-600">No closure approvals pending.</p>
                ) : (
                  <div className="space-y-2">
                    {pendingClosures.map((item) => (
                      <div key={item.id} className="rounded border border-gray-200 p-3">
                        <p className="text-sm font-semibold text-gray-800">Referral: {item.id}</p>
                        <p className="text-xs text-gray-600">Internship completed: Yes</p>
                        <p className="text-xs text-gray-600">Pending activities: Must be none to approve</p>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => handleClosureReview(item.id, 'APPROVE')}
                            disabled={loading}
                            className="rounded bg-emerald-600 px-3 py-2 text-white text-xs font-semibold hover:bg-emerald-700 disabled:bg-gray-400"
                          >
                            {actionLoading === 'closure-approve' ? 'Approving...' : 'Approve Closure'}
                          </button>
                          <button
                            onClick={() => handleClosureReview(item.id, 'REJECT')}
                            disabled={loading}
                            className="rounded bg-rose-600 px-3 py-2 text-white text-xs font-semibold hover:bg-rose-700 disabled:bg-gray-400"
                          >
                            {actionLoading === 'closure-reject' ? 'Rejecting...' : 'Reject'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                <h4 className="font-semibold text-emerald-900">Step 8: HR Activates Internship</h4>
                <p className="text-sm text-emerald-800">Verify prerequisites, then activate internship and send start confirmation notifications.</p>
                <div className="grid gap-2 text-sm md:grid-cols-3">
                  <p className="text-emerald-900">Joining Form: <span className="font-semibold">{hasJoiningFormCompleted ? 'Completed' : 'Pending'}</span></p>
                  <p className="text-emerald-900">NDA: <span className="font-semibold">{hasNdaCompleted ? 'Completed' : 'Pending'}</span></p>
                  <p className="text-emerald-900">Required Documents: <span className="font-semibold">{hasRequiredDocuments ? 'Submitted' : 'Missing'}</span></p>
                </div>
                <button
                  onClick={handleActivateInternship}
                  disabled={loading || !canActivateInternship}
                  className="rounded bg-emerald-600 px-4 py-2 text-white text-sm font-semibold hover:bg-emerald-700 disabled:bg-gray-400"
                >
                  {actionLoading === 'activate-internship' ? 'Activating...' : 'Activate Internship'}
                </button>
              </div>

              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <h4 className="font-semibold text-gray-800">Step 9: Monitor Active Interns</h4>
                {!activeInterns.length ? (
                  <p className="text-sm text-gray-600">No active internships at the moment.</p>
                ) : (
                  <div className="space-y-2">
                    {activeInterns.slice(0, 6).map((item) => (
                      <div key={item.id} className="rounded border border-gray-200 p-3 text-sm">
                        <p className="font-semibold text-gray-800">{item.id}</p>
                        <p className="text-gray-600">State: {item.state} · End Date: {item.end_date || 'Not set'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <h4 className="font-semibold text-gray-800">Track Upcoming Completions</h4>
                {!upcomingCompletions.length ? (
                  <p className="text-sm text-gray-600">No upcoming completions in the next 14 days.</p>
                ) : (
                  <div className="space-y-2">
                    {upcomingCompletions.map((item) => (
                      <div key={item.id} className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
                        <p className="font-semibold text-amber-900">{item.id}</p>
                        <p className="text-amber-800">Ends on {item.end_date} ({item.days_left} days left)</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Referral ID</label>
                <select
                  value={selectedReferralId}
                  onChange={(event) => setSelectedReferralId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">Select referral from HR queue</option>
                  {queueReferrals.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id} · {item.state}
                    </option>
                  ))}
                </select>
                {selectedReferral && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusChipClass}`}>
                      Status: {selectedStatus}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                      State: {selectedState}
                    </span>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <h4 className="font-semibold text-gray-800">Mentor Reassignment</h4>
                <input
                  value={mentorEmail}
                  onChange={(event) => setMentorEmail(event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="New mentor email"
                />
                <input
                  value={mentorReassignNotes}
                  onChange={(event) => setMentorReassignNotes(event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Optional notes"
                />
                <button
                  onClick={handleReassignMentor}
                  disabled={loading}
                  className="rounded bg-indigo-600 px-3 py-2 text-white text-sm font-semibold hover:bg-indigo-700 disabled:bg-gray-400"
                >
                  {actionLoading === 'mentor-reassign' ? 'Reassigning...' : 'Reassign Mentor'}
                </button>
              </div>

              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <h4 className="font-semibold text-gray-800">Referral Hold Control</h4>
                <input
                  value={holdReason}
                  onChange={(event) => setHoldReason(event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Reason for hold"
                />
                <div className="flex flex-col gap-2 md:flex-row">
                  <button
                    onClick={handleHoldReferral}
                    disabled={loading}
                    className="rounded bg-amber-600 px-3 py-2 text-white text-sm font-semibold hover:bg-amber-700 disabled:bg-gray-400"
                  >
                    {actionLoading === 'referral-hold' ? 'Holding...' : 'Put On Hold'}
                  </button>
                </div>

                <input
                  value={unholdReason}
                  onChange={(event) => setUnholdReason(event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Optional reason for unhold"
                />
                <button
                  onClick={handleUnholdReferral}
                  disabled={loading}
                  className="rounded bg-emerald-600 px-3 py-2 text-white text-sm font-semibold hover:bg-emerald-700 disabled:bg-gray-400"
                >
                  {actionLoading === 'referral-unhold' ? 'Removing Hold...' : 'Remove Hold'}
                </button>
              </div>

              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <h4 className="font-semibold text-gray-800">Non-Worker Task</h4>
                <div className="flex flex-col gap-2 md:flex-row">
                  <button
                    onClick={() => handleNonWorkerAction('create')}
                    disabled={loading}
                    className="rounded bg-indigo-600 px-3 py-2 text-white text-sm font-semibold hover:bg-indigo-700 disabled:bg-gray-400"
                  >
                    {actionLoading === 'nonworker-create' ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    onClick={() => handleNonWorkerAction('in-progress')}
                    disabled={loading}
                    className="rounded bg-indigo-600 px-3 py-2 text-white text-sm font-semibold hover:bg-indigo-700 disabled:bg-gray-400"
                  >
                    {actionLoading === 'nonworker-in-progress' ? 'Updating...' : 'In Progress'}
                  </button>
                  <input
                    value={generatedId}
                    onChange={(event) => setGeneratedId(event.target.value)}
                    className="rounded border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Generated ID"
                  />
                  <button
                    onClick={() => handleNonWorkerAction('complete')}
                    disabled={loading}
                    className="rounded bg-green-600 px-3 py-2 text-white text-sm font-semibold hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {actionLoading === 'nonworker-complete' ? 'Completing...' : 'Complete'}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <h4 className="font-semibold text-gray-800">Step 14: HR Generates & Issues Certificate</h4>
                <p className="text-sm text-gray-600">System generates certificate PDF, company letterhead version, and archive copy; candidate receives download link and email copy.</p>
                <input
                  value={certificatePayload.request_form_url}
                  onChange={(event) =>
                    setCertificatePayload((current) => ({ ...current, request_form_url: event.target.value }))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Request form URL"
                />
                <input
                  value={certificatePayload.template_used}
                  onChange={(event) =>
                    setCertificatePayload((current) => ({ ...current, template_used: event.target.value }))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Template used"
                />
                <input
                  value={certificatePayload.certificate_pdf_url}
                  onChange={(event) =>
                    setCertificatePayload((current) => ({ ...current, certificate_pdf_url: event.target.value }))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Certificate PDF URL"
                />
                <input
                  value={certificatePayload.letterhead_pdf_url}
                  onChange={(event) =>
                    setCertificatePayload((current) => ({ ...current, letterhead_pdf_url: event.target.value }))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Company letterhead PDF URL"
                />
                <input
                  value={certificatePayload.archive_copy_url}
                  onChange={(event) =>
                    setCertificatePayload((current) => ({ ...current, archive_copy_url: event.target.value }))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Archive copy URL"
                />
                <input
                  value={certificatePayload.candidate_download_url}
                  onChange={(event) =>
                    setCertificatePayload((current) => ({ ...current, candidate_download_url: event.target.value }))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Candidate download link"
                />
                <input
                  value={certificatePayload.candidate_email_sent_to}
                  onChange={(event) =>
                    setCertificatePayload((current) => ({ ...current, candidate_email_sent_to: event.target.value }))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Candidate email copy recipient"
                />
                <div className="flex flex-col gap-2 md:flex-row">
                  <button
                    onClick={() => handleCertificateAction('request')}
                    disabled={loading}
                    className="rounded bg-indigo-600 px-3 py-2 text-white text-sm font-semibold hover:bg-indigo-700 disabled:bg-gray-400"
                  >
                    {actionLoading === 'certificate-request' ? 'Requesting...' : 'Request'}
                  </button>
                  <button
                    onClick={() => handleCertificateAction('generate')}
                    disabled={loading}
                    className="rounded bg-indigo-600 px-3 py-2 text-white text-sm font-semibold hover:bg-indigo-700 disabled:bg-gray-400"
                  >
                    {actionLoading === 'certificate-generate' ? 'Generating...' : 'Generate'}
                  </button>
                  <button
                    onClick={() => handleCertificateAction('issue')}
                    disabled={loading}
                    className="rounded bg-green-600 px-3 py-2 text-white text-sm font-semibold hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {actionLoading === 'certificate-issue' ? 'Issuing...' : 'Issue (Final)'}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Latest Timeline Events</h4>
                {!recentEvents.length ? (
                  <p className="text-sm text-gray-600">No events for selected referral.</p>
                ) : (
                  <div className="space-y-2">
                    {recentEvents.slice(-5).reverse().map((event) => (
                      <div key={event.id} className="rounded border border-gray-100 p-2 text-sm">
                        <div className="font-semibold text-gray-700">{event.event_type}</div>
                        <div className="text-gray-600">{event.description || 'No description'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
                </div>
              </div>
            </>
          )}

          {hrView === 'roster' && (
            <>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-sm text-slate-600">Track intern onboarding progress, current batches, and action-required accounts in one place.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Total Interns</p><p className="mt-1 text-[34px] font-extrabold leading-none text-slate-800">{totalInterns}</p></div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Active</p><p className="mt-1 text-[34px] font-extrabold leading-none text-emerald-600">{activeCount}</p></div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">In Onboarding</p><p className="mt-1 text-[34px] font-extrabold leading-none text-indigo-600">{onboardingCount}</p></div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Action Needed</p><p className="mt-1 text-[34px] font-extrabold leading-none text-amber-600">{actionNeededCount}</p></div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={batchFilter} onChange={(event) => setBatchFilter(event.target.value)} className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm">
                      {uniqueBatches.map((batch) => <option key={batch} value={batch}>{batch === 'ALL' ? 'All Batches' : batch}</option>)}
                    </select>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm">
                      {rosterStatuses.map((status) => <option key={status} value={status}>{status === 'ALL' ? 'All Statuses' : status}</option>)}
                    </select>
                    <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600">More Filters</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600">Export</button>
                    <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white">Add Intern</button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#f6f7fb] text-xs uppercase tracking-[0.08em] text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Name</th>
                        <th className="px-5 py-3">Department</th>
                        <th className="px-5 py-3">Batch</th>
                        <th className="px-5 py-3">Mentor</th>
                        <th className="px-5 py-3">Start Date</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">...</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!rosterRowsFiltered.length && (
                        <tr>
                          <td className="px-5 py-6 text-slate-500" colSpan={7}>No interns match the current filters.</td>
                        </tr>
                      )}
                      {rosterRowsFiltered.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100 transition hover:bg-slate-50/80">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">{row.initial}</div>
                              <span className="font-medium text-slate-800">{row.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-slate-600">{row.department}</td>
                          <td className="px-5 py-3"><span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{row.batch}</span></td>
                          <td className="px-5 py-3 text-slate-600">{row.mentor}</td>
                          <td className="px-5 py-3 text-slate-600">{row.startDate || '-'}</td>
                          <td className="px-5 py-3"><span className={`inline-flex rounded-md border px-2.5 py-0.5 text-[12px] font-bold ${rosterBadgeClass(row.status)}`}>{row.status}</span></td>
                          <td className="px-5 py-3 text-right text-slate-400">...</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {loading && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 animate-pulse">
              Running HR workflow actions...
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default HRDashboard
