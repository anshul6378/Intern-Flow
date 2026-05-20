import { useEffect, useState } from 'react'

import AuthSection from './components/pages/AuthSection'
import ReferrerDashboard from './components/dashboards/ReferrerDashboard'
import CandidateDashboard from './components/dashboards/CandidateDashboard'
import MentorDashboard from './components/dashboards/MentorDashboard'
import HRDashboard from './components/dashboards/HRDashboard'
import ManagerDashboard from './components/dashboards/ManagerDashboard'

const EMPTY_REGISTER = {
  full_name: '',
  email: '',
  password: '',
  role: 'referrer',
}

const EMPTY_LOGIN = {
  email: '',
  password: '',
}

const EMPTY_CLAIM = {
  email: '',
  password: '',
  role: 'candidate',
}

const EMPTY_REFERRAL = {
  candidate_email: '',
  mentor_email: '',
  start_date: '',
  end_date: '',
  project_overview: '',
  location: '',
  relationship_to_mentor: '',
}

const EMPTY_ELIGIBILITY = {
  unpaid_consent_confirmed: true,
  in_person_ready_confirmed: true,
  location_match_confirmed: true,
  notes: '',
}

const EMPTY_TRANSITION = {
  next_state: 'JOINING_FORM_PENDING',
  notes: '',
}

const EMPTY_JOINING_FORM = {
  current_step: 1,
  personal_details: {
    name: '',
    email: '',
    date_of_birth: '',
    phone: '',
    gender: '',
    nationality: '',
  },
  address: {
    street: '',
    city: '',
    state: '',
    zip_code: '',
    country: '',
  },
  emergency_contact: {
    name: '',
    phone: '',
    relationship: '',
  },
  education_history: [],
  employment_history: [],
  government_ids: [],
  declarations_signed: false,
}

const ROLE_OPTIONS = [
  { value: 'referrer', label: 'Referrer' },
  { value: 'candidate', label: 'Candidate' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'hr', label: 'HR' },
  { value: 'admin', label: 'Admin' },
]

const NEXT_STATES = [
  'SUBMITTED',
  'ELIGIBILITY_REVIEW',
  'ELIGIBILITY_PASSED',
  'ELIGIBILITY_FAILED',
  'JOINING_FORM_PENDING',
  'JOINING_FORM_SUBMITTED',
  'NDA_PENDING',
  'NDA_SIGNED',
  'NON_WORKER_ID_PENDING',
  'CREDENTIALS_GENERATED',
  'READY_TO_START',
  'IN_PROGRESS',
  'DELAYED',
  'EXTENDED',
  'IN_CLOSURE',
  'CLOSED',
]



const EMPTY_NDA_SEND = {
  esign_provider: 'DocuSign',
  template_version: 'v1',
  expires_in_hours: 48,
}

function App() {
  const [registerForm, setRegisterForm] = useState(EMPTY_REGISTER)
  const [loginForm, setLoginForm] = useState(EMPTY_LOGIN)
  const [claimForm, setClaimForm] = useState(EMPTY_CLAIM)
  const [referralForm, setReferralForm] = useState(EMPTY_REFERRAL)
  const [eligibilityForm, setEligibilityForm] = useState(EMPTY_ELIGIBILITY)
  const [transitionForm, setTransitionForm] = useState(EMPTY_TRANSITION)
  const [joiningForm, setJoiningForm] = useState(EMPTY_JOINING_FORM)
  const [joiningFormData, setJoiningFormData] = useState(null)
  const [joiningFormLoading, setJoiningFormLoading] = useState(false)
  const [ndaSendForm, setNdaSendForm] = useState(EMPTY_NDA_SEND)
  const [ndaDetails, setNdaDetails] = useState(null)
  const [ndaLoading, setNdaLoading] = useState(false)
  const [token, setToken] = useState(() => localStorage.getItem('internflow_token') || '')
  const [currentUser, setCurrentUser] = useState(null)
  const [referrals, setReferrals] = useState([])
  const [selectedReferralId, setSelectedReferralId] = useState('')
  const [selectedReferral, setSelectedReferral] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)

  const resetStatus = () => {
    setMessage('')
    setError('')
  }

  const parseResponse = async (response) => {
    const text = await response.text()
    if (!text) {
      return null
    }

    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }

  const apiRequest = async (path, options = {}, activeToken = token) => {
    const authHeaders = {
      'Content-Type': 'application/json',
      ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
    }

    const response = await fetch(`/api/v1${path}`, {
      ...options,
      headers: {
        ...authHeaders,
        ...(options.headers || {}),
      },
    })

    const data = await parseResponse(response)
    if (!response.ok) {
      const detail = data && typeof data === 'object' && 'detail' in data ? data.detail : 'Request failed'
      throw new Error(Array.isArray(detail) ? detail.map((item) => item.msg || item).join(', ') : detail)
    }

    return data
  }

  const loadProfile = async (activeToken = token) => {
    if (!activeToken) {
      return
    }

    const response = await fetch('/api/v1/auth/me', {
      headers: {
        Authorization: `Bearer ${activeToken}`,
      },
    })

    if (!response.ok) {
      throw new Error('Unable to load current user')
    }

    return response.json()
  }

  const loadReferrals = async (activeToken = token) => {
    const data = await apiRequest('/referrals', {}, activeToken)
    setReferrals(data.items || [])
  }

  const loadReferralDetails = async (referralId, activeToken = token) => {
    const [referralData, timelineData] = await Promise.all([
      apiRequest(`/referrals/${referralId}`, {}, activeToken),
      apiRequest(`/referrals/${referralId}/timeline`, {}, activeToken),
    ])

    setSelectedReferral(referralData)
    setTimeline(timelineData.events || [])
  }

  useEffect(() => {
    const bootstrap = async () => {
      if (!token) {
        return
      }

      try {
        const profile = await loadProfile(token)
        setCurrentUser(profile)
        await loadReferrals(token)
      } catch (err) {
        localStorage.removeItem('internflow_token')
        setToken('')
        setCurrentUser(null)
        setReferrals([])
        setMessage('')
        setError(err.message || 'Session expired')
      }
    }

    bootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleRegisterChange = (event) => {
    const { name, value } = event.target
    setRegisterForm((current) => ({ ...current, [name]: value }))
  }

  const handleLoginChange = (event) => {
    const { name, value } = event.target
    setLoginForm((current) => ({ ...current, [name]: value }))
  }

  const handleClaimChange = (event) => {
    const { name, value } = event.target
    setClaimForm((current) => ({ ...current, [name]: value }))
  }

  const handleReferralChange = (event) => {
    const { name, value } = event.target
    setReferralForm((current) => ({ ...current, [name]: value }))
  }

  const handleEligibilityChange = (event) => {
    const { name, type, checked, value } = event.target
    setEligibilityForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleTransitionChange = (event) => {
    const { name, value } = event.target
    setTransitionForm((current) => ({ ...current, [name]: value }))
  }

  const handleNdaSendChange = (event) => {
    const { name, value } = event.target
    setNdaSendForm((current) => ({
      ...current,
      [name]: name === 'expires_in_hours' ? Number(value) : value,
    }))
  }

  const handleRegister = async (event) => {
    event.preventDefault()
    resetStatus()
    setLoading(true)

    try {
      const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerForm),
      })
      setMessage(`Registered ${registerForm.email}. User ID: ${data.user_id}`)
      setRegisterForm(EMPTY_REGISTER)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    resetStatus()
    setLoading(true)

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      })
      localStorage.setItem('internflow_token', data.access_token)
      setToken(data.access_token)
      const profile = await loadProfile(data.access_token)
      setCurrentUser(profile)
      await loadReferrals(data.access_token)
      setMessage(`Welcome back, ${profile.full_name}`)
      setLoginForm(EMPTY_LOGIN)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClaimAccount = async (event) => {
    event.preventDefault()
    resetStatus()
    setLoading(true)

    try {
      const data = await apiRequest('/auth/claim-account', {
        method: 'POST',
        body: JSON.stringify(claimForm),
      })
      setMessage(`${data.message}. You can log in now as ${claimForm.email}`)
      setClaimForm(EMPTY_CLAIM)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('internflow_token')
    setToken('')
    setCurrentUser(null)
    setReferrals([])
    setSelectedReferral(null)
    setTimeline([])
    setSelectedReferralId('')
    setMessage('Logged out')
    setError('')
  }

  const handleCreateReferral = async (event) => {
    event.preventDefault()
    resetStatus()
    setLoading(true)

    try {
      const payload = {
        candidate_email: referralForm.candidate_email,
        mentor_email: referralForm.mentor_email,
        start_date: referralForm.start_date || null,
        end_date: referralForm.end_date || null,
        project_overview: referralForm.project_overview,
        location: referralForm.location,
        relationship_to_mentor: referralForm.relationship_to_mentor,
        additional_data: {
          source: 'frontend',
          notes: referralForm.project_overview,
        },
        unpaid_consent_confirmed: false,
        in_person_ready_confirmed: false,
        location_match_confirmed: false,
      }

      const created = await apiRequest('/referrals', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setMessage(`Referral created successfully. Referral ID: ${created.id}`)
      setSelectedReferralId(created.id)
      setReferralForm(EMPTY_REFERRAL)
      await loadReferrals()
      await loadReferralDetails(created.id)
      await loadNdaDetails(created.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEligibilitySubmit = async (event) => {
    event.preventDefault()
    if (!selectedReferralId) {
      setError('Select a referral first')
      return
    }

    resetStatus()
    setLoading(true)

    try {
      const updated = await apiRequest(`/referrals/${selectedReferralId}/eligibility`, {
        method: 'PUT',
        body: JSON.stringify(eligibilityForm),
      })
      setSelectedReferral(updated)
      await loadReferrals()
      await loadReferralDetails(selectedReferralId)
      setMessage(`Eligibility checked for ${updated.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleStateTransition = async (event) => {
    event.preventDefault()
    if (!selectedReferralId) {
      setError('Select a referral first')
      return
    }

    resetStatus()
    setLoading(true)

    try {
      const updated = await apiRequest(`/referrals/${selectedReferralId}/state`, {
        method: 'PUT',
        body: JSON.stringify(transitionForm),
      })
      setSelectedReferral(updated)
      await loadReferrals()
      await loadReferralDetails(selectedReferralId)
      setMessage(`State moved to ${updated.state}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLookupReferral = async (event) => {
    event.preventDefault()
    if (!selectedReferralId) {
      setError('Enter a referral ID')
      return
    }

    resetStatus()
    setLookupLoading(true)

    try {
      await loadReferralDetails(selectedReferralId)
      await loadNdaDetails(selectedReferralId)
      setMessage(`Loaded referral ${selectedReferralId}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLookupLoading(false)
    }
  }

  const loadNdaDetails = async (referralId) => {
    try {
      const nda = await apiRequest(`/referrals/${referralId}/nda`)
      setNdaDetails(nda)
    } catch {
      setNdaDetails(null)
    }
  }

  const handleSendNda = async () => {
    if (!selectedReferralId) {
      setError('Select a referral first')
      return
    }

    resetStatus()
    setNdaLoading(true)
    try {
      const nda = await apiRequest(`/referrals/${selectedReferralId}/nda/send`, {
        method: 'POST',
        body: JSON.stringify(ndaSendForm),
      })
      setNdaDetails(nda)
      setMessage('NDA issued successfully')
      await loadReferralDetails(selectedReferralId)
    } catch (err) {
      setError(err.message)
    } finally {
      setNdaLoading(false)
    }
  }

  const handleSignNda = async () => {
    if (!selectedReferralId) {
      setError('Select a referral first')
      return
    }

    resetStatus()
    setNdaLoading(true)
    try {
      const nda = await apiRequest(`/referrals/${selectedReferralId}/nda/sign`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setNdaDetails(nda)
      setMessage('NDA signed successfully')
      await loadReferralDetails(selectedReferralId)
    } catch (err) {
      setError(err.message)
    } finally {
      setNdaLoading(false)
    }
  }

  const handleRejectNda = async () => {
    if (!selectedReferralId) {
      setError('Select a referral first')
      return
    }

    resetStatus()
    setNdaLoading(true)
    try {
      const nda = await apiRequest(`/referrals/${selectedReferralId}/nda/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Rejected from UI' }),
      })
      setNdaDetails(nda)
      setMessage('NDA rejected')
      await loadReferralDetails(selectedReferralId)
    } catch (err) {
      setError(err.message)
    } finally {
      setNdaLoading(false)
    }
  }

  const handleExpireNda = async () => {
    if (!selectedReferralId) {
      setError('Select a referral first')
      return
    }

    resetStatus()
    setNdaLoading(true)
    try {
      const nda = await apiRequest(`/referrals/${selectedReferralId}/nda/expire`, {
        method: 'POST',
      })
      setNdaDetails(nda)
      setMessage('NDA marked as expired')
      await loadReferralDetails(selectedReferralId)
    } catch (err) {
      setError(err.message)
    } finally {
      setNdaLoading(false)
    }
  }

  const handleJoiningFormPersonalChange = (event) => {
    const { name, value } = event.target
    setJoiningForm((current) => ({
      ...current,
      personal_details: {
        ...current.personal_details,
        [name]: value,
      },
    }))
  }

  const handleJoiningFormAddressChange = (event) => {
    const { name, value } = event.target
    setJoiningForm((current) => ({
      ...current,
      address: {
        ...current.address,
        [name]: value,
      },
    }))
  }

  const handleJoiningFormEmergencyChange = (event) => {
    const { name, value } = event.target
    setJoiningForm((current) => ({
      ...current,
      emergency_contact: {
        ...current.emergency_contact,
        [name]: value,
      },
    }))
  }

  const handleJoiningFormSaveDraft = async (event) => {
    event.preventDefault()
    if (!selectedReferralId) {
      setError('Select a referral first')
      return
    }

    resetStatus()
    setJoiningFormLoading(true)

    try {
      const payload = {
        personal_details: joiningForm.personal_details,
        address: joiningForm.address,
        emergency_contact: joiningForm.emergency_contact,
        education_history: joiningForm.education_history,
        employment_history: joiningForm.employment_history,
        government_ids: joiningForm.government_ids,
      }

      await apiRequest(`/referrals/${selectedReferralId}/joining-form/draft`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setMessage('Joining form draft saved')
    } catch (err) {
      setError(err.message)
    } finally {
      setJoiningFormLoading(false)
    }
  }

  const handleJoiningFormSubmit = async (event) => {
    event.preventDefault()
    if (!selectedReferralId) {
      setError('Select a referral first')
      return
    }

    if (!joiningForm.declarations_signed) {
      setError('Please sign the declarations to submit')
      return
    }

    resetStatus()
    setJoiningFormLoading(true)

    try {
      const payload = {
        personal_details: joiningForm.personal_details,
        address: joiningForm.address,
        emergency_contact: joiningForm.emergency_contact,
        education_history: joiningForm.education_history,
        employment_history: joiningForm.employment_history,
        government_ids: joiningForm.government_ids,
        declarations_signed: joiningForm.declarations_signed,
      }

      const submitted = await apiRequest(`/referrals/${selectedReferralId}/joining-form/submit`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setJoiningFormData(submitted)
      setMessage('Joining form submitted for HR review')
      await loadReferralDetails(selectedReferralId)
    } catch (err) {
      setError(err.message)
    } finally {
      setJoiningFormLoading(false)
    }
  }

  const reviewerRoles = new Set(['hr', 'admin'])
  const currentRole = currentUser?.role || ''
  const selectedReferralLoaded = Boolean(selectedReferral)
  const isReferralOwner = Boolean(currentUser && selectedReferral && currentUser.id === selectedReferral.referrer_id)
  const isCandidateForReferral = Boolean(currentUser && selectedReferral && currentUser.id === selectedReferral.candidate_id)
  const isReviewerRole = reviewerRoles.has(currentRole)
  const canIssueNda = selectedReferralLoaded && (isReviewerRole || isReferralOwner)
  const canSignNda = selectedReferralLoaded && (isReviewerRole || isCandidateForReferral)
  const canRejectNda = canSignNda
  const canExpireNda = canIssueNda

  const statusTone = selectedReferral?.state || 'Workflow ready'

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(242,102,34,0.24),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(255,214,102,0.22),_transparent_28%),linear-gradient(180deg,_#08111f_0%,_#0b1220_42%,_#f5f7fb_42%,_#f5f7fb_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/8 p-6 text-white shadow-[0_20px_70px_rgba(2,8,23,0.35)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-100">
                Intern Flow • Backend ready
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
                Referral automation, rebuilt for the internship lifecycle.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                Register users, log in as the referrer, create referrals, run eligibility checks, and drive workflow state transitions from one compact workspace.
              </p>
            </div>
            <div className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200 md:grid-cols-3 lg:min-w-[360px]">
              <div>
                <div className="text-slate-400">Session</div>
                <div className="mt-1 font-semibold">{currentUser ? currentUser.full_name : 'Not signed in'}</div>
              </div>
              <div>
                <div className="text-slate-400">Role</div>
                <div className="mt-1 font-semibold">{currentUser ? currentUser.role : 'Guest'}</div>
              </div>
              <div>
                <div className="text-slate-400">Referral state</div>
                <div className="mt-1 font-semibold">{statusTone}</div>
              </div>
            </div>
          </div>
        </header>

        {(message || error) && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              error
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {error || message}
          </div>
        )}

        <main className="space-y-6">
          {!token || !currentUser ? (
            <AuthSection
              registerForm={registerForm}
              loginForm={loginForm}
              claimForm={claimForm}
              currentUser={currentUser}
              loading={loading}
              roleOptions={ROLE_OPTIONS}
              handleRegister={handleRegister}
              handleRegisterChange={handleRegisterChange}
              handleLogin={handleLogin}
              handleLoginChange={handleLoginChange}
              handleClaimAccount={handleClaimAccount}
              handleClaimChange={handleClaimChange}
              handleLogout={handleLogout}
            />
          ) : currentUser.role === 'referrer' ? (
            <ReferrerDashboard
              token={token}
              loading={loading}
              selectedReferralId={selectedReferralId}
              referralForm={referralForm}
              eligibilityForm={eligibilityForm}
              transitionForm={transitionForm}
              nextStates={NEXT_STATES}
              joiningForm={joiningForm}
              joiningFormData={joiningFormData}
              joiningFormLoading={joiningFormLoading}
              ndaSendForm={ndaSendForm}
              ndaDetails={ndaDetails}
              ndaLoading={ndaLoading}
              currentUserRole={currentUser?.role || ''}
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
          ) : currentUser.role === 'candidate' ? (
            <CandidateDashboard
              token={token}
              currentUser={currentUser}
              setError={setError}
              setMessage={setMessage}
            />
          ) : currentUser.role === 'mentor' ? (
            <MentorDashboard
              token={token}
              currentUser={currentUser}
              setError={setError}
              setMessage={setMessage}
            />
          ) : currentUser.role === 'hr' ? (
            <HRDashboard
              token={token}
              currentUser={currentUser}
              setError={setError}
              setMessage={setMessage}
            />
          ) : currentUser.role === 'manager' ? (
            <ManagerDashboard
              token={token}
              currentUser={currentUser}
              setError={setError}
              setMessage={setMessage}
            />
          ) : (
            <div className="rounded-lg border border-gray-300 bg-gray-50 p-6">
              <h2 className="text-xl font-semibold text-gray-900">Unknown Role</h2>
              <p className="mt-2 text-gray-600">Your role is not recognized. Please contact support.</p>
            </div>
          )}
          <div className="flex justify-end">
            <button
              onClick={handleLogout}
              className="rounded-lg bg-red-600 px-4 py-2 text-white font-semibold hover:bg-red-700 transition"
            >
              Logout
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App

