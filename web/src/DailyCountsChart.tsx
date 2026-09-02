import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatCompact, formatDate } from './format'
import type { CountRow } from './types'

type Props = {
  rows: CountRow[]
}

const SAGE = '#59784a'

type TooltipProps = {
  active?: boolean
  payload?: { payload: CountRow }[]
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (active !== true || payload === undefined || payload.length === 0) return null
  const row = payload[0].payload

  return (
    <div className="rounded-lg border border-stone-300 bg-stone-800 px-2.5 py-1.5 shadow-lg">
      <p className="text-xs text-stone-300">{formatDate(row.count_date)}</p>
      <p className="text-sm font-semibold text-white">
        {row.fish_count === null ? 'No data' : row.fish_count.toLocaleString()}
      </p>
    </div>
  )
}

/** One bar per day in the selected season — fish_count straight from
 *  /api/counts, no aggregation. A no-count day (fish_count === null) renders
 *  as an empty slot rather than a zero. */
export default function DailyCountsChart({ rows }: Props) {
  // Thin date ticks so labels never overlap across a long season.
  const tickEvery = Math.max(1, Math.ceil(rows.length / 8))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
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
        <Tooltip content={<ChartTooltip />} cursor={{ fill: '#e1e0d9', opacity: 0.4 }} />
        <Bar dataKey="fish_count" fill={SAGE} radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
