import { useState } from 'react'

function CandidateDashboard({ token, currentUser, setError, setMessage }) {
  const [activeTask, setActiveTask] = useState('joining-form')

  const tasks = [
    {
      id: 'joining-form',
      title: 'Joining Form',
      status: 'pending',
      description: 'Complete your personal details and employment history',
      icon: '📋',
    },
    {
      id: 'nda',
      title: 'NDA Signing',
      status: 'pending',
      description: 'Review and sign the Non-Disclosure Agreement',
      icon: '📝',
    },
    {
      id: 'non-worker-id',
      title: 'Non-Worker ID',
      status: 'pending',
      description: 'Receive and verify your non-worker identification',
      icon: '🆔',
    },
    {
      id: 'certificate',
      title: 'Completion Certificate',
      status: 'pending',
      description: 'Request certificate upon internship completion',
      icon: '🏆',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h2 className="text-xl font-semibold text-green-900">Candidate Dashboard</h2>
        <p className="text-green-700 mt-1">Welcome, {currentUser?.full_name}! Complete your internship onboarding tasks below</p>
      </div>

      {/* Task Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => setActiveTask(task.id)}
            className={`p-4 rounded-lg border-2 transition text-left ${
              activeTask === task.id
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-white hover:border-green-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">{task.icon}</span>
                  {task.title}
                </h3>
                <p className="text-gray-600 text-sm mt-1">{task.description}</p>
              </div>
              <span
                className={`px-2 py-1 rounded text-xs font-semibold ${
                  task.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : task.status === 'in-progress'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Task Details */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {activeTask === 'joining-form' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Joining Form</h3>
            <p className="text-gray-600 mb-4">Please complete your joining form with accurate information.</p>
            <button
              onClick={() => setMessage('Joining form feature coming soon')}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
            >
              Start Joining Form
            </button>
          </div>
        )}

        {activeTask === 'nda' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Non-Disclosure Agreement</h3>
            <p className="text-gray-600 mb-4">Review the NDA terms and sign electronically using DocuSign.</p>
            <button
              onClick={() => setMessage('NDA signing feature coming soon')}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
            >
              Review & Sign NDA
            </button>
          </div>
        )}

        {activeTask === 'non-worker-id' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Non-Worker ID</h3>
            <p className="text-gray-600 mb-4">Your non-worker ID will be issued once all form submissions are reviewed by HR.</p>
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-blue-800 text-sm">Status: Waiting for form submissions to be reviewed</p>
            </div>
          </div>
        )}

        {activeTask === 'certificate' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Completion Certificate</h3>
            <p className="text-gray-600 mb-4">You can request a completion certificate after your internship ends.</p>
            <button
              onClick={() => setMessage('Certificate request feature coming soon')}
              className="bg-gray-400 text-white px-4 py-2 rounded cursor-not-allowed"
              disabled
            >
              Request Certificate (Disabled until completion)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default CandidateDashboard
