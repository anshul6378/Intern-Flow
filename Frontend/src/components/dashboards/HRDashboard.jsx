import { useEffect, useState } from 'react'

function HRDashboard({ token, currentUser, setError, setMessage, onLogout }) {
  const [activeTab, setActiveTab] = useState('forms')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [localNotice, setLocalNotice] = useState({ type: '', text: '' })
  const [pendingForms, setPendingForms] = useState([])
  const [queueReferrals, setQueueReferrals] = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  const [selectedReferralId, setSelectedReferralId] = useState('')
  const [generatedId, setGeneratedId] = useState('NW-')
  const [mentorEmail, setMentorEmail] = useState('')
  const [mentorReassignNotes, setMentorReassignNotes] = useState('')
  const [holdReason, setHoldReason] = useState('')
  const [unholdReason, setUnholdReason] = useState('')
  const [certificatePayload, setCertificatePayload] = useState({
    request_form_url: 'https://forms.example.com/certificate-request',
    template_used: 'default-v1',
    archived_url: 'https://storage.example.com/certificates/generated.pdf',
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

      const queue = await apiRequest('/referrals/hr/queue')
      const queueItems = queue.items || []
      setQueueReferrals(queueItems)
      const defaultReferralId = selectedReferralId || queueItems[0]?.id || forms[0]?.referral_id || ''
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
        return
      }

      try {
        const timeline = await apiRequest(`/referrals/${selectedReferralId}/timeline`)
        setRecentEvents(timeline.events || [])
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
        body: JSON.stringify({ action: 'APPROVE', notes: 'Approved by HR dashboard' }),
      })
      setMessage(`Joining form approved for ${referralId}`)
      setLocalNotice({ type: 'success', text: `Joining form approved for ${referralId}` })
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
        body: JSON.stringify({ action: 'REJECT', notes: 'Needs corrections' }),
      })
      setMessage(`Joining form rejected for ${referralId}`)
      setLocalNotice({ type: 'success', text: `Joining form rejected for ${referralId}` })
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
    if (action === 'generate' && (!certificatePayload.template_used.trim() || !certificatePayload.archived_url.trim())) {
      setError('Template and archived URL are required to generate certificate')
      setLocalNotice({ type: 'error', text: 'Template and archived URL are required to generate certificate' })
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
            archived_url: certificatePayload.archived_url,
          }),
        })
      }
      if (action === 'issue') {
        await apiRequest(`/referrals/${selectedReferralId}/certificate/issue`, { method: 'POST' })
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

  const selectedReferral = queueReferrals.find((item) => item.id === selectedReferralId) || null
  const selectedStatus = selectedReferral?.status || ''
  const selectedState = selectedReferral?.state || ''
  const statusChipClass =
    selectedStatus === 'ON_HOLD'
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : selectedStatus === 'ACTIVE'
        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
        : 'bg-slate-100 text-slate-700 border-slate-200'

  return (
    <div className="min-h-screen w-full bg-slate-50 overflow-auto">
      <div className="border-b border-slate-200 bg-white px-8 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">HR Dashboard</h1>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <p className="font-semibold text-slate-800">{currentUser?.full_name || 'HR User'}</p>
            <p className="text-slate-600">{currentUser?.email || 'hr@internflow.com'}</p>
          </div>
          <button
            onClick={onLogout}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Logout
          </button>
        </div>
      </div>
      <div className="space-y-6 p-8">
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <h2 className="text-xl font-semibold text-indigo-900">HR Dashboard</h2>
        <p className="text-indigo-700 mt-1">Review joining forms, manage non-worker IDs, and close with certificates.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm font-semibold">Pending Form Reviews</p>
          <p className="text-2xl font-bold text-red-600 mt-2">{pendingForms.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm font-semibold">Selected Referral</p>
          <p className="text-sm font-semibold text-gray-800 mt-2 break-all">{selectedReferralId || 'None'}</p>
          {selectedReferral && (
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusChipClass}`}>
                {selectedStatus}
              </span>
              <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                {selectedState}
              </span>
            </div>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <button
            onClick={refreshData}
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-white font-semibold hover:bg-indigo-700 disabled:bg-gray-400"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
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

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('forms')}
            className={`flex-1 px-4 py-3 font-semibold transition ${
              activeTab === 'forms' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600'
            }`}
          >
            Pending Joining Forms ({pendingForms.length})
          </button>
          <button
            onClick={() => setActiveTab('ops')}
            className={`flex-1 px-4 py-3 font-semibold transition ${
              activeTab === 'ops' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600'
            }`}
          >
            Non-Worker & Certificate Ops
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'forms' && (
            <div className="space-y-3">
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
                          {actionLoading === 'approve' ? 'Approving...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReject(form.referral_id)}
                          disabled={loading}
                          className="rounded bg-red-600 px-3 py-2 text-white text-sm font-semibold hover:bg-red-700 disabled:bg-gray-400"
                        >
                          {actionLoading === 'reject' ? 'Rejecting...' : 'Reject'}
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
                <h4 className="font-semibold text-gray-800">Certificate Workflow</h4>
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
                  value={certificatePayload.archived_url}
                  onChange={(event) =>
                    setCertificatePayload((current) => ({ ...current, archived_url: event.target.value }))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Archived URL"
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
                    {actionLoading === 'certificate-issue' ? 'Issuing...' : 'Issue'}
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

      {loading && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 animate-pulse text-sm text-slate-600">
          Running HR workflow actions...
        </div>
      )}
      </div>
    </div>
  )
}

export default HRDashboard
