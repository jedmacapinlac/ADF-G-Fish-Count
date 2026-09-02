import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  useXAxisScale,
  useYAxisScale,
  XAxis,
  YAxis,
} from 'recharts'

import { formatCompact } from './format'
import type { AnnualRow } from './types'

type Props = {
  rows: AnnualRow[]
}

const SAGE = '#59784a'
const TREND_BLUE = '#2a78d6'

type PlotRow = AnnualRow & { fit_value: number | null }

/** Ordinary least-squares slope/intercept over a set of (x, y) points. Null
 *  with fewer than 2 points — a line needs two points to be defined, and a
 *  vertical spread (every x identical) has no defined slope either. */
function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } | null {
  const n = points.length
  if (n < 2) return null

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (const { x, y } of points) {
    sumX += x
    sumY += y
    sumXY += x * y
    sumXX += x * x
  }

  const denominator = n * sumXX - sumX * sumX
  if (denominator === 0) return null

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

/** Least-squares line of best fit over (year, total_count) — the trend the
 *  bars are actually following, independent of any single year's swing.
 *  Only years with a real total_count feed the fit itself, but the fitted
 *  line still draws across every year in range (no-data years included):
 *  it's a model of the whole range, not a value computed per year, so a
 *  no-data year has no reason to break it the way the bars do. */
function withFit(rows: AnnualRow[]): PlotRow[] {
  const points = rows
    .filter((r): r is AnnualRow & { total_count: number } => r.total_count !== null)
    .map((r) => ({ x: r.year, y: r.total_count }))
  const fit = linearRegression(points)

  return rows.map((row) => ({
    ...row,
    fit_value: fit === null ? null : fit.slope * row.year + fit.intercept,
  }))
}

/** The fit Line's own points sit at each bar's horizontal middle (the band's
 *  'middle' position), which reads as if the line stops short at the first
 *  and last bars instead of spanning the chart. This draws two short,
 *  non-interactive continuations from each end point out to that bar's
 *  'start'/'end' band edge, extrapolating the neighboring segment's slope —
 *  which for a straight regression line is just the fit's own slope, so this
 *  reads as an exact continuation, not an approximation. Rendered as a plain
 *  child of ComposedChart — recharts 3.x wires chart context to any
 *  descendant via hooks, no <Customized> wrapper needed. Same technique as
 *  TotalRunByYearChart's MedianLineEdges. */
function FitLineEdges({ data }: { data: PlotRow[] }) {
  const xScale = useXAxisScale()
  const yScale = useYAxisScale()

  if (xScale === undefined || yScale === undefined) return null

  const firstIdx = data.findIndex((d) => d.fit_value !== null)
  const lastIdx = data.length - 1 - [...data].reverse().findIndex((d) => d.fit_value !== null)
  if (firstIdx === -1 || firstIdx === lastIdx) return null

  const point = (i: number, position: 'start' | 'middle' | 'end') => ({
    x: xScale(data[i].year, { position }),
    y: yScale(data[i].fit_value),
  })

  const start = point(firstIdx, 'middle')
  const next = point(firstIdx + 1, 'middle')
  const startEdge = xScale(data[firstIdx].year, { position: 'start' })

  const end = point(lastIdx, 'middle')
  const prev = point(lastIdx - 1, 'middle')
  const endEdge = xScale(data[lastIdx].year, { position: 'end' })

  if (
    start.x === undefined || start.y === undefined || next.x === undefined || next.y === undefined ||
    startEdge === undefined || end.x === undefined || end.y === undefined ||
    prev.x === undefined || prev.y === undefined || endEdge === undefined
  ) {
    return null
  }

  const startSlope = (next.y - start.y) / (next.x - start.x)
  const startY = start.y - startSlope * (start.x - startEdge)

  const endSlope = (end.y - prev.y) / (end.x - prev.x)
  const endY = end.y + endSlope * (endEdge - end.x)

  return (
    <g stroke={TREND_BLUE} strokeWidth={2} strokeLinecap="round" pointerEvents="none">
      <line x1={startEdge} y1={startY} x2={start.x} y2={start.y} />
      <line x1={end.x} y1={end.y} x2={endEdge} y2={endY} />
    </g>
  )
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
      <p className="text-xs text-stone-300">{row.year}</p>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SAGE }} />
        {row.total_count === null ? 'No data' : row.total_count.toLocaleString()}
      </p>
      {row.fit_value !== null && (
        <p className="flex items-center gap-1.5 text-xs text-stone-300">
          <span className="inline-block h-0.5 w-2.5" style={{ backgroundColor: TREND_BLUE }} />
          {Math.round(row.fit_value).toLocaleString()} trend
        </p>
      )}
    </div>
  )
}

/** "Run Size vs. Series Average", repurposed as a least-squares trend line
 *  over Total Run's own bars — same /api/annual rows Run Overview already
 *  fetches, no new endpoint. */
export default function RunTrendChart({ rows }: Props) {
  const data = withFit(rows)

  // Thin year ticks so labels never overlap across a long run of record.
  const tickEvery = Math.max(1, Math.ceil(rows.length / 10))

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
          wrapperStyle={{ fontSize: 14 }}
          formatter={(value) => <span className="text-stone-600">{value}</span>}
        />
        <Bar name="Total run" dataKey="total_count" fill={SAGE} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        <Line
          name="Best fit"
          type="linear"
          dataKey="fit_value"
          stroke={TREND_BLUE}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
        <FitLineEdges data={data} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
