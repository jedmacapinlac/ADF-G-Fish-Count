import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { colorForCompareIndex, PRIMARY_COLOR } from './compareColors'
import type { CompareAnnualRow } from './types'
import type { SiteRef } from './CompareAnnualChart'

type Props = {
  rows: CompareAnnualRow[]
  /** The primary site first, then comparison sites in selection order — same
   *  ordering contract as CompareAnnualChart. */
  sites: SiteRef[]
}

type PlotRow = { year: number } & Record<string, number | null>

/** One row per year across every selected site's days_counted, keyed by
 *  location_id. A year with no daily_counts rows at all for a site (not
 *  even a null-count one) has no key set, which Line renders as a gap via
 *  connectNulls={false} — distinct from a year that was monitored but
 *  produced a real 0-day count, which would show as an actual 0. */
function pivot(rows: CompareAnnualRow[], sites: SiteRef[]): PlotRow[] {
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b)
  return years.map((year) => {
    const row: PlotRow = { year }
    for (const site of sites) {
      const match = rows.find((r) => r.location_id === site.location_id && r.year === year)
      row[String(site.location_id)] = match?.days_counted ?? null
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
        <p className="text-xs text-stone-300">{label}</p>
        {payload.map((p) => {
          const site = sites.find((s) => String(s.location_id) === p.dataKey)
          if (site === undefined || p.value === null) return null
          return (
            <p key={p.dataKey} className="flex items-center gap-1.5 text-sm font-semibold text-white">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
              {site.name}: {p.value.toLocaleString()} days
            </p>
          )
        })}
      </div>
    )
  }
}

/** How many days each site actually had a count taken, per year — a proxy
 *  for how complete/dense a site's monitoring is, independent of how many
 *  fish passed. Some sites count daily, others only a few days a week; this
 *  is what "duration of tracking" means season by season, as opposed to a
 *  site's overall first_year–last_year span (which /locations/{id}/series
 *  already reports and doesn't need a chart). */
export default function CompareDaysCountedChart({ rows, sites }: Props) {
  const data = pivot(rows, sites)
  const ChartTooltip = makeTooltip(sites)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 24, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke="#e1e0d9" />
        <XAxis
          dataKey="year"
          type="number"
          domain={['dataMin', 'dataMax']}
          allowDecimals={false}
          tickLine={false}
          axisLine={{ stroke: '#c3c2b7' }}
          tick={{ fill: '#78716c', fontSize: 10 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#78716c', fontSize: 10 }}
          width={36}
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
