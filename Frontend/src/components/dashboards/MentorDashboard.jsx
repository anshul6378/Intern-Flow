import { useState } from 'react'

function MentorDashboard({ token, currentUser, setError, setMessage }) {
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedReferral, setSelectedReferral] = useState(null)

  const mockReferrals = [
    {
      id: '1',
      candidate_name: 'John Doe',
      candidate_email: 'john@example.com',
      start_date: '2026-06-01',
      end_date: '2026-08-31',
      status: 'ELIGIBILITY_REVIEW',
      project: 'Mobile App Development',
    },
    {
      id: '2',
      candidate_name: 'Jane Smith',
      candidate_email: 'jane@example.com',
      start_date: '2026-07-01',
      end_date: '2026-09-30',
      status: 'JOINING_FORM_PENDING',
      project: 'Cloud Infrastructure',
    },
  ]

  const handleApproveReferral = async (referralId) => {
    try {
      setLoading(true)
      // API call would go here
      setMessage(`Referral ${referralId} approved`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRejectReferral = async (referralId) => {
    try {
      setLoading(true)
      // API call would go here
      setMessage(`Referral ${referralId} rejected`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      ELIGIBILITY_REVIEW: 'bg-yellow-100 text-yellow-800',
      JOINING_FORM_PENDING: 'bg-blue-100 text-blue-800',
      IN_PROGRESS: 'bg-green-100 text-green-800',
      COMPLETED: 'bg-gray-100 text-gray-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h2 className="text-xl font-semibold text-purple-900">Mentor Dashboard</h2>
        <p className="text-purple-700 mt-1">Approve referrals and manage on-the-job training for your candidates</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm font-semibold">Pending Approval</p>
          <p className="text-2xl font-bold text-purple-600 mt-2">2</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm font-semibold">In Progress</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">1</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm font-semibold">Completed</p>
          <p className="text-2xl font-bold text-green-600 mt-2">3</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm font-semibold">Total Mentured</p>
          <p className="text-2xl font-bold text-gray-600 mt-2">6</p>
        </div>
      </div>

      {/* Referrals List */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Candidate Referrals</h3>

        <div className="space-y-4">
          {mockReferrals.map((referral) => (
            <div
              key={referral.id}
              onClick={() => setSelectedReferral(selectedReferral?.id === referral.id ? null : referral)}
              className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 cursor-pointer transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">{referral.candidate_name}</h4>
                  <p className="text-gray-600 text-sm">{referral.candidate_email}</p>
                  <p className="text-gray-600 text-sm mt-1">
                    <span className="font-semibold">Project:</span> {referral.project}
                  </p>
                  <p className="text-gray-600 text-sm">
                    <span className="font-semibold">Duration:</span> {referral.start_date} to {referral.end_date}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getStatusColor(referral.status)}`}>
                  {referral.status}
                </span>
              </div>

              {selectedReferral?.id === referral.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                  {referral.status === 'ELIGIBILITY_REVIEW' && (
                    <div>
                      <p className="text-sm text-gray-600 mb-3">Review eligibility criteria and approve or reject:</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveReferral(referral.id)}
                          disabled={loading}
                          className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition disabled:bg-gray-400"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectReferral(referral.id)}
                          disabled={loading}
                          className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition disabled:bg-gray-400"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {referral.status === 'IN_PROGRESS' && (
                    <div>
                      <p className="text-sm text-gray-600 mb-3">Add on-the-job training notes:</p>
                      <textarea
                        placeholder="Enter training progress, feedback, or notes here..."
                        className="w-full border border-gray-300 rounded p-2 text-sm"
                        rows="3"
                      />
                      <button className="mt-2 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition">
                        Save Notes
                      </button>
                    </div>
                  )}

                  {referral.status === 'COMPLETED' && (
                    <div className="bg-green-50 border border-green-200 rounded p-3">
                      <p className="text-green-800 text-sm">This internship has been completed. Great work!</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default MentorDashboard
