import { useEffect, useMemo, useState } from 'react'

const EMPTY_JOINING_FORM = {
  personal_details: { name: '', email: '', date_of_birth: '', phone: '', gender: '', nationality: '' },
  address: { street: '', city: '', state: '', zip_code: '', country: '' },
  emergency_contact: { name: '', phone: '', relationship: '' },
  education_history: [],
  employment_history: [],
  government_ids: [],
  declarations_signed: true,
}

const NAV = [
  { id: 'status', label: 'My Status' },
  { id: 'documents', label: 'My Documents' },
  { id: 'nda', label: 'NDA' },
  { id: 'contact', label: 'Contact HR' },
]

const STEP_FLOW = ['Referral Submitted', 'Eligibility Confirmed', 'Joining Form', 'NDA Signed', 'ID Provisioned', 'Active']

function CandidateDashboard({ token, currentUser, setError, setMessage, onLogout }) {
  const [activeTab, setActiveTab] = useState('status')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [notice, setNotice] = useState({ type: '', text: '' })
  const [myReferrals, setMyReferrals] = useState([])
  const [selectedReferralId, setSelectedReferralId] = useState('')
  const [joiningForm, setJoiningForm] = useState(EMPTY_JOINING_FORM)
  const [nda, setNda] = useState(null)
  const [nonWorker, setNonWorker] = useState(null)
  const [certificate, setCertificate] = useState(null)
  const [governmentIdType, setGovernmentIdType] = useState('PAN Card')
  const [governmentIdNumber, setGovernmentIdNumber] = useState('')
  const [uploadedIdDoc, setUploadedIdDoc] = useState('')

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

  const selectedReferral = useMemo(() => myReferrals.find((item) => item.id === selectedReferralId) || null, [myReferrals, selectedReferralId])

  const stepIndex = useMemo(() => {
    const state = selectedReferral?.state || 'SUBMITTED'
    const map = {
      SUBMITTED: 1,
      ELIGIBILITY_PASSED: 2,
      JOINING_FORM_PENDING: 3,
      JOINING_FORM_SUBMITTED: 3,
      NDA_PENDING: 4,
      NDA_SIGNED: 4,
      NON_WORKER_ID_PENDING: 5,
      CREDENTIALS_GENERATED: 5,
      READY_TO_START: 6,
      IN_PROGRESS: 6,
      CLOSED: 6,
    }
    return map[state] || 1
  }, [selectedReferral])

  const refreshCandidateData = async () => {
    setLoading(true)
    setNotice({ type: '', text: '' })
    setError('')
    try {
      const list = await apiRequest('/referrals/me/candidate')
      const mine = list.items || []
      setMyReferrals(mine)
      const activeId = selectedReferralId || mine[0]?.id || ''
      setSelectedReferralId(activeId)
      if (!activeId) return
      await Promise.all([loadJoiningForm(activeId), loadNda(activeId), loadNonWorker(activeId), loadCertificate(activeId)])
    } catch (err) {
      setError(err.message)
      setNotice({ type: 'error', text: err.message || 'Failed to load candidate data' })
    } finally {
      setLoading(false)
    }
  }

  const loadJoiningForm = async (referralId) => {
    try {
      const form = await apiRequest(`/referrals/${referralId}/joining-form`)
      setJoiningForm({ ...EMPTY_JOINING_FORM, ...form })
    } catch {
      setJoiningForm(EMPTY_JOINING_FORM)
    }
  }

  const loadNda = async (referralId) => {
    try {
      const data = await apiRequest(`/referrals/${referralId}/nda`)
      setNda(data)
    } catch {
      setNda(null)
    }
  }

  const loadNonWorker = async (referralId) => {
    try {
      const data = await apiRequest(`/referrals/${referralId}/non-worker`)
      setNonWorker(data)
    } catch {
      setNonWorker(null)
    }
  }

  const loadCertificate = async (referralId) => {
    try {
      const data = await apiRequest(`/referrals/${referralId}/certificate`)
      setCertificate(data)
    } catch {
      setCertificate(null)
    }
  }

  useEffect(() => {
    refreshCandidateData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentUser?.id])

  const onReferralChange = async (event) => {
    const nextId = event.target.value
    setSelectedReferralId(nextId)
    if (!nextId) return
    await Promise.all([loadJoiningForm(nextId), loadNda(nextId), loadNonWorker(nextId), loadCertificate(nextId)])
  }

  const handleDraftSave = async () => {
    if (!selectedReferralId) return
    setActionLoading('draft')
    setNotice({ type: '', text: '' })
    try {
      const payload = {
        ...joiningForm,
        government_ids: governmentIdNumber ? [{ id_type: governmentIdType, id_number: governmentIdNumber, doc_name: uploadedIdDoc || null }] : joiningForm.government_ids,
      }
      await apiRequest(`/referrals/${selectedReferralId}/joining-form/draft`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setNotice({ type: 'success', text: 'Draft saved successfully' })
      setMessage('Draft saved')
      await loadJoiningForm(selectedReferralId)
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleSubmitForm = async () => {
    if (!selectedReferralId) return
    setActionLoading('submit')
    setNotice({ type: '', text: '' })
    try {
      const payload = {
        ...joiningForm,
        government_ids: governmentIdNumber ? [{ id_type: governmentIdType, id_number: governmentIdNumber, doc_name: uploadedIdDoc || null }] : joiningForm.government_ids,
      }
      await apiRequest(`/referrals/${selectedReferralId}/joining-form/submit`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setNotice({ type: 'success', text: 'Joining form submitted for HR review' })
      setMessage('Joining form submitted')
      await refreshCandidateData()
      setActiveTab('status')
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleSignNda = async () => {
    if (!selectedReferralId) return
    setActionLoading('sign-nda')
    setNotice({ type: '', text: '' })
    try {
      await apiRequest(`/referrals/${selectedReferralId}/nda/sign`, { method: 'POST', body: JSON.stringify({}) })
      setNotice({ type: 'success', text: 'NDA signed successfully' })
      setMessage('NDA signed')
      await refreshCandidateData()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  return (
    <div className="flex min-h-screen overflow-hidden rounded-none border-none bg-white shadow-none">
      <aside className="flex w-64 flex-col bg-[#07153a] text-white">
        <div className="border-b border-white/10 p-6">
          <p className="text-3xl font-bold tracking-tight text-indigo-300">Intern Flow</p>
          <p className="mt-1 text-sm text-slate-300">CANDIDATE PORTAL</p>
        </div>
        <nav className="space-y-1 p-4">
          {NAV.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full rounded-lg px-3 py-3 text-left text-lg font-semibold ${activeTab === item.id ? 'bg-indigo-700/30 text-indigo-300' : 'text-slate-200 hover:bg-white/10'}`}>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/10 p-4">
          <div className="text-sm text-slate-300">
            <p className="font-semibold text-white">{currentUser?.full_name || 'Candidate'}</p>
            <p>Candidate</p>
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
          <h1 className="text-4xl font-bold text-slate-800">Hello, {currentUser?.full_name || 'Candidate'}</h1>
          <p className="mt-1 text-xl text-slate-500">Software Engineering Intern — Technology</p>
          <div className="mt-3 w-80">
            <select value={selectedReferralId} onChange={onReferralChange} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select referral</option>
              {myReferrals.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.state}</option>)}
            </select>
          </div>
        </header>

        {notice.text && (
          <div className={`mx-8 mt-5 rounded-lg border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {notice.text}
          </div>
        )}

        {activeTab === 'status' && (
          <div className="space-y-6 p-8">
            <div className="rounded-2xl border border-indigo-200 bg-white p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-3xl font-bold text-slate-800">Action Required</p>
                  <p className="text-lg text-slate-500">Please complete your Joining Form to proceed with onboarding.</p>
                </div>
                <button onClick={() => setActiveTab('documents')} className="rounded-lg bg-indigo-600 px-6 py-3 text-lg font-semibold text-white hover:bg-indigo-500">Complete Form</button>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-6">
              <h3 className="text-3xl font-bold text-slate-800">Internship Journey</h3>
              <div className="mt-6 grid grid-cols-6 gap-2">
                {STEP_FLOW.map((label, index) => {
                  const step = index + 1
                  const active = step <= stepIndex
                  return (
                    <div key={label} className="text-center">
                      <div className={`mx-auto mb-2 h-9 w-9 rounded-full border-2 ${active ? 'border-indigo-500 bg-indigo-100 text-indigo-700' : 'border-slate-300 bg-white text-slate-400'} flex items-center justify-center text-xs font-semibold`}>
                        {step}
                      </div>
                      <p className={`text-xs font-semibold ${active ? 'text-indigo-700' : 'text-slate-500'}`}>{label}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <div className="rounded-2xl border bg-white p-6">
                <h4 className="mb-4 text-xl font-bold text-slate-700">Upcoming Milestones</h4>
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 p-4"><p className="font-semibold text-slate-800">Internship Start Date</p><p className="text-sm text-slate-500">Report to Bangalore Office at 9:00 AM IST.</p></div>
                  <div className="rounded-xl border border-slate-200 p-4"><p className="font-semibold text-slate-800">Mentor Introduction Call</p><p className="text-sm text-slate-500">Virtual meet and greet with your assigned mentor.</p></div>
                </div>
              </div>
              <div className="rounded-2xl border bg-white p-6">
                <h4 className="mb-3 text-xl font-bold text-slate-700">Your Mentor</h4>
                <div className="rounded-full bg-indigo-100 p-4 text-center text-2xl font-bold text-indigo-700">PS</div>
                <p className="mt-3 text-xl font-bold text-slate-800">Priya Sharma</p>
                <p className="text-sm text-slate-500">Senior Staff Engineer</p>
                <button className="mt-4 w-full rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700">Send Message</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-6 p-8">
            <div className="rounded-2xl border bg-white p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-4xl font-bold text-slate-800">Joining Form</h3>
                <button onClick={handleDraftSave} disabled={actionLoading === 'draft'} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">{actionLoading === 'draft' ? 'Saving...' : 'Save Draft'}</button>
              </div>
              <p className="mt-2 text-sm text-slate-500">Step 3 of 5 • Government IDs & Education</p>
            </div>

            <div className="rounded-2xl border bg-white p-6">
              <h4 className="text-3xl font-bold text-slate-800">Government IDs & Education</h4>
              <p className="mt-1 text-lg text-slate-500">Please provide details as per your official documents.</p>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="font-semibold text-slate-700">Non-Worker ID</p>
                <p className="text-2xl font-bold text-slate-800">{nonWorker?.generated_non_worker_id || 'NW-9843-INT'}</p>
                <p className="text-sm text-slate-500">This ID is auto-assigned and will be used for your system access provisioning.</p>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">ID Type</label>
                  <input value={governmentIdType} onChange={(e) => setGovernmentIdType(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">ID Number</label>
                  <input value={governmentIdNumber} onChange={(e) => setGovernmentIdNumber(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="XXXX-XXXX-1234" />
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-dashed border-indigo-200 bg-slate-50 p-8 text-center">
                <p className="text-sm text-slate-600">Click to upload or drag and drop</p>
                <input type="file" className="mx-auto mt-3 text-sm" onChange={(e) => setUploadedIdDoc(e.target.files?.[0]?.name || '')} />
                {uploadedIdDoc && <p className="mt-3 text-xs font-semibold text-emerald-700">{uploadedIdDoc} uploaded</p>}
              </div>

              <div className="mt-5 flex items-center justify-end gap-3">
                <button onClick={handleDraftSave} disabled={actionLoading === 'draft'} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">{actionLoading === 'draft' ? 'Saving...' : 'Save Draft'}</button>
                <button onClick={handleSubmitForm} disabled={actionLoading === 'submit'} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white">{actionLoading === 'submit' ? 'Submitting...' : 'Submit Form'}</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'nda' && (
          <div className="space-y-4 p-8">
            <div className="rounded-2xl border bg-white p-6">
              <h3 className="text-3xl font-bold text-slate-800">NDA</h3>
              <p className="mt-1 text-sm text-slate-500">Review and sign your NDA to continue onboarding.</p>
              <div className="mt-4 text-sm text-slate-600">Status: <span className="font-semibold">{nda?.status || 'Pending'}</span></div>
              <button onClick={handleSignNda} disabled={actionLoading === 'sign-nda'} className="mt-4 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white">{actionLoading === 'sign-nda' ? 'Signing...' : 'Sign NDA'}</button>
            </div>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="space-y-4 p-8">
            <div className="rounded-2xl border bg-white p-6">
              <h3 className="text-3xl font-bold text-slate-800">Contact HR</h3>
              <p className="mt-2 text-sm text-slate-600">Need help with your internship onboarding?</p>
              <p className="mt-3 text-sm text-slate-700">Email: hr.support@hexaware.com</p>
              <p className="text-sm text-slate-700">Phone: +91 80 4000 1234</p>
              <p className="mt-3 text-sm text-slate-700">Certificate status: {certificate?.status || 'Not started'}</p>
            </div>
          </div>
        )}

        {loading && <div className="px-8 pb-8 text-sm text-slate-500">Loading candidate data...</div>}
      </main>
    </div>
  )
}

export default CandidateDashboard
