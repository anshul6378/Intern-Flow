/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react'

import ReferrerDashboard from './components/dashboards/ReferrerDashboard'
import CandidateDashboard from './components/dashboards/CandidateDashboard'
import MentorDashboard from './components/dashboards/MentorDashboard'
import HRDashboard from './components/dashboards/HRDashboard'
import ManagerDashboard from './components/dashboards/ManagerDashboard'

const EMPTY_REGISTER = {
  full_name: '',
  email: '',
  employee_id: '',
  password: '',
  role: 'referrer',
}

const EMPTY_LOGIN = {
  email: '',
  password: '',
}

const FIXED_ADMIN_LOGIN = {
  email: 'admin@gmail.com',
  password: 'admin123',
}

const FIXED_HR_LOGIN = {
  email: 'HR@hexaware.com',
  password: 'HR@123',
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

const POPUP_TIMEOUT_MS = 2000

function BrandPulseIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M2 12h4l2-5 3 10 2-6h3l1 2h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PortalRoleIcon({ role, className = 'h-4 w-4' }) {
  if (role === 'candidate') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3.5 18.5c0-2.6 2.2-4.5 5.5-4.5s5.5 1.9 5.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="17.5" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M14.5 18.5c.3-1.9 1.9-3.2 4-3.2 1.2 0 2.2.4 3 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }

  if (role === 'mentor') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M12 3.5l2.5 5.1 5.6.8-4.1 4 1 5.6-5-2.7-5 2.7 1-5.6-4.1-4 5.6-.8L12 3.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    )
  }

  if (role === 'admin') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M12 3l7 3v5.5c0 4.6-3.1 7.8-7 9.5-3.9-1.7-7-4.9-7-9.5V6l7-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="10" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 18.5c0-2.7 2.3-4.5 6-4.5s6 1.8 6 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 7v5M15.5 9.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function App() {
  const [showAuthPanel, setShowAuthPanel] = useState(false)
  const [authPortal, setAuthPortal] = useState('referrer')
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

  useEffect(() => {
    if (!message && !error) {
      return
    }

    const timeoutId = setTimeout(() => {
      setMessage('')
      setError('')
    }, POPUP_TIMEOUT_MS)

    return () => clearTimeout(timeoutId)
  }, [message, error])

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

    let response
    try {
      response = await fetch(`/api/v1${path}`, {
        ...options,
        headers: {
          ...authHeaders,
          ...(options.headers || {}),
        },
      })
    } catch {
      throw new Error('Unable to reach server. Please ensure backend is running and CORS is configured.')
    }

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
      setMessage(`You have been registered as ${registerForm.email}`)
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
    setShowAuthPanel(false)
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

  // Show full-screen dashboard if user is logged in with a valid role
  const isLoggedInWithRole = token && currentUser && ['referrer', 'candidate', 'mentor', 'hr', 'admin', 'manager'].includes(currentUser.role)

  if (isLoggedInWithRole) {
    return (
      <div className="min-h-screen w-full bg-slate-50 text-slate-900">
        {currentUser.role === 'referrer' && (
          <ReferrerDashboard
            token={token}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        )}
        {currentUser.role === 'candidate' && (
          <CandidateDashboard
            token={token}
            currentUser={currentUser}
            setError={setError}
            setMessage={setMessage}
            onLogout={handleLogout}
          />
        )}
        {currentUser.role === 'mentor' && (
          <MentorDashboard
            token={token}
            currentUser={currentUser}
            setError={setError}
            setMessage={setMessage}
            onLogout={handleLogout}
          />
        )}
        {currentUser.role === 'hr' && (
          <HRDashboard
            token={token}
            currentUser={currentUser}
            setError={setError}
            setMessage={setMessage}
            onLogout={handleLogout}
          />
        )}
        {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
          <ManagerDashboard
            token={token}
            currentUser={currentUser}
            setError={setError}
            setMessage={setMessage}
            onLogout={handleLogout}
          />
        )}
      </div>
    )
  }

  const portalItems = [
    { value: 'referrer', label: 'Referrer', description: 'Submit and track internship referrals through the pipeline.' },
    { value: 'candidate', label: 'Candidate', description: 'Complete your joining form, sign your NDA, and track milestones.' },
    { value: 'mentor', label: 'Mentor', description: 'Guide your interns, review project briefs, and confirm start dates.' },
    { value: 'hr', label: 'HR', description: 'Verify onboarding, manage NDA approvals, and run internship operations.' },
    { value: 'admin', label: 'Admin', description: 'Monitor SLA compliance, provision IDs, and generate reports.' },
  ]

  const authThemeByPortal = {
    referrer: {
      accent: '#5a47f5',
      accentSoft: 'rgba(90,71,245,0.16)',
      accentBorder: 'rgba(90,71,245,0.6)',
      tagline: 'Submit and manage candidate referrals.',
      icon: '+',
      loginIcon: '->',
      claimIcon: 'key',
    },
    candidate: {
      accent: '#8b5cf6',
      accentSoft: 'rgba(139,92,246,0.16)',
      accentBorder: 'rgba(139,92,246,0.6)',
      tagline: 'Your account was created by HR — claim it to get started.',
      icon: '+',
      loginIcon: '->',
      claimIcon: 'key',
    },
    mentor: {
      accent: '#0ea5e9',
      accentSoft: 'rgba(14,165,233,0.16)',
      accentBorder: 'rgba(14,165,233,0.6)',
      tagline: 'Your account was assigned by HR — claim it to guide your interns.',
      icon: '+',
      loginIcon: '->',
      claimIcon: 'key',
    },
    hr: {
      accent: '#f59e0b',
      accentSoft: 'rgba(245,158,11,0.16)',
      accentBorder: 'rgba(245,158,11,0.6)',
      tagline: 'Use the fixed HR account to review onboarding and run operations.',
      icon: '+',
      loginIcon: '->',
      claimIcon: 'key',
    },
    admin: {
      accent: '#10b981',
      accentSoft: 'rgba(16,185,129,0.16)',
      accentBorder: 'rgba(16,185,129,0.6)',
      tagline: 'Monitor compliance, SLAs, and platform operations.',
      icon: '+',
      loginIcon: '->',
      claimIcon: 'key',
    },
  }

  const authTheme = authThemeByPortal[authPortal]
  const isClaimPortal = authPortal === 'candidate' || authPortal === 'mentor'
  const isAdminPortal = authPortal === 'admin'
  const isHrPortal = authPortal === 'hr'
  const isFixedCredentialPortal = isAdminPortal || isHrPortal
  const fixedPortalLogin = isAdminPortal ? FIXED_ADMIN_LOGIN : FIXED_HR_LOGIN

  return (
    <div className={showAuthPanel ? 'min-h-screen bg-[#020b2a] text-white' : 'min-h-screen bg-[#e8edf4] text-slate-900'}>
      {showAuthPanel ? (
        <div className="min-h-screen">
          <header className="border-b border-white/10 px-6 py-4">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
              <div className="flex items-center gap-2">
                <BrandPulseIcon className="h-5 w-5 text-indigo-300" />
                <p className="text-3xl font-bold text-indigo-300">Intern Flow</p>
              </div>
              <button
                onClick={() => setShowAuthPanel(false)}
                className="rounded-xl border border-slate-600 bg-transparent px-6 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-400 hover:text-white"
              >
                Back to Home
              </button>
            </div>
          </header>

          <main className="mx-auto w-full max-w-5xl px-4 py-10">
            {(message || error) && (
              <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${error ? 'border-rose-400/60 bg-rose-500/10 text-rose-100' : 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100'}`}>
                {error || message}
              </div>
            )}

            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Select Your Portal</p>
              <div className="mx-auto mt-3 flex w-full max-w-2xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-[#243358] bg-[#111f3f] p-1.5">
                {portalItems.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => {
                      setAuthPortal(item.value)
                      setRegisterForm((current) => ({ ...current, role: item.value }))
                      if (item.value === 'admin') {
                        setLoginForm(FIXED_ADMIN_LOGIN)
                      }
                      if (item.value === 'hr') {
                        setLoginForm(FIXED_HR_LOGIN)
                      }
                      if (item.value === 'candidate' || item.value === 'mentor') {
                        setClaimForm((current) => ({ ...current, role: item.value }))
                      }
                    }}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${authPortal === item.value ? 'text-white shadow-[0_8px_24px_rgba(90,71,245,0.45)]' : 'text-slate-300 hover:bg-[#1a2b52] hover:text-white'}`}
                    style={authPortal === item.value ? { backgroundColor: authTheme.accent } : undefined}
                  >
                    <PortalRoleIcon role={item.value} className="h-4 w-4" />
                    {item.label}
                  </button>
                ))}
              </div>

              <div
                className="mx-auto mt-5 inline-flex rounded-xl border px-6 py-2 text-sm font-medium"
                style={{
                  borderColor: authTheme.accentBorder,
                  color: authTheme.accent,
                  backgroundColor: authTheme.accentSoft,
                }}
              >
                {authTheme.tagline}
              </div>
            </div>

            {isClaimPortal ? (
              <div className="mx-auto mt-7 w-full max-w-2xl">
                <form onSubmit={handleClaimAccount} className="rounded-3xl border border-[#223664] bg-[#101d3f] p-6 shadow-[0_12px_28px_rgba(2,8,31,0.4)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">First Time?</p>
                      <h2 className="mt-1 text-2xl font-bold text-white">Claim your account</h2>
                    </div>
                    <div className="rounded-xl px-3 py-1.5 text-sm font-semibold text-white" style={{ backgroundColor: authTheme.accent }}>
                      {authTheme.claimIcon}
                    </div>
                  </div>

                  <p className="mt-4 max-w-xl text-base text-slate-300">
                    HR has already created your account. Enter your registered email to verify identity and set your password.
                  </p>

                  <div className="mt-6 space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="claim_email">Registered email</label>
                      <input id="claim_email" name="email" type="email" value={claimForm.email} onChange={handleClaimChange} className="w-full rounded-xl border border-[#2d416e] bg-[#1e2d4a] px-4 py-3 text-white outline-none transition placeholder:text-slate-400" placeholder="you@company.com" required />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="claim_identifier">Employee / intern ID</label>
                      <input id="claim_identifier" name="identifier" className="w-full rounded-xl border border-[#2d416e] bg-[#1e2d4a] px-4 py-3 text-white outline-none transition placeholder:text-slate-400" placeholder="e.g. HEX-2025-0042" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="claim_password">Set new password</label>
                      <input id="claim_password" name="password" type="password" value={claimForm.password} onChange={handleClaimChange} className="w-full rounded-xl border border-[#2d416e] bg-[#1e2d4a] px-4 py-3 text-white outline-none transition placeholder:text-slate-400" placeholder="********" required />
                    </div>
                  </div>

                  <button disabled={loading} className="mt-5 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-60" style={{ backgroundColor: authTheme.accent }}>
                    {loading ? 'Working...' : 'Claim account'}
                  </button>

                  <p className="mt-5 text-center text-sm text-slate-400">
                    Don't have an account yet? <span style={{ color: authTheme.accent }} className="font-semibold">Contact HR</span>
                  </p>
                </form>
              </div>
            ) : (
              <div className={`mt-7 grid gap-4 ${isFixedCredentialPortal ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
                {!isFixedCredentialPortal && (
                <form onSubmit={handleRegister} className="rounded-3xl border border-[#223664] bg-[#101d3f] p-5 shadow-[0_12px_28px_rgba(2,8,31,0.4)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">New User</p>
                      <h2 className="mt-1 text-2xl font-bold text-white">Register</h2>
                    </div>
                    <div className="rounded-xl px-3 py-1.5 text-base font-bold text-white" style={{ backgroundColor: authTheme.accent }}>{authTheme.icon}</div>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="register_full_name">Full name</label>
                      <input id="register_full_name" name="full_name" value={registerForm.full_name} onChange={handleRegisterChange} className="w-full rounded-xl border border-[#2d416e] bg-[#1e2d4a] px-4 py-3 text-white outline-none transition placeholder:text-slate-400" placeholder="e.g. Priya Sharma" required />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="register_email">Email</label>
                      <input id="register_email" name="email" type="email" value={registerForm.email} onChange={handleRegisterChange} className="w-full rounded-xl border border-[#2d416e] bg-[#1e2d4a] px-4 py-3 text-white outline-none transition placeholder:text-slate-400" placeholder="you@company.com" required />
                    </div>
                    {registerForm.role === 'referrer' && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="register_employee_id">Employee ID</label>
                        <input id="register_employee_id" name="employee_id" value={registerForm.employee_id} onChange={handleRegisterChange} className="w-full rounded-xl border border-[#2d416e] bg-[#1e2d4a] px-4 py-3 text-white outline-none transition placeholder:text-slate-400" placeholder="e.g. HEX-1024" required />
                      </div>
                    )}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="register_password">Password</label>
                      <input id="register_password" name="password" type="password" value={registerForm.password} onChange={handleRegisterChange} className="w-full rounded-xl border border-[#2d416e] bg-[#1e2d4a] px-4 py-3 text-white outline-none transition placeholder:text-slate-400" placeholder="********" required />
                    </div>
                  </div>

                  <button disabled={loading} className="mt-5 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-60" style={{ backgroundColor: authTheme.accent }}>
                    {loading ? 'Working...' : 'Create account'}
                  </button>
                </form>
                )}

                <form onSubmit={handleLogin} className="rounded-3xl border border-[#223664] bg-[#101d3f] p-5 shadow-[0_12px_28px_rgba(2,8,31,0.4)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{isFixedCredentialPortal ? (isAdminPortal ? 'General Admin' : 'General HR') : 'Existing'}</p>
                      <h2 className="mt-1 text-2xl font-bold text-white">Sign In</h2>
                    </div>
                    <div className="rounded-xl px-3 py-1.5 text-base font-bold text-white" style={{ backgroundColor: authTheme.accent }}>{authTheme.loginIcon}</div>
                  </div>

                  {isFixedCredentialPortal && (
                    <p className="mt-4 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                      {isAdminPortal
                        ? 'A single general admin account is used for all approvals.'
                        : 'A single general HR account is used for HR operations.'}
                    </p>
                  )}

                  <div className="mt-6 space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="login_email">Email</label>
                      <input id="login_email" name="email" type="email" value={isFixedCredentialPortal ? fixedPortalLogin.email : loginForm.email} onChange={handleLoginChange} className="w-full rounded-xl border border-[#2d416e] bg-[#1e2d4a] px-4 py-3 text-white outline-none transition placeholder:text-slate-400" placeholder="you@company.com" required readOnly={isFixedCredentialPortal} />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="login_password">Password</label>
                      <input id="login_password" name="password" type="password" value={isFixedCredentialPortal ? fixedPortalLogin.password : loginForm.password} onChange={handleLoginChange} className="w-full rounded-xl border border-[#2d416e] bg-[#1e2d4a] px-4 py-3 text-white outline-none transition placeholder:text-slate-400" placeholder="********" required readOnly={isFixedCredentialPortal} />
                    </div>
                  </div>

                  <div className="mt-5 text-right text-sm text-slate-400">Forgot password?</div>

                  <button disabled={loading} className="mt-5 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-60" style={{ backgroundColor: authTheme.accent }}>
                    {loading ? 'Working...' : 'Sign in'}
                  </button>
                </form>
              </div>
            )}
          </main>
        </div>
      ) : (
        <div className="flex min-h-screen">
          <aside className="w-full max-w-[255px] bg-[#0a1533] text-white">
            <div className="border-b border-white/10 px-6 py-7">
              <div className="flex items-center gap-2">
                <BrandPulseIcon className="h-5 w-5 text-indigo-300" />
                <p className="text-3xl font-bold text-indigo-300">Intern Flow</p>
              </div>
              <p className="mt-2 text-sm text-slate-400">Hexaware Technologies</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Platform Stats</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#142447] p-3">
                  <p className="text-2xl font-bold">11</p>
                  <p className="mt-1 text-xs text-slate-400">Active Interns</p>
                </div>
                <div className="rounded-xl bg-[#142447] p-3">
                  <p className="text-2xl font-bold">24</p>
                  <p className="mt-1 text-xs text-slate-400">Open Referrals</p>
                </div>
                <div className="rounded-xl bg-[#142447] p-3">
                  <p className="text-2xl font-bold">5</p>
                  <p className="mt-1 text-xs text-slate-400">Pending Actions</p>
                </div>
                <div className="rounded-xl bg-[#142447] p-3">
                  <p className="text-2xl font-bold">92%</p>
                  <p className="mt-1 text-xs text-slate-400">SLA Compliance</p>
                </div>
              </div>
            </div>
          </aside>

          <main className="flex-1 px-6 py-6">
            {(message || error) && (
              <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${error ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                {error || message}
              </div>
            )}

            <div className="flex flex-wrap items-start gap-3">
              <div>
                <h1 className="text-[34px] font-black leading-none text-[#1d2940]">Welcome to Intern Flow</h1>
                <p className="mt-1.5 text-sm text-slate-500">Select your role to continue</p>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-300 pt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Choose Your Portal</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {portalItems.map((item) => (
                  <button key={item.value} onClick={() => { setAuthPortal(item.value); setShowAuthPanel(true); setRegisterForm((current) => ({ ...current, role: item.value })); if (item.value === 'admin') { setLoginForm(FIXED_ADMIN_LOGIN) } if (item.value === 'hr') { setLoginForm(FIXED_HR_LOGIN) } if (item.value === 'candidate' || item.value === 'mentor') { setClaimForm((current) => ({ ...current, role: item.value })) } }} className="rounded-3xl border border-slate-300 bg-[#f5f8fc] p-4 text-left shadow-sm transition hover:shadow-md">
                    <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-indigo-500">
                      <PortalRoleIcon role={item.value} className="h-4 w-4" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">{item.label}</h3>
                    <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-7 grid gap-4 lg:grid-cols-2">
              <section className="rounded-3xl border border-slate-300 bg-[#f5f8fc] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">How It Works</p>
                <div className="relative mt-3 grid gap-2.5 sm:grid-cols-2">
                  <div className="min-h-[148px] rounded-2xl border border-indigo-200 bg-indigo-50/80 p-3 text-center">
                    <div className="mx-auto mb-1.5 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-200 bg-white text-indigo-500">
                      <PortalRoleIcon role="referrer" className="h-4 w-4" />
                    </div>
                    <p className="mx-auto inline-flex rounded-md bg-indigo-100 px-1.5 py-0.5 text-xs font-bold text-indigo-700">01</p>
                    <p className="mt-1.5 text-base font-semibold text-slate-900">Referrer submits</p>
                    <p className="mt-0.5 text-xs text-slate-600">Nominates a candidate</p>
                  </div>

                  <div className="min-h-[148px] rounded-2xl border border-violet-200 bg-violet-50/80 p-3 text-center">
                    <div className="mx-auto mb-1.5 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-violet-200 bg-white text-violet-500">
                      <PortalRoleIcon role="candidate" className="h-4 w-4" />
                    </div>
                    <p className="mx-auto inline-flex rounded-md bg-violet-100 px-1.5 py-0.5 text-xs font-bold text-violet-700">02</p>
                    <p className="mt-1.5 text-base font-semibold text-slate-900">Candidate onboards</p>
                    <p className="mt-0.5 text-xs text-slate-600">Form, NDA and documents</p>
                  </div>

                  <div className="min-h-[148px] rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-center">
                    <div className="mx-auto mb-1.5 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-500">
                      <PortalRoleIcon role="admin" className="h-4 w-4" />
                    </div>
                    <p className="mx-auto inline-flex rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-700">04</p>
                    <p className="mt-1.5 text-base font-semibold text-slate-900">Admin closes loop</p>
                    <p className="mt-0.5 text-xs text-slate-600">Certifies and archives</p>
                  </div>

                  <div className="min-h-[148px] rounded-2xl border border-sky-200 bg-sky-50/80 p-3 text-center">
                    <div className="mx-auto mb-1.5 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-sky-200 bg-white text-sky-500">
                      <PortalRoleIcon role="mentor" className="h-4 w-4" />
                    </div>
                    <p className="mx-auto inline-flex rounded-md bg-sky-100 px-1.5 py-0.5 text-xs font-bold text-sky-700">03</p>
                    <p className="mt-1.5 text-base font-semibold text-slate-900">Mentor guides</p>
                    <p className="mt-0.5 text-xs text-slate-600">Tracks intern progress</p>
                  </div>

                  <div className="pointer-events-none absolute left-1/2 top-[24%] hidden -translate-x-1/2 text-4xl font-black text-slate-500 sm:block">-&gt;</div>
                  <div className="pointer-events-none absolute left-[75%] top-1/2 hidden -translate-x-1/2 -translate-y-1/2 text-4xl font-black text-slate-500 sm:block">v</div>
                  <div className="pointer-events-none absolute left-1/2 top-[76%] hidden -translate-x-1/2 text-4xl font-black text-slate-500 sm:block">&lt;-</div>
                </div>
              </section>

              <section className="rounded-3xl bg-[#0d193b] p-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">About The Platform</p>
                <p className="mt-3 text-lg leading-7 text-slate-200">
                  Intern Flow is a centralized, workflow-driven platform to digitize and govern end-to-end
                  internship operations, replacing fragmented email with secure and auditable automation.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-[#1a2b52] p-3">
                    <p className="text-2xl font-bold text-indigo-300">80%+</p>
                    <p className="text-sm text-slate-300">Faster cycle</p>
                  </div>
                  <div className="rounded-xl bg-[#1a2b52] p-3">
                    <p className="text-2xl font-bold text-indigo-300">100%</p>
                    <p className="text-sm text-slate-300">NDA compliance</p>
                  </div>
                  <div className="rounded-xl bg-[#1a2b52] p-3">
                    <p className="text-2xl font-bold text-indigo-300">95%+</p>
                    <p className="text-sm text-slate-300">Data accuracy</p>
                  </div>
                  <div className="rounded-xl bg-[#1a2b52] p-3">
                    <p className="text-2xl font-bold text-indigo-300">1 Day</p>
                    <p className="text-sm text-slate-300">ID provisioning</p>
                  </div>
                </div>
              </section>
            </div>
          </main>
        </div>
      )}
    </div>
  )
}

export default App

