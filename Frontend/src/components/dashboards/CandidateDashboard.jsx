import { useEffect, useMemo, useState } from 'react'

const EMPTY_JOINING_FORM = {
  personal_details: { name: '', email: '', date_of_birth: '', phone: '', gender: '', nationality: '' },
  address: { street: '', city: '', state: '', zip_code: '', country: '' },
  emergency_contact: { name: '', phone: '', relationship: '' },
  education_history: [{ institution: '', degree: '', field_of_study: '', graduation_year: '', details: '' }],
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
const NOTICE_TIMEOUT_MS = 3000

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
  const [governmentIdIssueDate, setGovernmentIdIssueDate] = useState('')
  const [governmentIdExpiryDate, setGovernmentIdExpiryDate] = useState('')
  const [governmentDocumentUrl, setGovernmentDocumentUrl] = useState('')
  const [additionalDocName, setAdditionalDocName] = useState('')
  const [uploadedIdDoc, setUploadedIdDoc] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [ndaSignedFileName, setNdaSignedFileName] = useState('')
  const [ndaSignedUrl, setNdaSignedUrl] = useState('')
  const [ndaUploadSuccess, setNdaUploadSuccess] = useState(false)
  const [certificateRequestNotes, setCertificateRequestNotes] = useState('')

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
      throw new Error(data?.detail || 'Request failed')
    }
    return data
  }

  const selectedReferral = useMemo(() => myReferrals.find((item) => item.id === selectedReferralId) || null, [myReferrals, selectedReferralId])
  const mentorDetails = selectedReferral?.additional_data?.mentor_details || {}
  const isActiveInternship = selectedReferral?.state === 'IN_PROGRESS' || selectedReferral?.state === 'EXTENDED'
  const mentorName = mentorDetails?.mentor_name || 'Mentor not assigned'
  const mentorTitle = mentorDetails?.mentor_designation || mentorDetails?.mentor_role || mentorDetails?.mentor_department || 'Mentor'
  const mentorInitials = mentorName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'NA'

  const internshipDuration = useMemo(() => {
    if (!selectedReferral?.start_date || !selectedReferral?.end_date) {
      return { totalDays: null, elapsedDays: null, remainingDays: null, progress: 0 }
    }

    const start = new Date(selectedReferral.start_date)
    const end = new Date(selectedReferral.end_date)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return { totalDays: null, elapsedDays: null, remainingDays: null, progress: 0 }
    }

    const totalDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1
    const now = new Date()
    const elapsedDays = now < start ? 0 : Math.min(totalDays, Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1)
    const remainingDays = Math.max(0, totalDays - elapsedDays)
    const progress = totalDays > 0 ? Math.round((elapsedDays / totalDays) * 100) : 0

    return { totalDays, elapsedDays, remainingDays, progress }
  }, [selectedReferral])

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

  const isOnboardingPending = useMemo(() => {
    if (!selectedReferral) return false
    return selectedReferral.status === 'MENTOR_APPROVED' || selectedReferral.state === 'JOINING_FORM_PENDING'
  }, [selectedReferral])

  const currentStageLabel = useMemo(() => {
    if (!selectedReferral) return 'Referral Submitted'
    if (selectedReferral.status === 'CORRECTIONS_REQUIRED') return 'Corrections Required'
    if (isOnboardingPending) return 'Onboarding Pending'

    const stageMap = {
      SUBMITTED: 'Referral Submitted',
      ELIGIBILITY_REVIEW: 'Eligibility Review',
      ELIGIBILITY_PASSED: 'Eligibility Confirmed',
      JOINING_FORM_SUBMITTED: 'Joining Form Submitted',
      NDA_PENDING: 'NDA Pending',
      NDA_SIGNED: 'NDA Signed',
      NON_WORKER_ID_PENDING: 'ID Provisioning',
      CREDENTIALS_GENERATED: 'Credentials Generated',
      READY_TO_START: 'Ready To Start',
      IN_PROGRESS: 'Internship In Progress',
      CLOSED: 'Internship Closed',
    }

    return stageMap[selectedReferral.state] || 'Referral Submitted'
  }, [selectedReferral, isOnboardingPending])

  const isJoiningFormSubmitted = useMemo(() => {
    if (!selectedReferral) return false

    const submittedOrBeyondStates = [
      'JOINING_FORM_SUBMITTED',
      'NDA_PENDING',
      'NDA_SIGNED',
      'NON_WORKER_ID_PENDING',
      'CREDENTIALS_GENERATED',
      'READY_TO_START',
      'IN_PROGRESS',
      'EXTENDED',
      'IN_CLOSURE',
      'COMPLETED',
      'CLOSED',
    ]

    return submittedOrBeyondStates.includes(selectedReferral.state)
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

  const handleDraftSave = async () => {
    if (!selectedReferralId) return
    setActionLoading('draft')
    setNotice({ type: '', text: '' })
    try {
      const computedGovernmentIds = governmentIdNumber ? [{
        id_type: governmentIdType,
        id_number: governmentIdNumber,
        issue_date: governmentIdIssueDate || new Date().toISOString().slice(0, 10),
        expiry_date: governmentIdExpiryDate || null,
        document_url: governmentDocumentUrl || uploadedIdDoc || null,
      }] : joiningForm.government_ids

      const normalizedEducation = (joiningForm.education_history || []).map((entry) => ({
        ...entry,
        graduation_year: Number(entry.graduation_year || 0),
      }))

      const payload = {
        ...joiningForm,
        education_history: normalizedEducation,
        government_ids: computedGovernmentIds,
      }
      await apiRequest(`/referrals/${selectedReferralId}/joining-form/draft`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setNotice({ type: 'success', text: 'Draft saved successfully' })
      setMessage('Draft saved')
      setFieldErrors({})
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
    if (isJoiningFormSubmitted) {
      setNotice({ type: 'success', text: 'You have already submitted the joining form.' })
      return
    }

    const educationEntry = joiningForm.education_history?.[0] || {}
    const validationErrors = {}

    if (!joiningForm.personal_details?.name?.trim()) validationErrors.personal_name = 'Full name is required'
    if (!joiningForm.personal_details?.email?.trim()) validationErrors.personal_email = 'Email is required'
    if (!joiningForm.personal_details?.date_of_birth?.trim()) validationErrors.personal_dob = 'Date of birth is required'
    if (!joiningForm.personal_details?.phone?.trim()) validationErrors.personal_phone = 'Phone is required'

    if (!joiningForm.address?.street?.trim()) validationErrors.address_street = 'Street is required'
    if (!joiningForm.address?.city?.trim()) validationErrors.address_city = 'City is required'
    if (!joiningForm.address?.state?.trim()) validationErrors.address_state = 'State is required'
    if (!joiningForm.address?.zip_code?.trim()) validationErrors.address_zip = 'ZIP code is required'
    if (!joiningForm.address?.country?.trim()) validationErrors.address_country = 'Country is required'

    if (!joiningForm.emergency_contact?.name?.trim()) validationErrors.emergency_name = 'Emergency contact name is required'
    if (!joiningForm.emergency_contact?.phone?.trim()) validationErrors.emergency_phone = 'Emergency contact phone is required'
    if (!joiningForm.emergency_contact?.relationship?.trim()) validationErrors.emergency_relationship = 'Relationship is required'

    if (!educationEntry?.institution?.trim()) validationErrors.edu_institution = 'College is required'
    if (!educationEntry?.degree?.trim()) validationErrors.edu_degree = 'Degree is required'
    if (!educationEntry?.field_of_study?.trim()) validationErrors.edu_field = 'Field of study is required'
    if (!String(educationEntry?.graduation_year || '').trim()) validationErrors.edu_grad_year = 'Graduation year is required'

    if (!governmentIdType?.trim()) validationErrors.gov_type = 'Government ID type is required'
    if (!governmentIdNumber?.trim()) validationErrors.gov_number = 'Government ID number is required'
    if (!governmentIdIssueDate?.trim()) validationErrors.gov_issue = 'Government ID issue date is required'

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      setNotice({ type: 'error', text: 'Please complete all required fields before submitting.' })
      return
    }

    setActionLoading('submit')
    setNotice({ type: '', text: '' })
    try {
      const computedGovernmentIds = governmentIdNumber ? [{
        id_type: governmentIdType,
        id_number: governmentIdNumber,
        issue_date: governmentIdIssueDate || new Date().toISOString().slice(0, 10),
        expiry_date: governmentIdExpiryDate || null,
        document_url: governmentDocumentUrl || uploadedIdDoc || null,
      }] : joiningForm.government_ids

      const normalizedEducation = (joiningForm.education_history || []).map((entry) => ({
        ...entry,
        graduation_year: Number(entry.graduation_year || 0),
      }))

      const payload = {
        ...joiningForm,
        education_history: normalizedEducation,
        government_ids: computedGovernmentIds,
        employment_history: joiningForm.employment_history || [],
      }
      await apiRequest(`/referrals/${selectedReferralId}/joining-form/submit`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setFieldErrors({})
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
    if (!ndaSignedFileName && !ndaSignedUrl) {
      setNotice({ type: 'error', text: 'Upload or provide signed NDA copy before submitting.' })
      return
    }
    setActionLoading('sign-nda')
    setNotice({ type: '', text: '' })
    try {
      await apiRequest(`/referrals/${selectedReferralId}/nda/sign`, {
        method: 'POST',
        body: JSON.stringify({
          archived_url: ndaSignedUrl || null,
          signed_file_name: ndaSignedFileName || null,
        }),
      })
      setNotice({ type: 'success', text: 'Signed NDA uploaded. HR review pending.' })
      setMessage('Signed NDA uploaded')
      setNdaSignedFileName('')
      setNdaSignedUrl('')
      await refreshCandidateData()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const handleSignedNdaFileSelect = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !selectedReferralId) return

    setNdaUploadSuccess(false)
    setActionLoading('upload-nda-file')
    setNotice({ type: '', text: '' })
    try {
      const formData = new FormData()
      formData.append('signed_copy', file)

      const upload = await apiRequest(`/referrals/${selectedReferralId}/nda/upload-signed`, {
        method: 'POST',
        body: formData,
      })

      setNdaSignedFileName(upload.file_name || file.name)
      setNdaSignedUrl(upload.archived_url || '')
      setNdaUploadSuccess(true)
      setNotice({ type: 'success', text: 'Signed NDA file uploaded. Submit for HR review next.' })
    } catch (err) {
      setNdaUploadSuccess(false)
      setNotice({ type: 'error', text: err.message || 'Failed to upload signed NDA file.' })
      setError(err.message)
    } finally {
      setActionLoading('')
      event.target.value = ''
    }
  }

  const handleRequestCertificate = async () => {
    if (!selectedReferralId) return

    setActionLoading('request-certificate')
    setNotice({ type: '', text: '' })
    try {
      await apiRequest(`/referrals/${selectedReferralId}/certificate/request-candidate`, {
        method: 'POST',
        body: JSON.stringify({ notes: certificateRequestNotes || null }),
      })
      setNotice({ type: 'success', text: 'Certificate request submitted successfully. HR will review and proceed.' })
      setMessage('Certificate request submitted')
      setCertificateRequestNotes('')
      await loadCertificate(selectedReferralId)
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Failed to request certificate.' })
      setError(err.message)
    } finally {
      setActionLoading('')
    }
  }

  const canRequestCertificate = selectedReferral && ['COMPLETED', 'CLOSURE_APPROVED', 'CLOSED'].includes(selectedReferral.status)
  const isCertificateAlreadyRequested = certificate && ['REQUEST_FORM_SENT', 'REQUESTED', 'GENERATED', 'ISSUED', 'ARCHIVED'].includes(certificate.status)
  const ndaDownloadUrl = nda?.esign_url || '/sample-nda.doc'

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
        </header>

        {notice.text && (
          <div className={`mx-8 mt-5 rounded-lg border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {notice.text}
          </div>
        )}

        {activeTab === 'status' && (
          <div className="space-y-6 p-8">
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

            {selectedReferral?.status === 'CORRECTIONS_REQUIRED' && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
                <p className="text-2xl font-bold text-amber-900">Corrections Required by HR</p>
                <p className="mt-1 text-sm text-amber-800">Please update and resubmit your joining form to continue onboarding.</p>
                <button
                  onClick={() => setActiveTab('documents')}
                  className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
                >
                  Go To Joining Form
                </button>
              </div>
            )}

            <div className="rounded-2xl border border-indigo-300 bg-indigo-50 p-5">
              <p className="text-3xl font-bold text-indigo-900">Welcome to Intern Flow</p>
              <p className="mt-2 text-lg text-indigo-800">Current Stage: {currentStageLabel}</p>
            </div>

            <div className="rounded-2xl border border-indigo-200 bg-white p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-3xl font-bold text-slate-800">{isJoiningFormSubmitted ? 'Joining Form Submitted' : isOnboardingPending ? 'Onboarding Invitation' : 'Action Required'}</p>
                  <p className="text-lg text-slate-500">
                    {isJoiningFormSubmitted
                      ? 'Your joining form is already submitted. Please wait for HR review to continue onboarding.'
                      : isOnboardingPending
                      ? 'Your mentor approved your profile. Please complete onboarding steps to continue.'
                      : 'Please complete your Joining Form to proceed with onboarding.'}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('documents')}
                  disabled={isJoiningFormSubmitted}
                  className="rounded-lg bg-indigo-600 px-6 py-3 text-lg font-semibold text-white hover:bg-indigo-500 disabled:bg-slate-300 disabled:text-slate-600"
                >
                  {isJoiningFormSubmitted ? 'Already Submitted' : 'Complete Form'}
                </button>
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
                <div className="rounded-full bg-indigo-100 p-4 text-center text-2xl font-bold text-indigo-700">{mentorInitials}</div>
                <p className="mt-3 text-xl font-bold text-slate-800">{mentorName}</p>
                <p className="text-sm text-slate-500">{mentorTitle}</p>
                <button className="mt-4 w-full rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700">Send Message</button>
              </div>
            </div>

            {isActiveInternship && (
              <div className="rounded-2xl border border-emerald-200 bg-white p-6">
                <h3 className="text-3xl font-bold text-slate-800">Step 9: Active Internship</h3>
                <p className="mt-1 text-sm text-slate-600">Track your active internship period and stay aligned with your mentor.</p>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-500">INTERNSHIP DETAILS</p>
                    <p className="mt-2 text-sm text-slate-800">Project: {selectedReferral?.project_overview || 'Not shared yet'}</p>
                    <p className="text-sm text-slate-800">Location: {selectedReferral?.location || 'Not specified'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-500">MENTOR INFORMATION</p>
                    <p className="mt-2 text-sm text-slate-800">Name: {mentorDetails.mentor_name || 'Assigned mentor'}</p>
                    <p className="text-sm text-slate-800">Email: {mentorDetails.mentor_email || 'Available in portal'}</p>
                    <p className="text-sm text-slate-800">Department: {mentorDetails.mentor_department || 'Technology'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-500">DURATION TRACKER</p>
                    <p className="mt-2 text-sm text-slate-800">Elapsed: {internshipDuration.elapsedDays ?? 'N/A'} days</p>
                    <p className="text-sm text-slate-800">Remaining: {internshipDuration.remainingDays ?? 'N/A'} days</p>
                    <div className="mt-3 h-2 rounded bg-slate-200">
                      <div className="h-2 rounded bg-emerald-500" style={{ width: `${internshipDuration.progress}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-600">Progress: {internshipDuration.progress}%</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-6 p-8">
            <div className="rounded-2xl border bg-white p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-4xl font-bold text-slate-800">Joining Form</h3>
                <button onClick={handleDraftSave} disabled={actionLoading === 'draft'} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">{actionLoading === 'draft' ? 'Saving...' : 'Save Draft'}</button>
              </div>
              <p className="mt-2 text-sm text-slate-500">{isJoiningFormSubmitted ? 'Your joining form has already been submitted for HR review.' : 'Complete your onboarding form to move to JOINING_FORM_SUBMITTED.'}</p>
            </div>

            {isJoiningFormSubmitted && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-800">Joining form already submitted</p>
                <p className="mt-1 text-sm text-emerald-700">No further action is required right now. Please wait for HR review.</p>
              </div>
            )}

            <div className="rounded-2xl border bg-white p-6">
              <p className="mt-1 text-lg text-slate-500">Provide personal, academic, and identity details for onboarding.</p>

              <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xl font-semibold text-slate-800">Personal Information</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Full name</label>
                    <input
                      value={joiningForm.personal_details.name}
                      onChange={(e) => setJoiningForm((c) => ({ ...c, personal_details: { ...c.personal_details, name: e.target.value } }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                    {fieldErrors.personal_name && <p className="mt-1 text-xs text-rose-600">{fieldErrors.personal_name}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Email</label>
                    <input
                      type="email"
                      value={joiningForm.personal_details.email}
                      onChange={(e) => setJoiningForm((c) => ({ ...c, personal_details: { ...c.personal_details, email: e.target.value } }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                    {fieldErrors.personal_email && <p className="mt-1 text-xs text-rose-600">{fieldErrors.personal_email}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Date of birth</label>
                    <input
                      type="date"
                      value={joiningForm.personal_details.date_of_birth}
                      onChange={(e) => setJoiningForm((c) => ({ ...c, personal_details: { ...c.personal_details, date_of_birth: e.target.value } }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                    {fieldErrors.personal_dob && <p className="mt-1 text-xs text-rose-600">{fieldErrors.personal_dob}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Phone</label>
                    <input
                      value={joiningForm.personal_details.phone}
                      onChange={(e) => setJoiningForm((c) => ({ ...c, personal_details: { ...c.personal_details, phone: e.target.value } }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                    {fieldErrors.personal_phone && <p className="mt-1 text-xs text-rose-600">{fieldErrors.personal_phone}</p>}
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xl font-semibold text-slate-800">Address</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <input placeholder="Street" value={joiningForm.address.street} onChange={(e) => setJoiningForm((c) => ({ ...c, address: { ...c.address, street: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                    {fieldErrors.address_street && <p className="mt-1 text-xs text-rose-600">{fieldErrors.address_street}</p>}
                  </div>
                  <div>
                    <input placeholder="City" value={joiningForm.address.city} onChange={(e) => setJoiningForm((c) => ({ ...c, address: { ...c.address, city: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                    {fieldErrors.address_city && <p className="mt-1 text-xs text-rose-600">{fieldErrors.address_city}</p>}
                  </div>
                  <div>
                    <input placeholder="State" value={joiningForm.address.state} onChange={(e) => setJoiningForm((c) => ({ ...c, address: { ...c.address, state: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                    {fieldErrors.address_state && <p className="mt-1 text-xs text-rose-600">{fieldErrors.address_state}</p>}
                  </div>
                  <div>
                    <input placeholder="ZIP Code" value={joiningForm.address.zip_code} onChange={(e) => setJoiningForm((c) => ({ ...c, address: { ...c.address, zip_code: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                    {fieldErrors.address_zip && <p className="mt-1 text-xs text-rose-600">{fieldErrors.address_zip}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <input placeholder="Country" value={joiningForm.address.country} onChange={(e) => setJoiningForm((c) => ({ ...c, address: { ...c.address, country: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                    {fieldErrors.address_country && <p className="mt-1 text-xs text-rose-600">{fieldErrors.address_country}</p>}
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xl font-semibold text-slate-800">Emergency Contact</p>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <input placeholder="Name" value={joiningForm.emergency_contact.name} onChange={(e) => setJoiningForm((c) => ({ ...c, emergency_contact: { ...c.emergency_contact, name: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                    {fieldErrors.emergency_name && <p className="mt-1 text-xs text-rose-600">{fieldErrors.emergency_name}</p>}
                  </div>
                  <div>
                    <input placeholder="Phone" value={joiningForm.emergency_contact.phone} onChange={(e) => setJoiningForm((c) => ({ ...c, emergency_contact: { ...c.emergency_contact, phone: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                    {fieldErrors.emergency_phone && <p className="mt-1 text-xs text-rose-600">{fieldErrors.emergency_phone}</p>}
                  </div>
                  <div>
                    <input placeholder="Relationship" value={joiningForm.emergency_contact.relationship} onChange={(e) => setJoiningForm((c) => ({ ...c, emergency_contact: { ...c.emergency_contact, relationship: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                    {fieldErrors.emergency_relationship && <p className="mt-1 text-xs text-rose-600">{fieldErrors.emergency_relationship}</p>}
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xl font-semibold text-slate-800">Academic Information</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <input placeholder="College" value={joiningForm.education_history?.[0]?.institution || ''} onChange={(e) => setJoiningForm((c) => ({ ...c, education_history: [{ ...(c.education_history?.[0] || {}), institution: e.target.value }] }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                    {fieldErrors.edu_institution && <p className="mt-1 text-xs text-rose-600">{fieldErrors.edu_institution}</p>}
                  </div>
                  <div>
                    <input placeholder="Degree" value={joiningForm.education_history?.[0]?.degree || ''} onChange={(e) => setJoiningForm((c) => ({ ...c, education_history: [{ ...(c.education_history?.[0] || {}), degree: e.target.value }] }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                    {fieldErrors.edu_degree && <p className="mt-1 text-xs text-rose-600">{fieldErrors.edu_degree}</p>}
                  </div>
                  <div>
                    <input placeholder="Field of Study" value={joiningForm.education_history?.[0]?.field_of_study || ''} onChange={(e) => setJoiningForm((c) => ({ ...c, education_history: [{ ...(c.education_history?.[0] || {}), field_of_study: e.target.value }] }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                    {fieldErrors.edu_field && <p className="mt-1 text-xs text-rose-600">{fieldErrors.edu_field}</p>}
                  </div>
                  <div>
                    <input placeholder="Graduation Year" type="number" value={joiningForm.education_history?.[0]?.graduation_year || ''} onChange={(e) => setJoiningForm((c) => ({ ...c, education_history: [{ ...(c.education_history?.[0] || {}), graduation_year: e.target.value }] }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                    {fieldErrors.edu_grad_year && <p className="mt-1 text-xs text-rose-600">{fieldErrors.edu_grad_year}</p>}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="font-semibold text-slate-700">Non-Worker ID</p>
                <p className="text-2xl font-bold text-slate-800">{nonWorker?.generated_non_worker_id || 'NW-9843-INT'}</p>
                <p className="text-sm text-slate-500">This ID is auto-assigned and will be used for your system access provisioning.</p>
              </div>

              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xl font-semibold text-slate-800">Identity Information</p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">ID Type</label>
                  <input value={governmentIdType} onChange={(e) => setGovernmentIdType(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                  {fieldErrors.gov_type && <p className="mt-1 text-xs text-rose-600">{fieldErrors.gov_type}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">ID Number</label>
                  <input value={governmentIdNumber} onChange={(e) => setGovernmentIdNumber(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="XXXX-XXXX-1234" />
                  {fieldErrors.gov_number && <p className="mt-1 text-xs text-rose-600">{fieldErrors.gov_number}</p>}
                </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Issue Date</label>
                    <input type="date" value={governmentIdIssueDate} onChange={(e) => setGovernmentIdIssueDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                    {fieldErrors.gov_issue && <p className="mt-1 text-xs text-rose-600">{fieldErrors.gov_issue}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Expiry Date (Optional)</label>
                    <input type="date" value={governmentIdExpiryDate} onChange={(e) => setGovernmentIdExpiryDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-dashed border-indigo-200 bg-white p-6 text-center">
                  <p className="text-sm text-slate-600">Upload Government ID Document</p>
                  <input
                    id="government-id-upload"
                    type="file"
                    className="hidden"
                    onChange={(e) => setUploadedIdDoc(e.target.files?.[0]?.name || '')}
                  />
                  <label
                    htmlFor="government-id-upload"
                    className="mx-auto mt-3 inline-flex cursor-pointer rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    Attach File
                  </label>
                  {uploadedIdDoc && <p className="mt-2 text-xs font-semibold text-emerald-700">{uploadedIdDoc} uploaded</p>}
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Document URL or Identifier (Optional)</label>
                  <input value={governmentDocumentUrl} onChange={(e) => setGovernmentDocumentUrl(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="https://..." />
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Other Required Document (Optional)</label>
                  <input value={additionalDocName} onChange={(e) => setAdditionalDocName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="e.g. Provisional certificate" />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-3">
                <button onClick={handleDraftSave} disabled={actionLoading === 'draft'} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">{actionLoading === 'draft' ? 'Saving...' : 'Save Draft'}</button>
                <button onClick={handleSubmitForm} disabled={actionLoading === 'submit' || isJoiningFormSubmitted} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-300">{actionLoading === 'submit' ? 'Submitting...' : isJoiningFormSubmitted ? 'Already Submitted' : 'Submit Form'}</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'nda' && (
          <div className="space-y-4 p-8">
            <div className="rounded-2xl border bg-white p-6">
              <h3 className="text-3xl font-bold text-slate-800">NDA</h3>
              <p className="mt-1 text-sm text-slate-500">Download NDA, sign it, and upload signed copy for HR approval.</p>
              <div className="mt-4 text-sm text-slate-600">Status: <span className="font-semibold">{nda?.status || 'Pending'}</span></div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Step 1: Download NDA</p>
                <a href={ndaDownloadUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
                  Download NDA
                </a>
                {!nda?.esign_url && <p className="mt-2 text-xs text-slate-600">Showing sample Word NDA for now. HR-issued NDA will replace this link automatically.</p>}
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Step 2: Upload Signed Copy</p>
                <input
                  id="signed-nda-upload"
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx"
                  onChange={handleSignedNdaFileSelect}
                />
                <label
                  htmlFor="signed-nda-upload"
                  className="mt-2 inline-flex cursor-pointer rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
                >
                  Attach Signed Copy
                </label>
                {ndaSignedFileName && <p className="mt-2 text-xs font-semibold text-emerald-700">{ndaSignedFileName} selected</p>}
                {actionLoading === 'upload-nda-file' && <p className="mt-2 text-xs font-semibold text-indigo-600">Uploading signed NDA...</p>}
                {ndaUploadSuccess && <p className="mt-2 text-xs font-semibold text-emerald-700">NDA uploaded successfully.</p>}
                <input
                  value={ndaSignedUrl}
                  onChange={(e) => setNdaSignedUrl(e.target.value)}
                  className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Optional: signed file URL"
                />
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Step 3: Submit for HR Review</p>
                <button onClick={handleSignNda} disabled={actionLoading === 'sign-nda'} className="mt-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white">
                  {actionLoading === 'sign-nda' ? 'Uploading...' : 'Upload Signed NDA'}
                </button>
              </div>
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

              {certificate?.status === 'ISSUED' && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-900">Step 14 Complete: Certificate Issued</p>
                  {certificate.candidate_download_url ? (
                    <a
                      href={certificate.candidate_download_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Download Certificate
                    </a>
                  ) : (
                    <p className="mt-2 text-xs text-emerald-800">Download link will be available shortly.</p>
                  )}
                  <p className="mt-2 text-xs text-emerald-800">
                    Email copy sent to: {certificate.candidate_email_sent_to || 'Pending'}
                  </p>
                </div>
              )}

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Step 13: Certificate Request</p>
                <p className="mt-1 text-xs text-slate-600">Request internship certificate after internship completion.</p>
                <textarea
                  value={certificateRequestNotes}
                  onChange={(event) => setCertificateRequestNotes(event.target.value)}
                  rows={2}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Optional note for HR"
                />
                <button
                  onClick={handleRequestCertificate}
                  disabled={!canRequestCertificate || isCertificateAlreadyRequested || actionLoading === 'request-certificate'}
                  className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
                >
                  {actionLoading === 'request-certificate' ? 'Requesting...' : 'Request Certificate'}
                </button>
                {!canRequestCertificate && <p className="mt-2 text-xs text-amber-700">Certificate request becomes available after internship is marked completed.</p>}
                {isCertificateAlreadyRequested && <p className="mt-2 text-xs text-emerald-700">Certificate request already initiated.</p>}
              </div>
            </div>
          </div>
        )}

        {loading && <div className="px-8 pb-8 text-sm text-slate-500">Loading candidate data...</div>}
      </main>
    </div>
  )
}

export default CandidateDashboard
