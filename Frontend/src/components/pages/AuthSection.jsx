import Card from '../ui/Card'
import EmptyState from '../ui/EmptyState'
import Field from '../ui/Field'
import Info from '../ui/Info'
import SelectField from '../ui/SelectField'

function AuthSection({
  registerForm,
  loginForm,
  claimForm,
  currentUser,
  loading,
  roleOptions,
  handleRegister,
  handleRegisterChange,
  handleLogin,
  handleLoginChange,
  handleClaimAccount,
  handleClaimChange,
  handleLogout,
}) {
  return (
    <section className="space-y-6">
      <Card title="Create access" eyebrow="Authentication">
        <div className="grid gap-4 md:grid-cols-3">
          <form className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4" onSubmit={handleRegister}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Register user</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Step 1</span>
            </div>
            <Field label="Full name" name="full_name" value={registerForm.full_name} onChange={handleRegisterChange} />
            <Field label="Email" name="email" type="email" value={registerForm.email} onChange={handleRegisterChange} />
            <Field label="Password" name="password" type="password" value={registerForm.password} onChange={handleRegisterChange} />
            <SelectField label="Role" name="role" value={registerForm.role} onChange={handleRegisterChange} options={roleOptions} />
            <button className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60" disabled={loading}>
              {loading ? 'Working...' : 'Register user'}
            </button>
          </form>

          <form className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4" onSubmit={handleLogin}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Sign in</h3>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">Step 2</span>
            </div>
            <Field label="Email" name="email" type="email" value={loginForm.email} onChange={handleLoginChange} />
            <Field label="Password" name="password" type="password" value={loginForm.password} onChange={handleLoginChange} />
            <button className="w-full rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-60" disabled={loading}>
              {loading ? 'Working...' : 'Log in'}
            </button>
            {currentUser && (
              <button type="button" onClick={handleLogout} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Log out
              </button>
            )}
          </form>

          <form className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4" onSubmit={handleClaimAccount}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Claim account</h3>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">Candidate/Mentor</span>
            </div>
            <Field label="Email" name="email" type="email" value={claimForm.email} onChange={handleClaimChange} />
            <Field label="New password" name="password" type="password" value={claimForm.password} onChange={handleClaimChange} />
            <SelectField
              label="Role"
              name="role"
              value={claimForm.role}
              onChange={handleClaimChange}
              options={[
                { value: 'candidate', label: 'Candidate' },
                { value: 'mentor', label: 'Mentor' },
              ]}
            />
            <button className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60" disabled={loading}>
              {loading ? 'Working...' : 'Claim account'}
            </button>
          </form>
        </div>
      </Card>

      <Card title="Session details" eyebrow="Current user">
        {currentUser ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Info label="User ID" value={currentUser.id} mono />
            <Info label="Email" value={currentUser.email} />
            <Info label="Full name" value={currentUser.full_name} />
            <Info label="Role" value={currentUser.role} />
            <Info label="Department" value={currentUser.department || 'Not set'} />
            <Info label="Active" value={currentUser.is_active ? 'Yes' : 'No'} />
          </div>
        ) : (
          <EmptyState title="No authenticated session" description="Register a user, then sign in to unlock referral creation and timeline tracking." />
        )}
      </Card>
    </section>
  )
}

export default AuthSection
