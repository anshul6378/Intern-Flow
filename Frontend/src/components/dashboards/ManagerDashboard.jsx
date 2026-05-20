import { useState } from 'react'

function ManagerDashboard({ token, currentUser, setError, setMessage }) {
  const [timeframe, setTimeframe] = useState('month')

  const mockMetrics = {
    totalReferrals: 12,
    activeInternships: 5,
    completedInternships: 7,
    averageRating: 4.5,
    slaCompliance: 98,
    processTime: '5 days', // Average processing time
  }

  const mockRecentReferrals = [
    {
      id: '1',
      candidate: 'John Doe',
      position: 'Mobile App Development',
      status: 'IN_PROGRESS',
      startDate: '2026-06-01',
      referrer: 'Alice Johnson',
    },
    {
      id: '2',
      candidate: 'Jane Smith',
      position: 'Cloud Infrastructure',
      status: 'READY_TO_START',
      startDate: '2026-07-01',
      referrer: 'Bob Smith',
    },
    {
      id: '3',
      candidate: 'Bob Johnson',
      position: 'Data Analytics',
      status: 'CLOSED',
      startDate: '2026-05-01',
      referrer: 'Charlie Davis',
    },
  ]

  const getStatusColor = (status) => {
    const colors = {
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      READY_TO_START: 'bg-yellow-100 text-yellow-800',
      CLOSED: 'bg-green-100 text-green-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h2 className="text-xl font-semibold text-amber-900">Manager Dashboard</h2>
        <p className="text-amber-700 mt-1">Monitor internship program metrics and performance</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="text-gray-600 text-sm font-semibold">Total Referrals</p>
          <p className="text-3xl font-bold text-amber-600 mt-2">{mockMetrics.totalReferrals}</p>
          <p className="text-gray-600 text-xs mt-2">Across all referrers</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="text-gray-600 text-sm font-semibold">Active Internships</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{mockMetrics.activeInternships}</p>
          <p className="text-gray-600 text-xs mt-2">Currently underway</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="text-gray-600 text-sm font-semibold">Completion Rate</p>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {Math.round((mockMetrics.completedInternships / mockMetrics.totalReferrals) * 100)}%
          </p>
          <p className="text-gray-600 text-xs mt-2">
            {mockMetrics.completedInternships} of {mockMetrics.totalReferrals} completed
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="text-gray-600 text-sm font-semibold">Average Rating</p>
          <p className="text-3xl font-bold text-purple-600 mt-2">{mockMetrics.averageRating}</p>
          <p className="text-gray-600 text-xs mt-2">★★★★☆</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="text-gray-600 text-sm font-semibold">SLA Compliance</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{mockMetrics.slaCompliance}%</p>
          <p className="text-gray-600 text-xs mt-2">On-time processing</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="text-gray-600 text-sm font-semibold">Avg. Processing Time</p>
          <p className="text-3xl font-bold text-indigo-600 mt-2">{mockMetrics.processTime}</p>
          <p className="text-gray-600 text-xs mt-2">From referral to start</p>
        </div>
      </div>

      {/* Recent Referrals */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Referrals</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Candidate</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Position</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Referrer</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Start Date</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockRecentReferrals.map((referral) => (
                <tr key={referral.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm text-gray-900 font-medium">{referral.candidate}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{referral.position}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{referral.referrer}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{referral.startDate}</td>
                  <td className="py-3 px-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(referral.status)}`}>
                      {referral.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Performance Notes */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Performance Summary</h3>
        <ul className="space-y-1 text-blue-800 text-sm">
          <li>• Program is on track with strong completion rates and SLA compliance</li>
          <li>• Average processing time of {mockMetrics.processTime} is within target</li>
          <li>• All active internships are progressing well with positive feedback</li>
          <li>• Consider scaling up referral capacity based on current performance</li>
        </ul>
      </div>
    </div>
  )
}

export default ManagerDashboard
