import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatCompact, formatDate } from './format'
import { useApi } from './useApi'
import type { CountRow, TimingRow } from './types'

type Props = {
  locationId: number
  speciesId: number
  year: number
  rows: CountRow[]
}

const SAGE = '#59784a'
const MEDIAN_BLUE = '#2a78d6'

/** Well before any real data (the earliest series starts in 1974) — just a
 *  floor so /api/timing returns every prior year on record without needing
 *  to know the series' actual first_year here. */
const EARLIEST_POSSIBLE_YEAR = 1900

type PlotRow = {
  count_date: string
  day_of_year: number
  cumulative_total: number
  median_total: number | null
}

/** Postgres's EXTRACT(DOY) equivalent — Jan 1 is 1, matching /api/timing's
 *  day_of_year, so this year's dates and other years' rows line up. */
function dayOfYear(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const start = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.floor((d.getTime() - start) / 86_400_000) + 1
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/** Running total of fish_count over the season. A no-count day doesn't add
 *  anything, but unlike the bar chart it doesn't leave a gap either — the
 *  total-to-date is still a real, known number on a day nobody counted, it's
 *  just unchanged from the day before. So the line carries forward flat
 *  instead of breaking, the opposite of how a null day reads everywhere
 *  else in this app. */
function withCumulativeTotal(rows: CountRow[]): { count_date: string; day_of_year: number; cumulative_total: number }[] {
  let running = 0
  return rows.map((row) => {
    if (row.fish_count !== null) running += row.fish_count
    return { count_date: row.count_date, day_of_year: dayOfYear(row.count_date), cumulative_total: running }
  })
}

/** For each target day-of-year, the median across every other year on
 *  record of "that year's cumulative total as of this day." A year isn't
 *  required to have counted on the exact target day — /api/timing only
 *  emits rows for days it actually counted, so this forward-fills: it takes
 *  that year's most recent cumulative_count at or before the target day
 *  (Apr 1 and Apr 3 counted but not Apr 2 → Apr 2 reads as Apr 1's total).
 *  A year with no counted day at or before the target yet (its season
 *  starts later) contributes nothing for that day rather than a fabricated
 *  zero. */
function medianByDayOfYear(
  timingRows: TimingRow[],
  excludeYear: number,
  targetDays: number[],
): Map<number, number> {
  const byYear = new Map<number, { day_of_year: number; cumulative_count: number }[]>()
  for (const r of timingRows) {
    if (r.year === excludeYear) continue
    const list = byYear.get(r.year) ?? []
    list.push({ day_of_year: r.day_of_year, cumulative_count: r.cumulative_count })
    byYear.set(r.year, list)
  }
  for (const list of byYear.values()) list.sort((a, b) => a.day_of_year - b.day_of_year)

  const result = new Map<number, number>()
  for (const day of targetDays) {
    const candidates: number[] = []
    for (const list of byYear.values()) {
      let forwardFilled: number | undefined
      for (const entry of list) {
        if (entry.day_of_year > day) break
        forwardFilled = entry.cumulative_count
      }
      if (forwardFilled !== undefined) candidates.push(forwardFilled)
    }
    if (candidates.length > 0) result.set(day, median(candidates))
  }
  return result
}

type TooltipProps = {
  active?: boolean
  payload?: { payload: PlotRow }[]
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (active !== true || payload === undefined || payload.length === 0) return null
  const row = payload[0].payload

  return (
    <div className="rounded-lg border border-stone-300 bg-stone-800 px-2.5 py-1.5 shadow-lg">
      <p className="text-xs text-stone-300">{formatDate(row.count_date)}</p>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SAGE }} />
        {row.cumulative_total.toLocaleString()}
      </p>
      {row.median_total !== null && (
        <p className="flex items-center gap-1.5 text-xs text-stone-300">
          <span className="inline-block h-0.5 w-2.5" style={{ backgroundColor: MEDIAN_BLUE }} />
          {Math.round(row.median_total).toLocaleString()} median of past years
        </p>
      )}
    </div>
  )
}

/** Cumulative total for one season, against the median of every prior
 *  year's cumulative total as of the same day-of-season. The running total
 *  itself comes from the same /api/counts rows the daily bar chart already
 *  has (a plain client-side running sum); the historical median needs
 *  /api/timing's cumulative_count across other years, fetched here since
 *  nothing else on this tab has it. */
export default function CumulativeCountChart({ locationId, speciesId, year, rows }: Props) {
  const { data: timingRows } = useApi<TimingRow[]>(
    `/api/timing?location_id=${locationId}&species_id=${speciesId}&year_from=${EARLIEST_POSSIBLE_YEAR}&year_to=${year}`,
  )

  const cumulative = withCumulativeTotal(rows)
  const medianMap = medianByDayOfYear(timingRows ?? [], year, cumulative.map((r) => r.day_of_year))
  const data: PlotRow[] = cumulative.map((row) => ({
    ...row,
    median_total: medianMap.get(row.day_of_year) ?? null,
  }))

  // Thin date ticks so labels never overlap across a long season.
  const tickEvery = Math.max(1, Math.ceil(rows.length / 8))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 24, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke="#e1e0d9" />
        <XAxis
          dataKey="count_date"
          tickFormatter={(d: string) => formatDate(d)}
          tickLine={false}
          axisLine={{ stroke: '#c3c2b7' }}
          tick={{ fill: '#78716c', fontSize: 10 }}
          interval={tickEvery - 1}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#78716c', fontSize: 10 }}
          tickFormatter={(value: number) => formatCompact(value)}
          width={40}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#c3c2b7' }} />
        <Legend
          verticalAlign="top"
          height={28}
          wrapperStyle={{ fontSize: 14 }}
          formatter={(value) => <span className="text-stone-600">{value}</span>}
        />
        <Area
          name={`${year}`}
          type="monotone"
          dataKey="cumulative_total"
          stroke={SAGE}
          strokeWidth={2}
          fill={SAGE}
          fillOpacity={0.12}
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
        <Line
          name="Median of past years"
          type="monotone"
          dataKey="median_total"
          stroke={MEDIAN_BLUE}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
