import { useMemo, useState } from 'react'

import { formatCompact, formatDate } from './format'
import { useApi } from './useApi'
import type { CountRow } from './types'

type Props = {
  locationId: number
  speciesId: number
  yearFrom: number
  yearTo: number
}

// The sequential ramp is this app's own accent (sage), not a new hue — low
// values recede toward the surface, high values go dark, same convention as
// every other sequential/magnitude encoding.
const SAGE_LOW = '#d3e2ca' // sage-200 — pale, but still visibly sage-tinted rather than nearly blending into the surface
const SAGE_HIGH = '#30402c' // sage-900 — a genuinely dark step, for real contrast against the low end
const NO_DATA = '#f2f1ed' // a very light neutral — distinct from the lightest sage step (a count of 0 still gets a real, pale sage tile) but never blank

const CELL = 12 // one day x one year — bigger than before so the year labels beside them are actually readable
const MARGIN = { left: 44, top: 20, right: 12 }
// Vertical space below the grid, reserved for the legend — measured from the
// legend's own content (an 8px swatch plus a text baseline ~20px down, with
// a few px of descender below that), not guessed.
const LEGEND_GAP = 14
const LEGEND_HEIGHT = 26
const X_TICK_COUNT = 6

/** Postgres's EXTRACT(DOY) equivalent — Jan 1 is 1. */
function dayOfYear(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const start = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.floor((d.getTime() - start) / 86_400_000) + 1
}

function yearOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCFullYear()
}

/** day_of_year -> "Jul 8" (a fixed non-leap reference year; only the
 *  month/day matters for a tick label here). */
function dayOfYearLabel(day: number): string {
  return new Date(Date.UTC(2001, 0, day)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function lerpHex(from: string, to: string, t: number): string {
  const a = [1, 3, 5].map((i) => parseInt(from.slice(i, i + 2), 16))
  const b = [1, 3, 5].map((i) => parseInt(to.slice(i, i + 2), 16))
  const mixed = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

type Hovered = { year: number; day: number; date: string; count: number | null }

/** Year x calendar-date heatmap — every counted day, colored by fish_count,
 *  one row per year so timing and run size are both visible across the
 *  whole record at once. Columns are trimmed to the day-of-year range that
 *  actually has data across all years (not the full 365), so months nobody
 *  ever counted in don't waste space. Color is scaled off one shared max
 *  across the whole grid, not per-row, so a cell's shade is comparable
 *  across years, not just within one. */
export default function TimingHeatmapChart({ locationId, speciesId, yearFrom, yearTo }: Props) {
  const { data, error } = useApi<CountRow[]>(
    `/api/counts?location_id=${locationId}&species_id=${speciesId}&year_from=${yearFrom}&year_to=${yearTo}`,
  )
  const [hovered, setHovered] = useState<Hovered | null>(null)

  // Rebuilding the grid is an O(rows) scan plus a sort — cheap once, but
  // hovering fires setHovered on every cell the pointer crosses, and without
  // this memo that recomputed the whole grid from scratch on every one of
  // those renders. At a zoomed-in scale the pointer crosses many cells a
  // second, which is what made the chart visibly stutter.
  const grid = useMemo(() => {
    if (data === null || data.length === 0) return null

    const cellMap = new Map<string, number | null>()
    let minDay = Infinity
    let maxDay = -Infinity
    let maxCount = 0
    const years = new Set<number>()

    for (const row of data) {
      const year = yearOf(row.count_date)
      const day = dayOfYear(row.count_date)
      years.add(year)
      cellMap.set(`${year}-${day}`, row.fish_count)
      if (day < minDay) minDay = day
      if (day > maxDay) maxDay = day
      if (row.fish_count !== null && row.fish_count > maxCount) maxCount = row.fish_count
    }

    const sortedYears = [...years].sort((a, b) => b - a) // most recent on top, same as KeyDetails' year list
    const days = Array.from({ length: maxDay - minDay + 1 }, (_, i) => minDay + i)

    const width = MARGIN.left + days.length * CELL + MARGIN.right
    const gridBottom = MARGIN.top + sortedYears.length * CELL
    const legendY = gridBottom + LEGEND_GAP
    const height = legendY + LEGEND_HEIGHT

    // Evenly-spaced date ticks across whatever the season's actual span is —
    // labeling only exact month-starts left a short season with just one
    // (or zero) ticks, since most seasons don't happen to contain a 1st.
    const daySpan = Math.max(1, maxDay - minDay)
    const dateTicks = Array.from({ length: X_TICK_COUNT }, (_, i) => {
      const day = Math.round(minDay + (i * daySpan) / (X_TICK_COUNT - 1))
      return { day, label: dayOfYearLabel(day) }
    })

    return { cellMap, minDay, maxDay, maxCount, sortedYears, days, width, height, legendY, dateTicks }
  }, [data])

  if (error !== null) return <p className="font-mono text-sm text-red-700">{error}</p>
  if (data === null) return <p className="text-sm text-stone-700">Loading…</p>
  if (data.length === 0 || grid === null) return <p className="text-sm text-stone-700">No daily counts in range.</p>

  const { cellMap, minDay, maxCount, sortedYears, days, width, height, legendY, dateTicks } = grid

  // Square-root, not linear: fish counts are heavily right-skewed (a few
  // huge peak days, many small ones), so a linear scale washes almost
  // everything out near-white next to the peak. Square-rooting the ratio
  // pulls the low-to-mid range up so ordinary days actually show color.
  const colorFor = (count: number | null) =>
    count === null ? NO_DATA : lerpHex(SAGE_LOW, SAGE_HIGH, maxCount > 0 ? Math.sqrt(count / maxCount) : 0)

  return (
    <div className="flex h-full w-full flex-col">
      {/* Fixed pixel size, not scaled to fill — squishing rows to force-fit
          a container defeats the point of spacing them out. Scrolls instead
          when the grid is taller (or wider) than the space it's given. */}
      <div className="min-h-0 flex-1 overflow-auto">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Daily count heatmap by year and calendar date"
        >
          {dateTicks.map((t) => (
            <text
              key={t.day}
              x={MARGIN.left + (t.day - minDay) * CELL}
              y={MARGIN.top - 6}
              textAnchor="middle"
              className="fill-stone-500"
              fontSize={9}
            >
              {t.label}
            </text>
          ))}

          {sortedYears.map((year, rowIndex) => (
            <g key={year}>
              <text
                x={MARGIN.left - 6}
                y={MARGIN.top + rowIndex * CELL + CELL / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-stone-600"
                fontSize={10}
              >
                {year}
              </text>

              {days.map((day, colIndex) => {
                const key = `${year}-${day}`
                // No row at all for this (year, day) reads the same as a row
                // with a null fish_count — both mean "no data," and both get
                // a tile drawn (just a very light one), never a blank gap.
                const count = cellMap.has(key) ? cellMap.get(key)! : null

                const x = MARGIN.left + colIndex * CELL
                const y = MARGIN.top + rowIndex * CELL
                const isHovered = hovered?.year === year && hovered.day === day

                return (
                  <rect
                    key={day}
                    x={x}
                    y={y}
                    width={CELL - 1}
                    height={CELL - 1}
                    rx={1}
                    fill={colorFor(count)}
                    stroke={isHovered ? '#0b0b0b' : 'none'}
                    strokeWidth={isHovered ? 1 : 0}
                    onMouseEnter={() => {
                      const date = new Date(Date.UTC(year, 0, day)).toISOString().slice(0, 10)
                      setHovered({ year, day, date, count })
                    }}
                    onMouseLeave={() => setHovered(null)}
                  />
                )
              })}
            </g>
          ))}

          {/* Sequential legend: the same ramp the cells draw from, min to max. */}
          <g transform={`translate(${MARGIN.left}, ${legendY})`}>
            <defs>
              {/* Stops follow the same sqrt curve colorFor uses, so this
                  preview matches what the cells actually look like instead
                  of a plain linear ramp. */}
              <linearGradient id="heatmap-ramp" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor={lerpHex(SAGE_LOW, SAGE_HIGH, Math.sqrt(0))} />
                <stop offset="25%" stopColor={lerpHex(SAGE_LOW, SAGE_HIGH, Math.sqrt(0.25))} />
                <stop offset="50%" stopColor={lerpHex(SAGE_LOW, SAGE_HIGH, Math.sqrt(0.5))} />
                <stop offset="75%" stopColor={lerpHex(SAGE_LOW, SAGE_HIGH, Math.sqrt(0.75))} />
                <stop offset="100%" stopColor={lerpHex(SAGE_LOW, SAGE_HIGH, Math.sqrt(1))} />
              </linearGradient>
            </defs>
            <rect x={0} y={0} width={80} height={8} rx={2} fill="url(#heatmap-ramp)" />
            <text x={0} y={20} className="fill-stone-500" fontSize={9}>0</text>
            <text x={80} y={20} textAnchor="end" className="fill-stone-500" fontSize={9}>
              {formatCompact(maxCount)}
            </text>

            <rect x={104} y={0} width={8} height={8} rx={1} fill={NO_DATA} />
            <text x={116} y={7} className="fill-stone-500" fontSize={9}>No data</text>
          </g>
        </svg>
      </div>

      {/* Always mounted, even with nothing hovered — letting this line
          appear/disappear on hover changed the flex column's height on
          every single cell crossed, which shifted the scroll container's
          visible size (and so its scroll position) under the pointer. */}
      <p className="mt-1 text-xs text-stone-600">
        {hovered === null ? (
          'Hover a day for its count'
        ) : (
          <>
            <span className="font-semibold text-stone-900">
              {hovered.count === null ? 'No data' : hovered.count.toLocaleString()}
            </span>{' '}
            on {formatDate(hovered.date, { year: true })}
          </>
        )}
      </p>
    </div>
  )
}
