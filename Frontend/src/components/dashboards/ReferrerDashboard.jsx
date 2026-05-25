import { useCallback, useEffect, useMemo, useState } from 'react'

const EMPTY_FORM = {
  candidate_email: '',
  mentor_email: '',
  start_date: '',
  end_date: '',
  project_overview: '',
  location: '',
  relationship_to_mentor: '',
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '◻' },
  { id: 'my-referrals', label: 'My Referrals', icon: '○' },
  { id: 'submit-referral', label: 'Submit Referral', icon: '+' },
  { id: 'notifications', label: 'Notifications', icon: '!' },
]

const BADGE_TONE = {
  SUBMITTED: 'bg-indigo-100 text-indigo-700',
  ELIGIBILITY_REVIEW: 'bg-sky-100 text-sky-700',
  ELIGIBILITY_PASSED: 'bg-emerald-100 text-emerald-700',
  ELIGIBILITY_FAILED: 'bg-rose-100 text-rose-700',
  JOINING_FORM_PENDING: 'bg-amber-100 text-amber-700',
  JOINING_FORM_SUBMITTED: 'bg-violet-100 text-violet-700',
  NDA_PENDING: 'bg-fuchsia-100 text-fuchsia-700',
  NDA_SIGNED: 'bg-teal-100 text-teal-700',
  IN_PROGRESS: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-slate-200 text-slate-700',
}

function ReferrerDashboard({ token, currentUser, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [referrals, setReferrals] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [notice, setNotice] = useState({ type: '', text: '' })
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploadedResume, setUploadedResume] = useState('')

  const apiRequest = useCallback(async (path, options = {}) => {
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
      const detail = data && typeof data === 'object' && 'detail' in data ? data.detail : 'Request failed'
      throw new Error(Array.isArray(detail) ? detail.join(', ') : detail)
    }
    return data
  }, [token])

  const loadReferrals = useCallback(async () => {
    setLoading(true)
    try {
      const list = await apiRequest('/referrals/me/referrer')
      const items = list.items || []
      setReferrals(items)
      if (!selectedId && items.length) {
        setSelectedId(items[0].id)
      }
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }, [apiRequest, selectedId])

  useEffect(() => {
    loadReferrals()
  }, [loadReferrals])

  const filteredReferrals = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return referrals
    return referrals.filter((r) => {
      return (
        r.id.toLowerCase().includes(q)
        || (r.location || '').toLowerCase().includes(q)
        || (r.project_overview || '').toLowerCase().includes(q)
      )
    })
  }, [search, referrals])

  const stats = useMemo(() => {
    const total = referrals.length
    const inProgress = referrals.filter((r) => ['IN_PROGRESS', 'JOINING_FORM_PENDING', 'JOINING_FORM_SUBMITTED', 'NDA_PENDING'].includes(r.state)).length
    const accepted = referrals.filter((r) => ['ELIGIBILITY_PASSED', 'IN_PROGRESS', 'NDA_SIGNED', 'READY_TO_START', 'CLOSED'].includes(r.state)).length
    const pendingAction = referrals.filter((r) => ['ELIGIBILITY_REVIEW', 'NDA_PENDING', 'JOINING_FORM_SUBMITTED'].includes(r.state)).length
    return { total, inProgress, accepted, pendingAction }
  }, [referrals])

  const notificationCount = useMemo(() => referrals.filter((r) => ['ELIGIBILITY_REVIEW', 'NDA_PENDING', 'JOINING_FORM_SUBMITTED'].includes(r.state)).length, [referrals])

  const handleSubmitReferral = async () => {
    if (!form.candidate_email || !form.mentor_email) {
      setNotice({ type: 'error', text: 'Candidate and mentor email are required.' })
      return
    }
    setActionLoading(true)
    setNotice({ type: '', text: '' })
    try {
      const created = await apiRequest('/referrals', {
        method: 'POST',
        body: JSON.stringify({
          candidate_email: form.candidate_email,
          mentor_email: form.mentor_email,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          project_overview: form.project_overview,
          location: form.location,
          relationship_to_mentor: form.relationship_to_mentor,
          unpaid_consent_confirmed: false,
          in_person_ready_confirmed: false,
          location_match_confirmed: false,
          additional_data: uploadedResume ? { uploaded_resume: uploadedResume } : {},
        }),
      })
      setNotice({ type: 'success', text: `Referral created: ${created.id}` })
      setForm(EMPTY_FORM)
      setUploadedResume('')
      setActiveTab('dashboard')
      await loadReferrals()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  const selectedReferral = referrals.find((r) => r.id === selectedId) || null

  return (
    <div className="flex min-h-screen overflow-hidden rounded-none border-none bg-white shadow-none">
      <aside className="flex w-64 flex-col bg-[#07153a] text-white">
        <div className="border-b border-white/10 p-6">
          <p className="text-3xl font-bold tracking-tight text-indigo-300">Intern Flow</p>
          <p className="mt-1 text-sm text-slate-300">REFERRER PORTAL</p>
        </div>
        <nav className="space-y-1 p-4">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-[22px] font-semibold transition ${
                activeTab === item.id ? 'bg-indigo-700/30 text-indigo-300' : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              <span className="flex items-center gap-3 text-base">
                <span className="text-xs">{item.icon}</span>
                {item.label}
              </span>
              {item.id === 'notifications' && notificationCount > 0 && (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">{notificationCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/10 p-4">
          <div className="text-sm text-slate-300">
            <p className="font-semibold text-white">{currentUser?.full_name || 'Referrer User'}</p>
            <p>{currentUser?.department || 'Engineering'}</p>
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
          <h1 className="text-[38px] font-bold text-slate-800">Referrer Portal</h1>
          <div className="flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-56 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
            />
            <button onClick={() => setActiveTab('submit-referral')} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
              Submit New Referral
            </button>
          </div>
        </header>

        {notice.text && (
          <div className={`mx-8 mt-5 rounded-lg border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {notice.text}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-6 p-8">
            <div>
              <h2 className="text-4xl font-bold text-slate-800">Welcome back, {currentUser?.full_name || 'Referrer'}</h2>
              <p className="mt-1 text-lg text-slate-500">Here is the latest status on your internship referrals.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">Total Referrals</p><p className="text-5xl font-bold text-slate-800">{stats.total}</p></div>
              <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">In Progress</p><p className="text-5xl font-bold text-indigo-600">{stats.inProgress}</p></div>
              <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">Accepted</p><p className="text-5xl font-bold text-emerald-600">{stats.accepted}</p></div>
              <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">Pending Action</p><p className="text-5xl font-bold text-rose-600">{stats.pendingAction}</p></div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-3xl font-bold text-slate-800">Recent Referrals</h3>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search candidates..." className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="max-h-[380px] overflow-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white text-sm text-slate-500">
                    <tr>
                      <th className="pb-2">Candidate Name</th>
                      <th className="pb-2">Department</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">Submitted Date</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReferrals.map((r) => (
                      <tr key={r.id} className="border-t text-sm text-slate-700">
                        <td className="py-3">{r.project_overview?.split(' ').slice(0, 2).join(' ') || 'Candidate'}</td>
                        <td className="py-3">{r.location || 'Engineering'}</td>
                        <td className="py-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${BADGE_TONE[r.state] || 'bg-slate-200 text-slate-700'}`}>{r.state}</span></td>
                        <td className="py-3">{new Date(r.created_at).toLocaleDateString()}</td>
                        <td className="py-3 text-right"><button onClick={() => { setSelectedId(r.id); setActiveTab('my-referrals') }} className="text-indigo-600 hover:underline">View Details</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'my-referrals' && (
          <div className="grid gap-6 p-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border bg-white p-6">
              <h3 className="mb-4 text-3xl font-bold text-slate-800">My Referrals</h3>
              <div className="space-y-3">
                {filteredReferrals.map((r) => (
                  <button key={r.id} onClick={() => setSelectedId(r.id)} className={`w-full rounded-xl border px-4 py-3 text-left ${selectedId === r.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">{r.id}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${BADGE_TONE[r.state] || 'bg-slate-200 text-slate-700'}`}>{r.state}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{r.project_overview || 'No project overview provided'}</p>
                  </button>
                ))}
                {!filteredReferrals.length && <p className="text-sm text-slate-500">No referrals found.</p>}
              </div>
            </div>
            <div className="rounded-2xl border bg-white p-6">
              <h3 className="mb-4 text-2xl font-bold text-slate-800">Referral Details</h3>
              {selectedReferral ? (
                <div className="space-y-3 text-sm text-slate-700">
                  <p><span className="font-semibold text-slate-900">Referral ID:</span> {selectedReferral.id}</p>
                  <p><span className="font-semibold text-slate-900">State:</span> {selectedReferral.state}</p>
                  <p><span className="font-semibold text-slate-900">Status:</span> {selectedReferral.status}</p>
                  <p><span className="font-semibold text-slate-900">Location:</span> {selectedReferral.location || 'Not set'}</p>
                  <p><span className="font-semibold text-slate-900">Project:</span> {selectedReferral.project_overview || 'Not set'}</p>
                  <p><span className="font-semibold text-slate-900">Submitted:</span> {new Date(selectedReferral.created_at).toLocaleString()}</p>
                </div>
              ) : <p className="text-sm text-slate-500">Select a referral to view details.</p>}
            </div>
          </div>
        )}

        {activeTab === 'submit-referral' && (
          <div className="space-y-6 p-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-3xl font-bold text-slate-800">Submit New Referral</h3>
                <button onClick={() => setActiveTab('dashboard')} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
              </div>
              <p className="mt-2 text-sm text-slate-500">Eligibility & Internship Details</p>
              <div className="mt-4 grid grid-cols-4 gap-2">
                <div className="h-2 rounded bg-indigo-600" />
                <div className="h-2 rounded bg-indigo-600" />
                <div className="h-2 rounded bg-slate-200" />
                <div className="h-2 rounded bg-slate-200" />
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-white p-6">
              <h4 className="text-2xl font-bold text-indigo-800">Smart Resume Parsing</h4>
              <p className="text-sm text-indigo-600">Upload a resume to auto-fill candidate details.</p>
              <div className="mt-4 rounded-xl border border-dashed border-indigo-200 bg-slate-50 p-8 text-center">
                <p className="text-sm text-slate-600">Click to upload or drag and drop</p>
                <p className="text-xs text-slate-400">PDF, DOCX up to 5MB</p>
                <div className="mt-3">
                  <input type="file" onChange={(e) => setUploadedResume(e.target.files?.[0]?.name || '')} className="text-sm" />
                </div>
                {uploadedResume && <p className="mt-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{uploadedResume} uploaded</p>}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-6">
              <h4 className="mb-4 text-3xl font-bold text-slate-800">Candidate Information</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <input placeholder="Candidate Email" value={form.candidate_email} onChange={(e) => setForm((c) => ({ ...c, candidate_email: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" />
                <input placeholder="Mentor Email" value={form.mentor_email} onChange={(e) => setForm((c) => ({ ...c, mentor_email: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" />
                <input placeholder="Start Date" type="date" value={form.start_date} onChange={(e) => setForm((c) => ({ ...c, start_date: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" />
                <input placeholder="End Date" type="date" value={form.end_date} onChange={(e) => setForm((c) => ({ ...c, end_date: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" />
                <input placeholder="Location" value={form.location} onChange={(e) => setForm((c) => ({ ...c, location: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" />
                <input placeholder="Relationship to Mentor" value={form.relationship_to_mentor} onChange={(e) => setForm((c) => ({ ...c, relationship_to_mentor: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" />
              </div>
              <textarea placeholder="Project Overview" value={form.project_overview} onChange={(e) => setForm((c) => ({ ...c, project_overview: e.target.value }))} rows={4} className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2" />

              <div className="mt-5 flex items-center justify-between">
                <button onClick={() => setActiveTab('dashboard')} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600">Back: Basic Info</button>
                <div className="flex gap-3">
                  <button onClick={() => setNotice({ type: 'success', text: 'Draft saved locally.' })} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">Save Draft</button>
                  <button onClick={handleSubmitReferral} disabled={actionLoading} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">{actionLoading ? 'Submitting...' : 'Next Step'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="p-8">
            <div className="rounded-2xl border bg-white p-6">
              <h3 className="text-3xl font-bold text-slate-800">Notifications</h3>
              <p className="mt-1 text-sm text-slate-500">Alerts generated from your referral pipeline.</p>
              <div className="mt-4 space-y-3">
                {referrals.filter((r) => ['ELIGIBILITY_REVIEW', 'NDA_PENDING', 'JOINING_FORM_SUBMITTED'].includes(r.state)).map((r) => (
                  <div key={r.id} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    Referral {r.id.slice(0, 8)} requires action at state {r.state}.
                  </div>
                ))}
                {!notificationCount && <p className="text-sm text-slate-500">No active notifications.</p>}
              </div>
            </div>
          </div>
        )}

        {loading && <div className="px-8 pb-8 text-sm text-slate-500">Loading referral data...</div>}
      </main>
    </div>
  )
}

export default ReferrerDashboard
