import { formatCompact } from './format'

type Props = {
  label: string
  /** null renders as an em dash — no data, which is not a count of zero. */
  value: number | string | null
  hint?: string
  /** Optional change against some baseline. The sign is always drawn, so
   *  direction survives without colour; the colour only reinforces it. A bigger
   *  run is the good direction for every figure on this dashboard. */
  delta?: number | null
  deltaLabel?: string
}

/** One tile in the key-details row: a label, a number, and a line of context.
 *
 *  Presentational only — it never fetches. Whatever computes the value owns it.
 */
export default function StatCard({ label, value, hint, delta, deltaLabel }: Props) {
  const shown = typeof value === 'number' ? formatCompact(value) : (value ?? '—')

  return (
    <div className="rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5">
      <p className="text-xs font-semibold tracking-wide text-stone-600 uppercase">{label}</p>

      {/* title carries the exact figure when formatCompact has abbreviated it. */}
      <p
        className="mt-1 text-2xl font-semibold text-stone-900"
        title={typeof value === 'number' ? value.toLocaleString() : undefined}
      >
        {shown}
      </p>

      {delta !== undefined && delta !== null && (
        <p
          className={`mt-0.5 text-xs font-semibold ${
            delta >= 0 ? 'text-sage-700' : 'text-red-700'
          }`}
        >
          {delta >= 0 ? '+' : '−'}
          {formatCompact(Math.abs(delta))}
          {deltaLabel !== undefined && ` ${deltaLabel}`}
        </p>
      )}

      {hint !== undefined && <p className="mt-0.5 text-xs text-stone-600">{hint}</p>}
    </div>
  )
}
