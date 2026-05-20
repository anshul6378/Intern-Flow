function CheckboxField({ label, ...props }) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
      <input {...props} type="checkbox" className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-950/20" />
      <span>{label}</span>
    </label>
  )
}

export default CheckboxField
