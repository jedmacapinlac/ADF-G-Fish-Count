import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatCompact, formatDate } from './format'
import type { CountRow } from './types'

type Props = {
  rows: CountRow[]
}

const SAGE = '#59784a'

type CumulativeRow = {
  count_date: string
  cumulative_total: number
}

/** Running total of fish_count over the season. A no-count day doesn't add
 *  anything, but unlike the bar chart it doesn't leave a gap either — the
 *  total-to-date is still a real, known number on a day nobody counted, it's
 *  just unchanged from the day before. So the line carries forward flat
 *  instead of breaking, the opposite of how a null day reads everywhere
 *  else in this app. */
function withCumulativeTotal(rows: CountRow[]): CumulativeRow[] {
  let running = 0
  return rows.map((row) => {
    if (row.fish_count !== null) running += row.fish_count
    return { count_date: row.count_date, cumulative_total: running }
  })
}

type TooltipProps = {
  active?: boolean
  payload?: { payload: CumulativeRow }[]
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (active !== true || payload === undefined || payload.length === 0) return null
  const row = payload[0].payload

  return (
    <div className="rounded-lg border border-stone-300 bg-stone-800 px-2.5 py-1.5 shadow-lg">
      <p className="text-xs text-stone-300">{formatDate(row.count_date)}</p>
      <p className="text-sm font-semibold text-white">{row.cumulative_total.toLocaleString()}</p>
    </div>
  )
}

/** Cumulative total for one season — a running sum over the same
 *  /api/counts rows the daily bar chart already has, computed on the client
 *  since it's a plain running sum over data already in hand, not something
 *  that needs SQL. */
export default function CumulativeCountChart({ rows }: Props) {
  const data = withCumulativeTotal(rows)

  // Thin date ticks so labels never overlap across a long season.
  const tickEvery = Math.max(1, Math.ceil(rows.length / 8))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
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
        <Area
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
      </AreaChart>
    </ResponsiveContainer>
  )
}
