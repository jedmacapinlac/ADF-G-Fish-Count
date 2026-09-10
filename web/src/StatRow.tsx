import { formatCompact } from './format'

type Props = {
  label: string
  /** null renders as an em dash, the same "no data" convention StatCard.tsx
   *  uses for the compact cards above this panel. */
  value: number | string | null
  description?: string
  delta?: number | null
  deltaLabel?: string
  icon: React.ComponentType<{ className?: string }>
  /** Show the exact number (1,234,567) instead of the abbreviated form
   *  (1.2M). StatCard's compact form exists to keep a square tile from
   *  outgrowing it — this row has plenty of width to spare, so exact counts
   *  read better here. */
  exact?: boolean
}

/** One row in a StatGroup: an icon, a label and value on the left, a full
 *  sentence of explanation on the right. Built for the Statistics tab's
 *  longer descriptions, which don't fit StatCard's square tile (that shape
 *  is for KeyDetails' one-line hints, not a paragraph). */
export default function StatRow({ label, value, description, delta, deltaLabel, icon: Icon, exact = false }: Props) {
  const shown = typeof value !== 'number' ? (value ?? '—') : exact ? value.toLocaleString() : formatCompact(value)

  return (
    <div className="flex flex-col gap-2 border-b border-stone-200 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex shrink-0 items-center gap-3 sm:w-60">
        <Icon className="h-5 w-5 shrink-0 text-stone-400" />
        <div>
          <p className="text-xs font-semibold tracking-wide text-stone-600 uppercase">{label}</p>
          <p
            className="text-xl font-semibold text-stone-900"
            title={typeof value === 'number' && !exact ? value.toLocaleString() : undefined}
          >
            {shown}
            {delta !== undefined && delta !== null && (
              <span className={`ml-2 text-xs font-semibold ${delta >= 0 ? 'text-sage-700' : 'text-red-700'}`}>
                {delta >= 0 ? '+' : '−'}
                {formatCompact(Math.abs(delta))}
                {deltaLabel !== undefined && ` ${deltaLabel}`}
              </span>
            )}
          </p>
        </div>
      </div>

      {description !== undefined && <p className="min-w-0 max-w-2xl flex-1 text-sm text-stone-600">{description}</p>}
    </div>
  )
}
