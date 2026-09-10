import { useState } from 'react'

import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

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

type Mode = 'total' | 'relative'

type PlotRow = { year: number } & Record<string, number | null>

/** Each site's own average total_count across whatever years it has in
 *  `rows` — the denominator "relative" mode divides by. Computed per site
 *  independently, not across sites, so a site with a handful of fish and one
 *  with six figures each get compared against their own normal, not each
 *  other's. Years with no count (null) don't count toward a site's average. */
function siteAverages(rows: CompareAnnualRow[]): Map<number, number> {
  const sums = new Map<number, { total: number; n: number }>()
  for (const r of rows) {
    if (r.total_count === null) continue
    const entry = sums.get(r.location_id) ?? { total: 0, n: 0 }
    entry.total += r.total_count
    entry.n += 1
    sums.set(r.location_id, entry)
  }
  const averages = new Map<number, number>()
  for (const [id, { total, n }] of sums) averages.set(id, total / n)
  return averages
}

/** One row per year across every selected site's total_count, keyed by
 *  location_id so each site becomes its own Line. Years come from whatever
 *  rows exist — a site with no data for a year simply has no key set, which
 *  Line renders as a gap via connectNulls={false} rather than a drop to 0.
 *
 *  In 'relative' mode, each site's value becomes total_count as a percentage
 *  of that site's own average (100 = an exactly average year for that site)
 *  instead of a raw count — the raw count is kept alongside under a
 *  `__raw` key so the tooltip can still show it. A site with no average yet
 *  (every year null) has nothing to divide by, so it's left null too. */
function pivot(rows: CompareAnnualRow[], sites: SiteRef[], mode: Mode, averages: Map<number, number>): PlotRow[] {
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b)
  return years.map((year) => {
    const row: PlotRow = { year }
    for (const site of sites) {
      const match = rows.find((r) => r.location_id === site.location_id && r.year === year)
      const raw = match?.total_count ?? null
      row[`${site.location_id}__raw`] = raw

      if (mode === 'total' || raw === null) {
        row[String(site.location_id)] = raw
      } else {
        const avg = averages.get(site.location_id)
        row[String(site.location_id)] = avg === undefined || avg === 0 ? null : (raw / avg) * 100
      }
    }
    return row
  })
}

type TooltipProps = {
  active?: boolean
  label?: number
  payload?: { dataKey: string; value: number | null; color: string; payload: PlotRow }[]
}

function makeTooltip(sites: SiteRef[], mode: Mode) {
  return function ChartTooltip({ active, label, payload }: TooltipProps) {
    if (active !== true || payload === undefined || payload.length === 0) return null
    return (
      <div className="rounded-lg border border-stone-300 bg-stone-800 px-2.5 py-1.5 shadow-lg">
        <p className="text-xs text-stone-300">{label}</p>
        {payload.map((p) => {
          const site = sites.find((s) => String(s.location_id) === p.dataKey)
          if (site === undefined || p.value === null) return null
          const raw = p.payload[`${p.dataKey}__raw`]
          return (
            <p key={p.dataKey} className="flex items-center gap-1.5 text-sm font-semibold text-white">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
              {site.name}:{' '}
              {mode === 'total'
                ? p.value.toLocaleString()
                : `${Math.round(p.value)}% of average${typeof raw === 'number' ? ` (${raw.toLocaleString()})` : ''}`}
            </p>
          )
        })}
      </div>
    )
  }
}

/** "Total Run by Year", overlaid across sites instead of one metric per site
 *  — see TotalRunByYearChart.tsx for the single-site version this mirrors.
 *
 *  Sites can differ in scale by orders of magnitude (a handful of fish at a
 *  small tributary vs. six figures at a major river), which flattens the
 *  smaller site's line to near-zero in raw-count mode. 'Relative' mode
 *  swaps to each site's count as a percentage of its own average, so a good
 *  or bad year reads the same way regardless of the site's absolute size —
 *  at the cost of no longer showing which site actually runs more fish. */
export default function CompareAnnualChart({ rows, sites }: Props) {
  const [mode, setMode] = useState<Mode>('total')
  const averages = siteAverages(rows)
  const data = pivot(rows, sites, mode, averages)
  const ChartTooltip = makeTooltip(sites, mode)

  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        <div className="inline-flex rounded-lg border border-stone-300 p-0.5 text-xs">
          {(['total', 'relative'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-md px-2 py-1 font-medium ${
                mode === m ? 'bg-sage-600 text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {m === 'total' ? 'Total count' : '% of average'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 20, right: 8, bottom: 4, left: 0 }}>
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
              tickFormatter={(value: number) => (mode === 'total' ? formatCompact(value) : `${Math.round(value)}%`)}
              width={mode === 'total' ? 40 : 48}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#e1e0d9', opacity: 0.4 }} />
            <Legend
              verticalAlign="top"
              height={28}
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) => <span className="text-stone-600">{value}</span>}
            />
            {mode === 'relative' && (
              <ReferenceLine y={100} stroke="#a8a29e" strokeDasharray="4 4" ifOverflow="extendDomain" />
            )}
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
      </div>
    </div>
  )
}
