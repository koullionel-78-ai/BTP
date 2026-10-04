export default function Progression({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 rounded bg-gray-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded bg-chantier" style={{ width: `${pct}%` }} />
    </div>
  )
}
