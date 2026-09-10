import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { colorForCompareIndex, PRIMARY_COLOR } from './compareColors'
import { dayOfYearLabel, formatCompact } from './format'
import type { CompareTimingRow } from './types'
import type { SiteRef } from './CompareAnnualChart'

type Props = {
  rows: CompareTimingRow[]
  /** The primary site first, then comparison sites in selection order — same
   *  ordering contract as CompareAnnualChart/CompareTimingChart. */
  sites: SiteRef[]
}

type PlotRow = { day_of_year: number } & Record<string, number | null>

/** One row per day-of-year across every selected site's running total,
 *  keyed by location_id. Same source rows as CompareTimingChart (one
 *  /api/timing/compare fetch, scoped to a single season), plotting the raw
 *  cumulative_count instead of pct_of_total — run size building up over the
 *  season, not just its share of the eventual total. A site with no counted
 *  day at a given day_of_year has no key set, which Line renders as a gap
 *  via connectNulls={false}. */
function pivot(rows: CompareTimingRow[], sites: SiteRef[]): PlotRow[] {
  const days = [...new Set(rows.map((r) => r.day_of_year))].sort((a, b) => a - b)
  return days.map((day_of_year) => {
    const row: PlotRow = { day_of_year }
    for (const site of sites) {
      const match = rows.find((r) => r.location_id === site.location_id && r.day_of_year === day_of_year)
      row[String(site.location_id)] = match?.cumulative_count ?? null
    }
    return row
  })
}

type TooltipProps = {
  active?: boolean
  label?: number
  payload?: { dataKey: string; value: number | null; color: string }[]
}

function makeTooltip(sites: SiteRef[]) {
  return function ChartTooltip({ active, label, payload }: TooltipProps) {
    if (active !== true || payload === undefined || payload.length === 0) return null
    return (
      <div className="rounded-lg border border-stone-300 bg-stone-800 px-2.5 py-1.5 shadow-lg">
        <p className="text-xs text-stone-300">{label !== undefined && dayOfYearLabel(label)}</p>
        {payload.map((p) => {
          const site = sites.find((s) => String(s.location_id) === p.dataKey)
          if (site === undefined || p.value === null) return null
          return (
            <p key={p.dataKey} className="flex items-center gap-1.5 text-sm font-semibold text-white">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
              {site.name}: {p.value.toLocaleString()}
            </p>
          )
        })}
      </div>
    )
  }
}

/** Running total for one season, overlaid across sites — the multi-site
 *  version of CumulativeCountChart.tsx (Daily Counts tab), for the same
 *  single selected `year`. Unlike that chart, there's no historical-median
 *  overlay here: the comparison axis is other sites, not past years. See
 *  CompareTimingChart.tsx for the same underlying rows plotted as each
 *  site's share of its own eventual total instead. */
export default function CompareCumulativeChart({ rows, sites }: Props) {
  const data = pivot(rows, sites)
  const ChartTooltip = makeTooltip(sites)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 24, right: 8, bottom: 4, left: 0 }}>
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
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#78716c', fontSize: 10 }}
          tickFormatter={(value: number) => formatCompact(value)}
          width={40}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: '#e1e0d9', opacity: 0.4 }} />
        <Legend
          verticalAlign="top"
          height={28}
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) => <span className="text-stone-600">{value}</span>}
        />
        {sites.map((site, i) => (
          <Line
            key={site.location_id}
            name={site.name}
            type="monotone"
            dataKey={String(site.location_id)}
            stroke={i === 0 ? PRIMARY_COLOR : colorForCompareIndex(i - 1)}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
