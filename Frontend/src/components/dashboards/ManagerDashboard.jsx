import { useEffect, useMemo, useState } from 'react'

const NAV = [
  { group: 'MAIN', items: [{ id: 'dashboard', label: 'Dashboard' }, { id: 'referrals', label: 'Referrals' }, { id: 'active', label: 'Active Interns' }] },
  { group: 'GOVERNANCE', items: [{ id: 'sla', label: 'SLA Monitor' }, { id: 'compliance', label: 'Compliance' }, { id: 'reports', label: 'Reports' }] },
  { group: 'SYSTEM', items: [{ id: 'users', label: 'User Management' }, { id: 'settings', label: 'Settings' }] },
]

const NOTICE_TIMEOUT_MS = 3000

function ManagerDashboard({ token, currentUser, setError, setMessage, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState({ type: '', text: '' })
  const [referrals, setReferrals] = useState([])
  const [hrQueue, setHrQueue] = useState([])
  const [reviewQueue, setReviewQueue] = useState([])
  const [selectedReviewId, setSelectedReviewId] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewActionLoading, setReviewActionLoading] = useState('')

  useEffect(() => {
    if (!notice.text) {
      return
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
    if (!response.ok) throw new Error(data?.detail || 'Request failed')
    return data
  }

  const refreshAdminData = async () => {
    setLoading(true)
    try {
      const [all, queue, adminReviewQueue] = await Promise.all([
        apiRequest('/referrals?limit=100'),
        apiRequest('/referrals/hr/queue?limit=100'),
        currentUser?.role === 'admin' ? apiRequest('/referrals/admin/review-queue?limit=100') : Promise.resolve({ items: [] }),
      ])
      setReferrals(all.items || [])
      setHrQueue(queue.items || [])
      const reviewItems = adminReviewQueue.items || []
      setReviewQueue(reviewItems)
      if (!selectedReviewId && reviewItems.length) {
        setSelectedReviewId(reviewItems[0].id)
      }
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Failed to load admin data' })
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshAdminData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const metrics = useMemo(() => {
    const total = referrals.length
    const active = referrals.filter((r) => ['IN_PROGRESS', 'READY_TO_START', 'EXTENDED'].includes(r.state)).length
    const pendingNdas = referrals.filter((r) => r.state === 'NDA_PENDING').length
    const breaches = referrals.filter((r) => ['ELIGIBILITY_REVIEW', 'NDA_PENDING', 'NON_WORKER_ID_PENDING'].includes(r.state)).length
    const completed = referrals.filter((r) => r.state === 'CLOSED').length
    const completionRate = total ? Math.round((completed / total) * 100) : 0
    return { total, active, pendingNdas, breaches, completionRate }
  }, [referrals])

  const stageCount = useMemo(() => {
    const count = (states) => referrals.filter((r) => states.includes(r.state)).length
    return [
      { label: 'Referral Submitted', value: count(['SUBMITTED']) },
      { label: 'Eligibility Checks', value: count(['ELIGIBILITY_REVIEW', 'ELIGIBILITY_PASSED']) },
      { label: 'Joining Form', value: count(['JOINING_FORM_PENDING', 'JOINING_FORM_SUBMITTED']) },
      { label: 'ID Provisioned', value: count(['NON_WORKER_ID_PENDING', 'CREDENTIALS_GENERATED']) },
      { label: 'NDA Signed', value: count(['NDA_SIGNED']) },
      { label: 'Active', value: count(['IN_PROGRESS', 'READY_TO_START']) },
    ]
  }, [referrals])

  const handleIssueNdaBatch = async () => {
    setLoading(true)
    try {
      const pending = referrals.filter((r) => r.state === 'NDA_PENDING').slice(0, 3)
      await Promise.all(pending.map((r) => apiRequest(`/referrals/${r.id}/nda/send`, {
        method: 'POST',
        body: JSON.stringify({ esign_provider: 'DocuSign', template_version: 'v1', expires_in_hours: 48 }),
      })))
      setMessage('NDA batch issued for pending referrals')
      setNotice({ type: 'success', text: 'NDA batch issued successfully' })
      await refreshAdminData()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAssignNonWorker = async () => {
    setLoading(true)
    try {
      const targets = referrals.filter((r) => r.state === 'NDA_SIGNED').slice(0, 3)
      await Promise.all(targets.map((r) => apiRequest(`/referrals/${r.id}/non-worker`, {
        method: 'POST',
        body: JSON.stringify({ assigned_to: null }),
      })))
      setNotice({ type: 'success', text: 'Non-Worker ID tasks assigned' })
      await refreshAdminData()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAdminReview = async (decision) => {
    if (currentUser?.role !== 'admin') {
      setNotice({ type: 'error', text: 'Only admin can review referrals.' })
      return
    }
    if (!selectedReviewId) {
      setNotice({ type: 'error', text: 'Select a referral to review.' })
      return
    }

    const referralForMessage = reviewQueue.find((item) => item.id === selectedReviewId) || null
    const candidateName = getReviewCandidateName(referralForMessage)

    setReviewActionLoading(decision)
    setLoading(true)
    try {
      await apiRequest(`/referrals/${selectedReviewId}/admin-review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          notes: reviewNotes || null,
        }),
      })

      const actionLabel = decision === 'APPROVE'
        ? 'approved'
        : decision === 'REJECT'
          ? 'rejected'
          : 'sent back for changes'
      setMessage(`Referral ${candidateName} ${actionLabel}`)
      setNotice({ type: 'success', text: `Referral ${candidateName} ${actionLabel}` })
      setReviewNotes('')
      await refreshAdminData()
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Admin review failed' })
      setError(err.message)
    } finally {
      setLoading(false)
      setReviewActionLoading('')
    }
  }

  const selectedReviewReferral = useMemo(
    () => reviewQueue.find((item) => item.id === selectedReviewId) || null,
    [reviewQueue, selectedReviewId],
  )

  const reviewData = selectedReviewReferral?.additional_data || {}
  const candidateDetails = reviewData?.candidate_details || {}
  const internshipDetails = reviewData?.internship_details || {}
  const mentorDetails = reviewData?.mentor_details || {}
  const projectInfo = reviewData?.project_information || {}

  const getReviewCandidateName = (referral) => {
    const details = referral?.additional_data?.candidate_details || {}
    return details.name || details.email || referral?.candidate_id || 'Candidate'
  }

  return (
    <div className="flex min-h-screen overflow-hidden rounded-none border-none bg-white shadow-none">
      <aside className="flex w-64 flex-col bg-[#07153a] text-white">
        <div className="border-b border-white/10 p-6">
          <p className="text-3xl font-bold tracking-tight text-indigo-300">Intern Flow</p>
          <p className="mt-1 text-sm text-slate-300">ADMIN PORTAL</p>
        </div>
        <nav className="space-y-5 p-3">
          {NAV.map((group) => (
            <div key={group.group}>
              <p className="px-2 text-xs font-semibold tracking-widest text-slate-400">{group.group}</p>
              <div className="mt-1 space-y-1">
                {group.items.map((item) => (
                  <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full rounded-lg px-3 py-2 text-left text-base font-semibold ${activeTab === item.id ? 'bg-indigo-700/30 text-indigo-300' : 'text-slate-200 hover:bg-white/10'}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/10 p-4">
          <div className="text-sm text-slate-300">
            <p className="font-semibold text-white">{currentUser?.full_name || 'Admin User'}</p>
            <p>{currentUser?.email || 'admin@internflow.com'}</p>
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
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
          <h1 className="text-4xl font-bold text-slate-800">{activeTab === 'sla' ? 'SLA Monitor' : 'Dashboard'}</h1>
          <div className="flex items-center gap-3">
            <input placeholder="Search..." className="w-64 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
            <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600">🔔</button>
          </div>
        </header>

        {notice.text && (
          <div className={`mx-8 mt-5 rounded-lg border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {notice.text}
          </div>
        )}

        {activeTab === 'referrals' && (
          <div className="space-y-6 p-8">
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
              <h2 className="text-3xl font-bold text-indigo-900">Administrative Referral Review</h2>
              <p className="mt-1 text-sm text-indigo-700">Admin gatekeeper step for submitted internship referrals.</p>
            </div>

            {currentUser?.role !== 'admin' ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                Referral review actions are available only for admin accounts.
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border bg-white p-4">
                    <p className="text-xs font-semibold text-slate-500">Pending Reviews</p>
                    <p className="text-4xl font-bold text-slate-800">{reviewQueue.length}</p>
                  </div>
                  <div className="rounded-2xl border bg-white p-4 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-500">Select Referral</label>
                    <select
                      value={selectedReviewId}
                      onChange={(event) => setSelectedReviewId(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select submitted referral</option>
                      {reviewQueue.map((item) => (
                        <option key={item.id} value={item.id}>
                          {getReviewCandidateName(item)} · {item.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {!selectedReviewReferral ? (
                  <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">No referral selected.</div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border bg-white p-5 space-y-4">
                      <h3 className="text-xl font-bold text-slate-800">Candidate Information</h3>
                      <p className="text-sm text-slate-700"><span className="font-semibold">Name:</span> {candidateDetails?.name || 'Not provided'}</p>
                      <p className="text-sm text-slate-700"><span className="font-semibold">Email:</span> {candidateDetails?.email || 'Not provided'}</p>
                      <p className="text-sm text-slate-700"><span className="font-semibold">Phone:</span> {candidateDetails?.phone || 'Not provided'}</p>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-800">Resume</h4>
                        {reviewData?.uploaded_resume_url ? (
                          <a href={reviewData.uploaded_resume_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-indigo-600 hover:underline">
                            Open Uploaded Resume
                          </a>
                        ) : (
                          <p className="text-sm text-slate-500">No resume uploaded.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-white p-5 space-y-4">
                      <h3 className="text-xl font-bold text-slate-800">Internship Details</h3>
                      <p className="text-sm text-slate-700"><span className="font-semibold">Title:</span> {internshipDetails?.internship_title || 'Not provided'}</p>
                      <p className="text-sm text-slate-700"><span className="font-semibold">Department:</span> {internshipDetails?.department_function || 'Not provided'}</p>
                      <p className="text-sm text-slate-700"><span className="font-semibold">Duration:</span> {internshipDetails?.duration || 'Not provided'}</p>
                      <p className="text-sm text-slate-700"><span className="font-semibold">Location:</span> {internshipDetails?.location || selectedReviewReferral.location || 'Not provided'}</p>
                    </div>

                    <div className="rounded-2xl border bg-white p-5 space-y-4">
                      <h3 className="text-xl font-bold text-slate-800">Project Justification</h3>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{projectInfo?.business_justification || 'Not provided'}</p>
                    </div>

                    <div className="rounded-2xl border bg-white p-5 space-y-4">
                      <h3 className="text-xl font-bold text-slate-800">Mentor Assignment</h3>
                      <p className="text-sm text-slate-700"><span className="font-semibold">Mentor Name:</span> {mentorDetails?.mentor_name || 'Not provided'}</p>
                      <p className="text-sm text-slate-700"><span className="font-semibold">Mentor Email:</span> {mentorDetails?.mentor_email || 'Not provided'}</p>
                      <p className="text-sm text-slate-700"><span className="font-semibold">Mentor Department:</span> {mentorDetails?.mentor_department || 'Not provided'}</p>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border bg-white p-5 space-y-3">
                  <h3 className="text-xl font-bold text-slate-800">Review Decision</h3>
                  <textarea
                    value={reviewNotes}
                    onChange={(event) => setReviewNotes(event.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Add review notes (required for reject/request changes)"
                  />
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleAdminReview('APPROVE')}
                      disabled={loading || !selectedReviewReferral}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:bg-slate-300"
                    >
                      {reviewActionLoading === 'APPROVE' ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleAdminReview('REJECT')}
                      disabled={loading || !selectedReviewReferral}
                      className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:bg-slate-300"
                    >
                      {reviewActionLoading === 'REJECT' ? 'Rejecting...' : 'Reject'}
                    </button>
                    <button
                      onClick={() => handleAdminReview('REQUEST_CHANGES')}
                      disabled={loading || !selectedReviewReferral}
                      className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:bg-slate-300"
                    >
                      {reviewActionLoading === 'REQUEST_CHANGES' ? 'Sending...' : 'Request Changes'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab !== 'sla' && activeTab !== 'referrals' && (
          <div className="space-y-6 p-8">
            <div className="grid gap-4 md:grid-cols-5">
              <div className="rounded-2xl border bg-white p-4"><p className="text-xs font-semibold text-slate-500">TOTAL REFERRALS</p><p className="text-5xl font-bold text-slate-800">{metrics.total}</p></div>
              <div className="rounded-2xl border bg-white p-4"><p className="text-xs font-semibold text-slate-500">ACTIVE INTERNS</p><p className="text-5xl font-bold text-slate-800">{metrics.active}</p></div>
              <div className="rounded-2xl border border-amber-300 bg-white p-4"><p className="text-xs font-semibold text-slate-500">PENDING NDAS</p><p className="text-5xl font-bold text-amber-600">{metrics.pendingNdas}</p></div>
              <div className="rounded-2xl border border-rose-300 bg-white p-4"><p className="text-xs font-semibold text-slate-500">SLA BREACHES</p><p className="text-5xl font-bold text-rose-600">{metrics.breaches}</p></div>
              <div className="rounded-2xl border bg-white p-4"><p className="text-xs font-semibold text-slate-500">COMPLETION RATE</p><p className="text-5xl font-bold text-slate-800">{metrics.completionRate}%</p></div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <div className="rounded-2xl border bg-white p-5">
                <h3 className="text-2xl font-bold text-slate-800">Pipeline Stage Distribution</h3>
                <div className="mt-4 space-y-3">
                  {stageCount.map((stage, idx) => (
                    <div key={stage.label}>
                      <div className="mb-1 flex items-center justify-between text-sm text-slate-600"><span>{stage.label}</span><span>{stage.value}</span></div>
                      <div className="h-3 rounded bg-slate-100"><div className={`h-3 rounded ${idx === 5 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, metrics.total ? (stage.value / metrics.total) * 100 : 0)}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-white p-5">
                <h3 className="text-2xl font-bold text-slate-800">SLA Alerts</h3>
                <div className="mt-3 space-y-3">
                  {hrQueue.slice(0, 2).map((item) => (
                    <div key={item.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-semibold text-amber-800">{item.state}</p>
                      <p className="text-xs text-amber-700">Referral: {item.id.slice(0, 8)}</p>
                    </div>
                  ))}
                  {!hrQueue.length && <p className="text-sm text-slate-500">No active SLA alerts.</p>}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <div className="rounded-2xl border bg-white p-5">
                <div className="mb-3 flex items-center justify-between"><h3 className="text-2xl font-bold text-slate-800">Recent Activity</h3><button className="text-sm font-semibold text-indigo-600">View All</button></div>
                <div className="space-y-2 text-sm text-slate-700">
                  {referrals.slice(0, 5).map((r) => (
                    <div key={r.id} className="rounded-lg border border-slate-200 px-3 py-2">
                      Referral {r.id.slice(0, 8)} moved to {r.state}
                    </div>
                  ))}
                  {!referrals.length && <p className="text-sm text-slate-500">No activity to display.</p>}
                </div>
              </div>
              <div className="rounded-2xl border bg-white p-5">
                <h3 className="text-2xl font-bold text-slate-800">Quick Actions</h3>
                <div className="mt-3 space-y-2">
                  <button onClick={handleIssueNdaBatch} disabled={loading} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-left text-sm font-semibold text-slate-700">Issue NDA Batch</button>
                  <button onClick={handleAssignNonWorker} disabled={loading} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-left text-sm font-semibold text-slate-700">Assign Non-Worker IDs</button>
                  <button onClick={refreshAdminData} disabled={loading} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-left text-sm font-semibold text-slate-700">Review Eligibility</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sla' && (
          <div className="space-y-6 p-8">
            <div className="flex items-center justify-between rounded-2xl border bg-white p-4">
              <div>
                <h2 className="text-4xl font-bold text-slate-800">SLA & Compliance Monitor</h2>
                <p className="text-sm text-slate-500">Real-time governance metrics</p>
              </div>
              <div className="flex gap-2">
                <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm">This Week</button>
                <button className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">This Month</button>
                <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm">CSV</button>
                <button className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">PDF Report</button>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5">
              <h3 className="text-2xl font-bold text-slate-800">Service Level Agreements</h3>
              <div className="mt-4 overflow-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="text-sm text-slate-500">
                    <tr>
                      <th className="pb-2">SLA TYPE</th>
                      <th className="pb-2">TARGET</th>
                      <th className="pb-2">AVERAGE TIME</th>
                      <th className="pb-2">BREACHES</th>
                      <th className="pb-2">% ON-TIME</th>
                      <th className="pb-2">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-slate-700">
                    <tr className="border-t"><td className="py-3">Eligibility Verification</td><td>&lt; 24 hrs</td><td>18 hrs</td><td>0</td><td>100%</td><td><span className="rounded bg-emerald-100 px-2 py-1 text-emerald-700">On Track</span></td></tr>
                    <tr className="border-t"><td className="py-3">Non-Worker ID Provisioning</td><td>&lt; 48 hrs</td><td>42 hrs</td><td>2</td><td>85%</td><td><span className="rounded bg-amber-100 px-2 py-1 text-amber-700">At Risk</span></td></tr>
                    <tr className="border-t"><td className="py-3">NDA Signature Completion</td><td>&lt; 72 hrs</td><td>68 hrs</td><td>1</td><td>92%</td><td><span className="rounded bg-amber-100 px-2 py-1 text-amber-700">At Risk</span></td></tr>
                    <tr className="border-t"><td className="py-3">IT Equipment Setup</td><td>&lt; 5 days</td><td>6.2 days</td><td>4</td><td>78%</td><td><span className="rounded bg-rose-100 px-2 py-1 text-rose-700">Breached</span></td></tr>
                    <tr className="border-t"><td className="py-3">AD Deactivation (Offboarding)</td><td>&lt; 24 hrs</td><td>12 hrs</td><td>0</td><td>100%</td><td><span className="rounded bg-emerald-100 px-2 py-1 text-emerald-700">On Track</span></td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border bg-white p-5">
                <h4 className="text-xl font-bold text-slate-800">Avg Cycle Time</h4>
                <div className="mt-4 flex items-end gap-2">
                  {[70, 62, 74, 58, 54, 50, 45, 44].map((h, i) => <div key={i} className={`w-8 rounded-t ${i === 5 ? 'bg-indigo-500' : 'bg-slate-200'}`} style={{ height: `${h * 2}px` }} />)}
                </div>
              </div>
              <div className="rounded-2xl border bg-white p-5 text-center">
                <h4 className="text-xl font-bold text-slate-800">Completion</h4>
                <div className="mx-auto mt-5 flex h-40 w-40 items-center justify-center rounded-full border-[12px] border-indigo-500 text-4xl font-bold text-slate-800">{metrics.completionRate}%</div>
                <p className="mt-2 text-sm text-slate-500">Completed</p>
              </div>
              <div className="rounded-2xl border bg-white p-5">
                <h4 className="text-xl font-bold text-slate-800">Compliance</h4>
                <div className="mt-4 space-y-3 text-sm">
                  <div><div className="mb-1 flex justify-between"><span>NDA Pre-sign Rate</span><span>100%</span></div><div className="h-2 rounded bg-emerald-500" /></div>
                  <div><div className="mb-1 flex justify-between"><span>AD Deactivation (24h)</span><span>100%</span></div><div className="h-2 rounded bg-emerald-500" /></div>
                  <div><div className="mb-1 flex justify-between"><span>Data Retention Policy</span><span>85%</span></div><div className="h-2 rounded bg-amber-400" /></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && <div className="px-8 pb-8 text-sm text-slate-500">Refreshing admin data...</div>}
      </main>
    </div>
  )
}

export default ManagerDashboard
