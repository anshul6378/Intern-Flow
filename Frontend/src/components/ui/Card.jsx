function Card({ title, eyebrow, children }) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.08)]">
      <div className="mb-4">
        <div className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-amber-600">{eyebrow}</div>
        <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  )
}

export default Card
