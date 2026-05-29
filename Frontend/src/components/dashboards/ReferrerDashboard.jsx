import { useCallback, useEffect, useMemo, useState } from 'react'

const EMPTY_FORM = {
  candidate_name: '',
  candidate_email: '',
  candidate_phone: '',
  current_city: '',
  internship_title: '',
  department_function: '',
  internship_location: '',
  mentor_name: '',
  mentor_employee_id: '',
  mentor_email: '',
  mentor_department: '',
  start_date: '',
  end_date: '',
  project_title: '',
  project_description: '',
  expected_deliverables: '',
  technologies_skills_required: '',
  business_justification: '',
  skills_match_rating: '',
  candidate_strengths: '',
  suitability_reason: '',
  additional_comments: '',
  unpaid_internship_acknowledged: false,
  available_during_internship: false,
  willing_for_specified_location: false,
  can_dedicate_required_hours: false,
  relationship_with_candidate: '',
  relationship_additional_explanation: '',
  project_overview: '',
  relationship_to_mentor: '',
  college: '',
  degree: '',
  specialization_branch: '',
  expected_graduation_date: '',
  linkedin_url: '',
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

function formatApiDetail(detail) {
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') {
          if (typeof item.msg === 'string') return item.msg
          if (typeof item.message === 'string') return item.message
          return JSON.stringify(item)
        }
        return String(item)
      })
      .join(', ')
  }

  if (detail && typeof detail === 'object') {
    if (typeof detail.msg === 'string') return detail.msg
    if (typeof detail.message === 'string') return detail.message
    return JSON.stringify(detail)
  }

  return detail || 'Request failed'
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
  const [uploadedResumeMeta, setUploadedResumeMeta] = useState({
    resume_url: '',
    parsed_resume_data: null,
    confidence_score: null,
  })
  const [resumeParsing, setResumeParsing] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)

  const apiRequest = useCallback(async (path, options = {}) => {
    const headers = {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(`/api/v1${path}`, {
      ...options,
      headers,
    })
    const text = await response.text()
    const data = text ? JSON.parse(text) : null
    if (!response.ok) {
      const detail = data && typeof data === 'object' && 'detail' in data ? data.detail : 'Request failed'
      throw new Error(formatApiDetail(detail))
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

  useEffect(() => {
    if (notice.type !== 'success' || !notice.text) {
      return undefined
    }

    const timer = setTimeout(() => {
      setNotice({ type: '', text: '' })
    }, 3000)

    return () => clearTimeout(timer)
  }, [notice])

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

  const internshipDuration = useMemo(() => {
    if (!form.start_date || !form.end_date) {
      return ''
    }

    const start = new Date(form.start_date)
    const end = new Date(form.end_date)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return ''
    }

    const diffInMs = end - start
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24)) + 1
    const weeks = (diffInDays / 7).toFixed(1)

    return `${diffInDays} days (${weeks} weeks)`
  }, [form.start_date, form.end_date])

  const handleSubmitReferral = async () => {
    if (
      !form.candidate_name
      || !form.candidate_email
      || !form.candidate_phone
      || !form.current_city
      || !form.internship_title
      || !form.department_function
      || !form.mentor_name
      || !form.mentor_employee_id
      || !form.mentor_email
      || !form.mentor_department
      || !form.start_date
      || !form.end_date
      || !form.internship_location
      || !form.project_title
      || !form.project_description
      || !form.expected_deliverables
      || !form.technologies_skills_required
      || !form.business_justification
      || !form.unpaid_internship_acknowledged
      || !form.available_during_internship
      || !form.willing_for_specified_location
      || !form.can_dedicate_required_hours
      || !form.relationship_with_candidate
      || !form.college
      || !form.degree
      || !form.specialization_branch
      || !form.expected_graduation_date
    ) {
      setNotice({ type: 'error', text: 'Please fill all required candidate details.' })
      return
    }
    setActionLoading(true)
    setNotice({ type: '', text: '' })
    try {
      await apiRequest('/referrals', {
        method: 'POST',
        body: JSON.stringify({
          candidate_email: form.candidate_email,
          mentor_email: form.mentor_email,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          project_overview: form.project_description || form.project_title || form.project_overview || form.internship_title,
          location: form.internship_location,
          relationship_to_mentor: form.relationship_with_candidate,
          unpaid_consent_confirmed: form.unpaid_internship_acknowledged,
          in_person_ready_confirmed: form.available_during_internship,
          location_match_confirmed: form.willing_for_specified_location,
          additional_data: {
            candidate_details: {
              name: form.candidate_name,
              email: form.candidate_email,
              phone: form.candidate_phone,
              current_city: form.current_city,
              education: {
                college: form.college,
                degree: form.degree,
                specialization_branch: form.specialization_branch,
                expected_graduation_date: form.expected_graduation_date,
              },
              links: {
                linkedin: form.linkedin_url,
              },
            },
            internship_details: {
              internship_title: form.internship_title,
              department_function: form.department_function,
              internship_start_date: form.start_date,
              internship_end_date: form.end_date,
              duration: internshipDuration,
              location: form.internship_location,
            },
            mentor_details: {
              mentor_name: form.mentor_name,
              mentor_employee_id: form.mentor_employee_id,
              mentor_email: form.mentor_email,
              mentor_department: form.mentor_department,
            },
            project_information: {
              project_title: form.project_title,
              project_description: form.project_description,
              expected_deliverables: form.expected_deliverables,
              technologies_skills_required: form.technologies_skills_required,
              business_justification: form.business_justification,
            },
            candidate_evaluation: {
              skills_match: {
                suitability_rating: form.skills_match_rating,
              },
              candidate_strengths: form.candidate_strengths,
              suitability_reason: form.suitability_reason,
              additional_comments: form.additional_comments,
            },
            eligibility_confirmation: {
              candidate_understands_unpaid_internship: form.unpaid_internship_acknowledged,
              candidate_available_during_internship_period: form.available_during_internship,
              candidate_willing_for_specified_location: form.willing_for_specified_location,
              candidate_can_dedicate_required_hours: form.can_dedicate_required_hours,
            },
            referrer_declaration: {
              relationship_with_candidate: form.relationship_with_candidate,
              additional_explanation: form.relationship_additional_explanation,
            },
            referrer_information: {
              referrer_name: currentUser?.full_name || '',
              employee_id: currentUser?.employee_id || currentUser?.id || '',
              department: currentUser?.department || '',
              email: currentUser?.email || '',
            },
            ...(uploadedResume ? { uploaded_resume_file_name: uploadedResume } : {}),
            ...(uploadedResumeMeta.resume_url ? { uploaded_resume_url: uploadedResumeMeta.resume_url } : {}),
            ...(uploadedResumeMeta.parsed_resume_data ? { parsed_resume_data: uploadedResumeMeta.parsed_resume_data } : {}),
            ...(uploadedResumeMeta.confidence_score !== null ? { resume_parse_confidence: uploadedResumeMeta.confidence_score } : {}),
          },
        }),
      })
      const candidateName = form.candidate_name.trim() || 'Candidate'
      setNotice({ type: 'success', text: `You have referred ${candidateName}` })
      setForm(EMPTY_FORM)
      setUploadedResume('')
      setUploadedResumeMeta({ resume_url: '', parsed_resume_data: null, confidence_score: null })
      setCurrentStep(1)
      setActiveTab('dashboard')
      await loadReferrals()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  const handleResumeUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadedResume(file.name)
    setResumeParsing(true)
    setNotice({ type: '', text: '' })

    try {
      const formData = new FormData()
      formData.append('resume', file)

      const parsed = await apiRequest('/referrals/parse-resume', {
        method: 'POST',
        body: formData,
      })

      setUploadedResumeMeta({
        resume_url: parsed.resume_url || '',
        parsed_resume_data: parsed.parsed_resume_data || null,
        confidence_score: Number.isFinite(parsed.confidence_score) ? parsed.confidence_score : null,
      })

      setForm((current) => ({
        ...current,
        candidate_name: current.candidate_name || parsed.autofill_data?.candidate_name || '',
        candidate_email: current.candidate_email || parsed.autofill_data?.candidate_email || '',
        candidate_phone: current.candidate_phone || parsed.autofill_data?.candidate_phone || '',
        linkedin_url: current.linkedin_url || parsed.autofill_data?.linkedin_url || '',
        degree: current.degree || parsed.autofill_data?.degree || '',
      }))

      const confidence = Number.isFinite(parsed.confidence_score)
        ? `${Math.round(parsed.confidence_score * 100)}%`
        : 'N/A'
      setNotice({ type: 'success', text: `Resume parsed successfully. Autofill confidence: ${confidence}.` })
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Resume parsing failed.' })
    } finally {
      setResumeParsing(false)
      event.target.value = ''
    }
  }

  const selectedReferral = referrals.find((r) => r.id === selectedId) || null

  const getCandidateName = (referral) => {
    return (
      referral?.additional_data?.candidate_details?.name
      || referral?.candidate_name
      || referral?.candidate_email?.split('@')?.[0]
      || 'Candidate'
    )
  }

  const getDepartmentName = (referral) => {
    return (
      referral?.additional_data?.internship_details?.department_function
      || referral?.department_function
      || referral?.additional_data?.mentor_details?.mentor_department
      || referral?.mentor_department
      || 'Engineering'
    )
  }

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
              className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-[22px] font-semibold transition ${activeTab === item.id ? 'bg-indigo-700/30 text-indigo-300' : 'text-slate-200 hover:bg-white/10'
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
                        <td className="py-3">{getCandidateName(r)}</td>
                        <td className="py-3">{getDepartmentName(r)}</td>
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
                      <p className="text-sm font-semibold text-slate-800">{getCandidateName(r)}</p>
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
                <button onClick={() => { setActiveTab('dashboard'); setCurrentStep(1); }} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Step {currentStep} of 3: {currentStep === 1 ? 'Submit Resume' : currentStep === 2 ? 'Candidate & Internship Details' : 'Final Review & Submission'}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[1, 2, 3].map((step) => (
                  <div key={step} className={`h-2 rounded ${currentStep >= step ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                ))}
              </div>
            </div>

            {currentStep === 1 && (
              <div className="rounded-2xl border border-indigo-100 bg-white p-6">
                <h4 className="text-2xl font-bold text-indigo-800">Smart Resume Parsing</h4>
                <p className="text-sm text-indigo-600">Upload a resume to auto-fill candidate details.</p>
                <div className="mt-4 rounded-xl border border-dashed border-indigo-200 bg-slate-50 p-8 text-center">
                  <p className="text-sm text-slate-600">Click to upload or drag and drop</p>
                  <p className="text-xs text-slate-400">PDF, DOCX up to 5MB</p>
                  <div className="mt-3">
                    <input
                      id="resume-upload"
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={handleResumeUpload}
                      className="hidden"
                    />
                    <label htmlFor="resume-upload" className="inline-flex cursor-pointer items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
                      Upload Resume
                    </label>
                  </div>
                  {uploadedResume && <p className="mt-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{uploadedResume} uploaded</p>}
                  {resumeParsing && <p className="mt-2 text-xs font-semibold text-indigo-600">Parsing resume...</p>}
                  {!resumeParsing && uploadedResumeMeta.confidence_score !== null && (
                    <p className="mt-2 text-xs font-semibold text-slate-600">Autofill confidence: {Math.round(uploadedResumeMeta.confidence_score * 100)}%</p>
                  )}
                </div>
                <div className="mt-5 flex items-center justify-end gap-3">
                  <button onClick={() => setNotice({ type: 'success', text: 'Draft saved locally.' })} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">Save Draft</button>
                  <button onClick={() => setCurrentStep(2)} disabled={actionLoading} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">{actionLoading ? 'Proceeding...' : 'Next Step'}</button>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="rounded-2xl border bg-white p-6">
                <h4 className="mb-4 text-3xl font-bold text-slate-800">Candidate & Internship Details</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <input placeholder="Candidate Full Name *" value={form.candidate_name} onChange={(e) => setForm((c) => ({ ...c, candidate_name: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" required />
                  <input placeholder="Email Address *" type="email" value={form.candidate_email} onChange={(e) => setForm((c) => ({ ...c, candidate_email: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" required />
                  <input placeholder="Mobile Number *" value={form.candidate_phone} onChange={(e) => setForm((c) => ({ ...c, candidate_phone: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" required />
                  <input placeholder="Current City *" value={form.current_city} onChange={(e) => setForm((c) => ({ ...c, current_city: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" required />
                  <input placeholder="LinkedIn Profile (Optional)" value={form.linkedin_url} onChange={(e) => setForm((c) => ({ ...c, linkedin_url: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" />
                  <input placeholder="College/University *" value={form.college} onChange={(e) => setForm((c) => ({ ...c, college: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" required />
                  <input placeholder="Degree *" value={form.degree} onChange={(e) => setForm((c) => ({ ...c, degree: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" required />
                  <input placeholder="Specialization/Branch *" value={form.specialization_branch} onChange={(e) => setForm((c) => ({ ...c, specialization_branch: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" required />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-600">Expected Graduation Date *</p>
                    <input placeholder="Expected Graduation Date" type="date" value={form.expected_graduation_date} onChange={(e) => setForm((c) => ({ ...c, expected_graduation_date: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" required />
                  </div>
                </div>

                <h5 className="mt-6 text-xl font-bold text-slate-800">Section 2: Internship Details</h5>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <input placeholder="Internship Title *" value={form.internship_title} onChange={(e) => setForm((c) => ({ ...c, internship_title: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" required />
                  <input placeholder="Department/Function *" value={form.department_function} onChange={(e) => setForm((c) => ({ ...c, department_function: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" required />
                  <input placeholder="Internship Start Date *" type="date" value={form.start_date} onChange={(e) => setForm((c) => ({ ...c, start_date: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" required />
                  <input placeholder="Internship End Date *" type="date" value={form.end_date} onChange={(e) => setForm((c) => ({ ...c, end_date: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" required />
                  <input placeholder="Duration (Auto-calculated)" value={internshipDuration} className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-600" readOnly />
                  <select value={form.internship_location} onChange={(e) => setForm((c) => ({ ...c, internship_location: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" required>
                    <option value="">Location *</option>
                    <option value="Jaipur">Jaipur</option>
                    <option value="Bangalore">Bangalore</option>
                    <option value="Chennai">Chennai</option>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Remote">Remote (if allowed)</option>
                  </select>
                </div>

                <h5 className="mt-6 text-xl font-bold text-slate-800">Section 3: Mentor Information</h5>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <input placeholder="Mentor Name *" value={form.mentor_name} onChange={(e) => setForm((c) => ({ ...c, mentor_name: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" required />
                  <input placeholder="Mentor Employee ID *" value={form.mentor_employee_id} onChange={(e) => setForm((c) => ({ ...c, mentor_employee_id: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" required />
                  <input placeholder="Mentor Email *" type="email" value={form.mentor_email} onChange={(e) => setForm((c) => ({ ...c, mentor_email: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" required />
                  <input placeholder="Mentor Department *" value={form.mentor_department} onChange={(e) => setForm((c) => ({ ...c, mentor_department: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" required />
                </div>

                <h5 className="mt-6 text-xl font-bold text-slate-800">Section 4: Project Information</h5>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <input placeholder="Project Title *" value={form.project_title} onChange={(e) => setForm((c) => ({ ...c, project_title: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" required />
                  <input placeholder="Technologies/Skills Required *" value={form.technologies_skills_required} onChange={(e) => setForm((c) => ({ ...c, technologies_skills_required: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" required />
                </div>

                <textarea placeholder="Project Description *" value={form.project_description} onChange={(e) => setForm((c) => ({ ...c, project_description: e.target.value }))} rows={4} className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2" required />
                <textarea placeholder="Expected Deliverables *" value={form.expected_deliverables} onChange={(e) => setForm((c) => ({ ...c, expected_deliverables: e.target.value }))} rows={4} className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2" required />
                <textarea placeholder="Business Justification *" value={form.business_justification} onChange={(e) => setForm((c) => ({ ...c, business_justification: e.target.value }))} rows={4} className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2" required />

                <h5 className="mt-6 text-xl font-bold text-slate-800">Section 5: Candidate Evaluation</h5>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-sm font-semibold text-slate-700">Skills Match</p>
                    <select value={form.skills_match_rating} onChange={(e) => setForm((c) => ({ ...c, skills_match_rating: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                      <option value="">Rate candidate suitability</option>
                      <option value="Excellent">Excellent</option>
                      <option value="Good">Good</option>
                      <option value="Average">Average</option>
                      <option value="Beginner">Beginner</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <textarea placeholder="Candidate Strengths" value={form.candidate_strengths} onChange={(e) => setForm((c) => ({ ...c, candidate_strengths: e.target.value }))} rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                  <textarea placeholder="Why is this candidate suitable?" value={form.suitability_reason} onChange={(e) => setForm((c) => ({ ...c, suitability_reason: e.target.value }))} rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                </div>

                <textarea placeholder="Additional Comments" value={form.additional_comments} onChange={(e) => setForm((c) => ({ ...c, additional_comments: e.target.value }))} rows={4} className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2" />

                <h5 className="mt-6 text-xl font-bold text-slate-800">Section 6: Eligibility Confirmation</h5>
                <p className="mt-1 text-sm text-slate-600">All checks are mandatory.</p>
                <div className="mt-3 space-y-3 rounded-xl border border-slate-200 p-4">
                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.unpaid_internship_acknowledged}
                      onChange={(e) => setForm((c) => ({ ...c, unpaid_internship_acknowledged: e.target.checked }))}
                      className="mt-0.5 h-4 w-4"
                    />
                    Candidate understands this is an unpaid internship
                  </label>
                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.available_during_internship}
                      onChange={(e) => setForm((c) => ({ ...c, available_during_internship: e.target.checked }))}
                      className="mt-0.5 h-4 w-4"
                    />
                    Candidate is available during internship period
                  </label>
                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.willing_for_specified_location}
                      onChange={(e) => setForm((c) => ({ ...c, willing_for_specified_location: e.target.checked }))}
                      className="mt-0.5 h-4 w-4"
                    />
                    Candidate is willing to work from the specified location
                  </label>
                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.can_dedicate_required_hours}
                      onChange={(e) => setForm((c) => ({ ...c, can_dedicate_required_hours: e.target.checked }))}
                      className="mt-0.5 h-4 w-4"
                    />
                    Candidate can dedicate required hours
                  </label>
                </div>

                <h5 className="mt-6 text-xl font-bold text-slate-800">Section 7: Referrer Declaration</h5>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <select
                    value={form.relationship_with_candidate}
                    onChange={(e) => setForm((c) => ({ ...c, relationship_with_candidate: e.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    required
                  >
                    <option value="">Relationship with Candidate *</option>
                    <option value="Family">Family</option>
                    <option value="Friend">Friend</option>
                    <option value="College Junior">College Junior</option>
                    <option value="College Senior">College Senior</option>
                    <option value="Ex-Colleague">Ex-Colleague</option>
                    <option value="Professional Contact">Professional Contact</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <textarea
                  placeholder="Additional Explanation"
                  value={form.relationship_additional_explanation}
                  onChange={(e) => setForm((c) => ({ ...c, relationship_additional_explanation: e.target.value }))}
                  rows={4}
                  className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2"
                />

                <h5 className="mt-6 text-xl font-bold text-slate-800">Section 8: Referrer Information</h5>
                <p className="mt-1 text-sm text-slate-600">Auto-filled after login (display only).</p>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-700">Referrer Name</p>
                    <input
                      value={currentUser?.full_name || 'Not available'}
                      className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-700"
                      readOnly
                      aria-label="Referrer Name"
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-700">Employee ID</p>
                    <input
                      value={currentUser?.employee_id || currentUser?.id || 'Not available'}
                      className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-700"
                      readOnly
                      aria-label="Employee ID"
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-700">Department</p>
                    <input
                      value={currentUser?.department || 'Not available'}
                      className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-700"
                      readOnly
                      aria-label="Department"
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-700">Email</p>
                    <input
                      value={currentUser?.email || 'Not available'}
                      className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-700"
                      readOnly
                      aria-label="Email"
                    />
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <button onClick={() => setCurrentStep(1)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600">Go Back</button>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setNotice({ type: 'success', text: 'Draft saved locally.' })} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">Save Draft</button>
                    <button onClick={() => setCurrentStep(3)} disabled={actionLoading} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">{actionLoading ? 'Proceeding...' : 'Next Step'}</button>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="rounded-2xl border bg-white p-6">
                <h4 className="mb-4 text-3xl font-bold text-slate-800">Final Review & Submission</h4>
                <p className="mb-6 text-sm text-slate-600">Please review all information before submitting your referral.</p>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <h5 className="mb-3 font-bold text-slate-800">Candidate</h5>
                    <div className="space-y-2 text-sm text-slate-700">
                      <p><span className="font-semibold">Name:</span> {form.candidate_name || 'Not provided'}</p>
                      <p><span className="font-semibold">Email:</span> {form.candidate_email || 'Not provided'}</p>
                      <p><span className="font-semibold">College:</span> {form.college || 'Not provided'}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <h5 className="mb-3 font-bold text-slate-800">Internship</h5>
                    <div className="space-y-2 text-sm text-slate-700">
                      <p><span className="font-semibold">Duration:</span> {form.start_date && form.end_date ? `${new Date(form.start_date).toLocaleDateString()} - ${new Date(form.end_date).toLocaleDateString()}` : 'Not provided'}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <h5 className="mb-3 font-bold text-slate-800">Mentor</h5>
                    <div className="space-y-2 text-sm text-slate-700">
                      <p><span className="font-semibold">Name:</span> {form.mentor_name || 'Not provided'}</p>
                      <p><span className="font-semibold">Email:</span> {form.mentor_email || 'Not provided'}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <h5 className="mb-3 font-bold text-slate-800">Project</h5>
                    <div className="space-y-2 text-sm text-slate-700">
                      <p><span className="font-semibold">Title:</span> {form.project_title || 'Not provided'}</p>
                      <p><span className="font-semibold">Skills Required:</span> {form.technologies_skills_required || 'Not provided'}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <h5 className="mb-3 font-bold text-emerald-900">Declarations & Eligibility Confirmations</h5>
                  <div className="space-y-2 text-sm text-emerald-800">
                    <p className="flex items-center gap-2">{form.unpaid_internship_acknowledged ? '✓' : '✗'} <span>Candidate understands this is an unpaid internship</span></p>
                    <p className="flex items-center gap-2">{form.available_during_internship ? '✓' : '✗'} <span>Candidate is available during internship period</span></p>
                    <p className="flex items-center gap-2">{form.willing_for_specified_location ? '✓' : '✗'} <span>Candidate is willing to work from the specified location</span></p>
                    <p className="flex items-center gap-2">{form.can_dedicate_required_hours ? '✓' : '✗'} <span>Candidate can dedicate required hours</span></p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <button onClick={() => setCurrentStep(2)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600">Go Back</button>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setNotice({ type: 'success', text: 'Draft saved locally.' })} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">Save Draft</button>
                    <button onClick={handleSubmitReferral} disabled={actionLoading} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">{actionLoading ? 'Submitting...' : 'Submit Referral'}</button>
                  </div>
                </div>
              </div>
            )}
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
