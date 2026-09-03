import { formatDate } from './format'
import { useApi } from './useApi'
import type { CountRow } from './types'

type Props = {
  locationId: number
  speciesId: number
  year: number
}

const SAGE = '#59784a'
const PERCENTILES = [10, 25, 50, 75, 90]

const WIDTH = 480
const HEIGHT = 260
const MARGIN = { left: 28, right: 28 }
const BASELINE_Y = 130

type Milestone = {
  pct: number
  date: string
}

/** The calendar date each percentile of the season's total was reached —
 *  the first day the running total meets or passes that share. A single
 *  huge day can clear more than one threshold at once, which is fine: two
 *  milestones just land on the same date, handled by the label layout below
 *  rather than by the math. */
function computeMilestones(rows: CountRow[]): Milestone[] {
  const counted = rows.filter(
    (r): r is { count_date: string; fish_count: number } => r.fish_count !== null,
  )
  const total = counted.reduce((sum, r) => sum + r.fish_count, 0)
  if (total <= 0) return []

  const milestones: Milestone[] = []
  let running = 0
  let next = 0
  for (const row of counted) {
    running += row.fish_count
    while (next < PERCENTILES.length && running >= (PERCENTILES[next] / 100) * total) {
      milestones.push({ pct: PERCENTILES[next], date: row.count_date })
      next++
    }
  }
  return milestones
}

/** "Run timing milestones": for one season, the actual calendar dates at
 *  which 10/25/50/75/90% of the total run had passed — a horizontal
 *  timeline rather than a line chart, since the thing being shown is a set
 *  of dates, not a trend over time. Positioned by real elapsed days between
 *  the season's first and last counted day, not by row index, so a gap in
 *  counting reads as the same gap in space. */
export default function TimingMilestonesChart({ locationId, speciesId, year }: Props) {
  const { data, error } = useApi<CountRow[]>(
    `/api/counts?location_id=${locationId}&species_id=${speciesId}&year_from=${year}&year_to=${year}`,
  )

  if (error !== null) return <p className="font-mono text-sm text-red-700">{error}</p>
  if (data === null) return <p className="text-sm text-stone-700">Loading…</p>

  const counted = data.filter((r) => r.fish_count !== null)
  const milestones = computeMilestones(data)

  if (counted.length === 0 || milestones.length === 0) {
    return <p className="text-sm text-stone-700">No counted days in {year}.</p>
  }

  const firstDate = counted[0].count_date
  const lastDate = counted[counted.length - 1].count_date
  const firstMs = new Date(`${firstDate}T00:00:00Z`).getTime()
  const lastMs = new Date(`${lastDate}T00:00:00Z`).getTime()
  const span = lastMs - firstMs || 1
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right

  const xFor = (date: string) => {
    const t = new Date(`${date}T00:00:00Z`).getTime()
    return MARGIN.left + ((t - firstMs) / span) * plotWidth
  }

  const tenPct = milestones.find((m) => m.pct === 10)
  const ninetyPct = milestones.find((m) => m.pct === 90)
  const middleSpanDays =
    tenPct !== undefined && ninetyPct !== undefined
      ? Math.round(
          (new Date(`${ninetyPct.date}T00:00:00Z`).getTime() - new Date(`${tenPct.date}T00:00:00Z`).getTime()) /
            86_400_000,
        )
      : null

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full" role="img" aria-label={`Run timing milestones for ${year}`}>
        {tenPct !== undefined && ninetyPct !== undefined && (
          <rect
            x={xFor(tenPct.date)}
            y={BASELINE_Y - 6}
            width={xFor(ninetyPct.date) - xFor(tenPct.date)}
            height={12}
            rx={3}
            fill={SAGE}
            opacity={0.12}
          />
        )}
        <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={BASELINE_Y} y2={BASELINE_Y} stroke="#c3c2b7" strokeWidth={1} />

        <text x={MARGIN.left} y={BASELINE_Y + 22} textAnchor="start" className="fill-stone-500" fontSize={10}>
          {formatDate(firstDate, { year: true })}
        </text>
        <text x={WIDTH - MARGIN.right} y={BASELINE_Y + 22} textAnchor="end" className="fill-stone-500" fontSize={10}>
          {formatDate(lastDate, { year: true })}
        </text>

        {milestones.map((m, i) => {
          const x = xFor(m.date)
          const above = i % 2 === 0
          // Milestones landing close in time get progressively longer leader
          // lines on their side, so near-duplicate dates don't stack labels
          // on top of each other.
          const sameSide = milestones.filter((o, j) => j < i && j % 2 === i % 2).length
          const stem = 20 + sameSide * 26
          const labelY = above ? BASELINE_Y - stem : BASELINE_Y + stem

          return (
            <g key={m.pct}>
              <line x1={x} y1={BASELINE_Y} x2={x} y2={labelY} stroke="#c3c2b7" strokeWidth={1} />
              <circle cx={x} cy={BASELINE_Y} r={5} fill={SAGE} stroke="#fcfcfb" strokeWidth={2} />
              <text
                x={x}
                y={above ? labelY - 14 : labelY + 20}
                textAnchor="middle"
                className="fill-stone-900 font-semibold"
                fontSize={13}
              >
                {m.pct}%
              </text>
              <text
                x={x}
                y={above ? labelY - 2 : labelY + 32}
                textAnchor="middle"
                className="fill-stone-600"
                fontSize={10}
              >
                {formatDate(m.date)}
              </text>
            </g>
          )
        })}
      </svg>

      {middleSpanDays !== null && (
        <p className="text-xs text-stone-600">
          <span className="font-semibold text-stone-900">{middleSpanDays}</span> days from 10% to
          90% of the run
        </p>
      )}
    </div>
  )
}
