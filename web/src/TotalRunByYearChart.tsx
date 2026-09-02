import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LabelList,
  Rectangle,
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
const SAGE_HOVER = '#71945f'
const MEDIAN_BLUE = '#2a78d6'
const TRAILING_WINDOW = 5

type PlotRow = AnnualRow & { trailing_median: number | null }

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/** For each year, the median total_count of up to the 5 preceding years
 *  that are on this same (already filtered) chart — "no data" years don't
 *  count toward the 5. A year with nothing before it to draw from (the
 *  first year on the chart, or a leading stretch of no-data years) falls
 *  back to its own total, so the line still starts at the first bar
 *  instead of opening with a gap. */
function withTrailingMedian(rows: AnnualRow[]): PlotRow[] {
  const priorTotals: number[] = []
  return rows.map((row) => {
    const window = priorTotals.slice(-TRAILING_WINDOW)
    const trailing_median = window.length === 0 ? row.total_count : median(window)
    if (row.total_count !== null) priorTotals.push(row.total_count)
    return { ...row, trailing_median }
  })
}

/** The median Line's own points sit at each bar's horizontal middle (the
 *  band's 'middle' position), which reads as if the line stops short at the
 *  first and last bars instead of spanning the chart. This draws two short,
 *  non-interactive continuations from each end point out to that bar's
 *  'start'/'end' band edge, extrapolating the neighboring segment's slope so
 *  they read as part of the same line rather than a flat stub. Rendered as a
 *  plain child of ComposedChart — recharts 3.x wires chart context to any
 *  descendant via hooks, no <Customized> wrapper needed. */
function MedianLineEdges({ data }: { data: PlotRow[] }) {
  const xScale = useXAxisScale()
  const yScale = useYAxisScale()

  if (xScale === undefined || yScale === undefined) return null

  const firstIdx = data.findIndex((d) => d.trailing_median !== null)
  const lastIdx = data.length - 1 - [...data].reverse().findIndex((d) => d.trailing_median !== null)
  if (firstIdx === -1 || firstIdx === lastIdx) return null

  const point = (i: number, position: 'start' | 'middle' | 'end') => ({
    x: xScale(data[i].year, { position }),
    y: yScale(data[i].trailing_median),
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
    <g stroke={MEDIAN_BLUE} strokeWidth={2} strokeLinecap="round" pointerEvents="none">
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
      {row.trailing_median !== null && (
        <p className="flex items-center gap-1.5 text-xs text-stone-300">
          <span className="inline-block h-0.5 w-2.5" style={{ backgroundColor: MEDIAN_BLUE }} />
          {row.trailing_median.toLocaleString()} 5-yr median
        </p>
      )}
    </div>
  )
}

/** "Total Run by Year": one bar per year in the selected range, from the
 *  /api/annual rows Run Overview already has. A year with every daily count
 *  null (total_count === null) renders as an empty slot rather than a zero —
 *  recharts just skips a null value, which reads correctly here since a gap
 *  and "no data" are the same thing. */
export default function TotalRunByYearChart({ rows }: Props) {
  const data = withTrailingMedian(rows)
  const peakTotal = Math.max(0, ...rows.map((r) => r.total_count ?? -Infinity))

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
        <Bar
          name="Total run"
          dataKey="total_count"
          fill={SAGE}
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
          isAnimationActive={false}
          shape={(props) => {
            const { payload, ...rest } = props as React.ComponentProps<typeof Rectangle> & { payload: AnnualRow }
            return <Rectangle {...rest} fill={payload.total_count === peakTotal ? SAGE_HOVER : SAGE} />
          }}
        >
          <LabelList
            dataKey="total_count"
            position="top"
            content={(props) => {
              const { x, y, width, value } = props as { x?: number; y?: number; width?: number; value?: number }
              if (value !== peakTotal || x === undefined || y === undefined || width === undefined) return null
              return (
                <text x={x + width / 2} y={y - 6} textAnchor="middle" className="fill-stone-700 font-semibold" fontSize={10}>
                  {formatCompact(value ?? null)}
                </text>
              )
            }}
          />
        </Bar>
        <Line
          name="5-yr trailing median"
          type="monotone"
          dataKey="trailing_median"
          stroke={MEDIAN_BLUE}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls={false}
          isAnimationActive={false}
        />
        <MedianLineEdges data={data} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
