import { useState } from 'react'

function HRDashboard({ token, currentUser, setError, setMessage }) {
  const [activeTab, setActiveTab] = useState('queue')
  const [loading, setLoading] = useState(false)

  const mockWorkflowQueue = [
    {
      id: '1',
      candidate_name: 'John Doe',
      candidate_email: 'john@example.com',
      status: 'JOINING_FORM_SUBMITTED',
      task: 'Review Joining Form',
      dueDate: '2026-05-25',
      priority: 'high',
    },
    {
      id: '2',
      candidate_name: 'Jane Smith',
      candidate_email: 'jane@example.com',
      status: 'NDA_SIGNED',
      task: 'Generate Non-Worker ID',
      dueDate: '2026-05-26',
      priority: 'medium',
    },
    {
      id: '3',
      candidate_name: 'Bob Johnson',
      candidate_email: 'bob@example.com',
      status: 'NON_WORKER_ID_PENDING',
      task: 'Provision Access & Send Credentials',
      dueDate: '2026-05-27',
      priority: 'low',
    },
  ]

  const mockCompletedTasks = [
    {
      id: '4',
      candidate_name: 'Alice Brown',
      candidate_email: 'alice@example.com',
      task: 'Generated Non-Worker ID',
      completedDate: '2026-05-20',
    },
    {
      id: '5',
      candidate_name: 'Charlie Davis',
      candidate_email: 'charlie@example.com',
      task: 'Access Provisioned',
      completedDate: '2026-05-19',
    },
  ]

  const getPriorityColor = (priority) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800',
    }
    return colors[priority] || 'bg-gray-100 text-gray-800'
  }

  const handleTaskComplete = async (taskId) => {
    try {
      setLoading(true)
      setMessage(`Task completed successfully`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <h2 className="text-xl font-semibold text-indigo-900">HR Dashboard</h2>
        <p className="text-indigo-700 mt-1">Manage joining forms, non-worker IDs, and access provisioning</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm font-semibold">Pending Tasks</p>
          <p className="text-2xl font-bold text-red-600 mt-2">{mockWorkflowQueue.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm font-semibold">High Priority</p>
          <p className="text-2xl font-bold text-orange-600 mt-2">
            {mockWorkflowQueue.filter((t) => t.priority === 'high').length}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm font-semibold">Completed This Week</p>
          <p className="text-2xl font-bold text-green-600 mt-2">{mockCompletedTasks.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm font-semibold">SLA Compliance</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">98%</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex-1 px-4 py-3 font-semibold transition ${
              activeTab === 'queue'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Workflow Queue ({mockWorkflowQueue.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 px-4 py-3 font-semibold transition ${
              activeTab === 'completed'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Completed Tasks ({mockCompletedTasks.length})
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'queue' && (
            <div className="space-y-3">
              {mockWorkflowQueue.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No pending tasks.</p>
              ) : (
                mockWorkflowQueue.map((task) => (
                  <div key={task.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-gray-900">{task.candidate_name}</h4>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(task.priority)}`}>
                            {task.priority.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm">{task.candidate_email}</p>
                        <p className="text-gray-700 text-sm mt-2">
                          <span className="font-semibold">Task:</span> {task.task}
                        </p>
                        <p className="text-gray-600 text-sm mt-1">
                          <span className="font-semibold">Current Status:</span> {task.status}
                        </p>
                        <p className="text-gray-600 text-sm">
                          <span className="font-semibold">Due:</span> {task.dueDate}
                        </p>
                      </div>
                      <button
                        onClick={() => handleTaskComplete(task.id)}
                        disabled={loading}
                        className="ml-4 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition disabled:bg-gray-400 whitespace-nowrap"
                      >
                        Mark Complete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'completed' && (
            <div className="space-y-3">
              {mockCompletedTasks.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No completed tasks yet.</p>
              ) : (
                mockCompletedTasks.map((task) => (
                  <div key={task.id} className="border border-green-200 bg-green-50 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">{task.candidate_name}</h4>
                        <p className="text-gray-600 text-sm">{task.candidate_email}</p>
                        <p className="text-gray-700 text-sm mt-2">
                          <span className="font-semibold">Task:</span> {task.task}
                        </p>
                        <p className="text-green-700 text-sm">
                          <span className="font-semibold">Completed:</span> {task.completedDate}
                        </p>
                      </div>
                      <span className="text-2xl">✓</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default HRDashboard
