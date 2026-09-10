import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { colorForCompareIndex, PRIMARY_COLOR } from './compareColors'
import { formatCompact } from './format'
import type { CompareAnnualRow } from './types'

export type SiteRef = { location_id: number; name: string }

type Props = {
  rows: CompareAnnualRow[]
  /** The primary site first, then comparison sites in selection order — this
   *  order drives both line color and legend order. */
  sites: SiteRef[]
}

type PlotRow = { year: number } & Record<string, number | null>

/** One row per year across every selected site's total_count, keyed by
 *  location_id so each site becomes its own Line. Years come from whatever
 *  rows exist — a site with no data for a year simply has no key set, which
 *  Line renders as a gap via connectNulls={false} rather than a drop to 0. */
function pivot(rows: CompareAnnualRow[], sites: SiteRef[]): PlotRow[] {
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b)
  return years.map((year) => {
    const row: PlotRow = { year }
    for (const site of sites) {
      const match = rows.find((r) => r.location_id === site.location_id && r.year === year)
      row[String(site.location_id)] = match?.total_count ?? null
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
              {site.name}: {p.value.toLocaleString()}
            </p>
          )
        })}
      </div>
    )
  }
}

/** "Total Run by Year", overlaid across sites instead of one metric per site
 *  — see TotalRunByYearChart.tsx for the single-site version this mirrors. */
export default function CompareAnnualChart({ rows, sites }: Props) {
  const data = pivot(rows, sites)
  const tickEvery = Math.max(1, Math.ceil(data.length / 10))
  const ChartTooltip = makeTooltip(sites)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 24, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke="#e1e0d9" />
        <XAxis
          dataKey="year"
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
