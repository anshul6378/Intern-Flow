function Info({ label, value, mono = false }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className={`mt-1 text-sm font-semibold text-slate-950 ${mono ? 'break-all font-mono text-[0.8rem]' : ''}`}>{value}</div>
    </div>
  )
}

export default Info
