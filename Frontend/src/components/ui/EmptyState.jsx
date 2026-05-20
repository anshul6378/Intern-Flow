function EmptyState({ title, description }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
      <div className="font-semibold text-slate-900">{title}</div>
      <p className="mt-2 leading-6">{description}</p>
    </div>
  )
}

export default EmptyState
