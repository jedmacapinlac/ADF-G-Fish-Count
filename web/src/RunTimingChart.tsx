import { useMemo, useState } from 'react'

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatDate } from './format'
import { CONTROL, LABEL } from './styles'
import { useApi } from './useApi'
import type { TimingRow } from './types'

type Props = {
  locationId: number
  speciesId: number
  yearFrom: number
  yearTo: number
}

const HIGHLIGHT_BLUE = '#2a78d6'
const CONTEXT_GRAY = '#c3c2b7'

type WideRow = { day_of_year: number } & Record<string, number | string | null>

/** One row per day-of-year, with every year's pct_of_total (or its counted
 *  date) pulled into its own column — the shape recharts needs to draw one
 *  Line per year against a shared x-axis. A year with no counted day at a
 *  given day_of_year simply has no key there, which is what leaves a gap in
 *  that year's line instead of interpolating across it. */
function toWideRows(rows: TimingRow[]): WideRow[] {
  const byDay = new Map<number, WideRow>()
  for (const row of rows) {
    const entry = byDay.get(row.day_of_year) ?? { day_of_year: row.day_of_year }
    entry[String(row.year)] = row.pct_of_total
    entry[`${row.year}__date`] = row.count_date
    byDay.set(row.day_of_year, entry)
  }
  return [...byDay.values()].sort((a, b) => a.day_of_year - b.day_of_year)
}

/** day_of_year -> "Jul 8", using a fixed non-leap reference year — only the
 *  month/day matters here, the season is what's being compared, not a
 *  specific year. */
function dayOfYearLabel(day: number): string {
  const reference = new Date(Date.UTC(2001, 0, day))
  return reference.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

type TooltipProps = {
  active?: boolean
  payload?: { payload: WideRow }[]
  highlightYear: number
}

function ChartTooltip({ active, payload, highlightYear }: TooltipProps) {
  if (active !== true || payload === undefined || payload.length === 0) return null
  const row = payload[0].payload
  const pct = row[String(highlightYear)]
  const date = row[`${highlightYear}__date`]
  if (typeof pct !== 'number' || typeof date !== 'string') return null

  return (
    <div className="rounded-lg border border-stone-300 bg-stone-800 px-2.5 py-1.5 shadow-lg">
      <p className="text-xs text-stone-300">{formatDate(date)}</p>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
        <span className="inline-block h-0.5 w-2.5" style={{ backgroundColor: HIGHLIGHT_BLUE }} />
        {pct.toFixed(1)}% of {highlightYear}&apos;s run
      </p>
    </div>
  )
}

/** "Run Timing by Year": for one year highlighted at a time, what share of
 *  its eventual total had passed by each day of the season — every other
 *  year in the selected range drawn faint underneath as context, so the
 *  highlighted year's timing reads as early/late/typical at a glance. */
export default function RunTimingChart({ locationId, speciesId, yearFrom, yearTo }: Props) {
  const { data, error } = useApi<TimingRow[]>(
    `/api/timing?location_id=${locationId}&species_id=${speciesId}&year_from=${yearFrom}&year_to=${yearTo}`,
  )

  const rows = data ?? []
  const years = useMemo(() => [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b), [rows])
  const wideData = useMemo(() => toWideRows(rows), [rows])

  const [pickedYear, setPickedYear] = useState<number | null>(null)
  const highlightYear = pickedYear !== null && years.includes(pickedYear) ? pickedYear : (years[years.length - 1] ?? yearTo)

  if (error !== null) return <p className="font-mono text-sm text-red-700">{error}</p>
  if (data === null) return <p className="text-sm text-stone-700">Loading…</p>
  if (years.length === 0) return <p className="text-sm text-stone-700">No counted days in the selected range.</p>

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-stone-600">
          <span className="inline-block h-0.5 w-2.5" style={{ backgroundColor: HIGHLIGHT_BLUE }} />
          Highlighted year
          <span className="ml-2 inline-block h-0.5 w-2.5" style={{ backgroundColor: CONTEXT_GRAY }} />
          Other years
        </p>
        <label className="flex items-center gap-1.5">
          <span className={LABEL}>Year</span>
          <select
            value={highlightYear}
            onChange={(e) => setPickedYear(Number(e.target.value))}
            className={`${CONTROL} py-1 text-xs`}
          >
            {[...years].reverse().map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-2 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={wideData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#e1e0d9" />
            <XAxis
              dataKey="day_of_year"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={dayOfYearLabel}
              tickLine={false}
              axisLine={{ stroke: '#c3c2b7' }}
              tick={{ fill: '#78716c', fontSize: 10 }}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#78716c', fontSize: 10 }}
              width={34}
            />
            <Tooltip content={<ChartTooltip highlightYear={highlightYear} />} cursor={{ stroke: '#c3c2b7' }} />

            {years
              .filter((y) => y !== highlightYear)
              .map((y) => (
                <Line
                  key={y}
                  dataKey={String(y)}
                  stroke={CONTEXT_GRAY}
                  strokeWidth={1}
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}

            <Line
              key={highlightYear}
              dataKey={String(highlightYear)}
              stroke={HIGHLIGHT_BLUE}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
