/** Pure statistics over annual/daily rows for the Statistics tab — no
 *  fetching, no React. Mirrors how RunTrendChart.tsx already hand-rolls
 *  linearRegression() locally; this project has no stats library dependency. */

import type { AnnualRow, CountRow } from './types'

export function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/** Sample standard deviation (n-1 denominator) — these are always a sample
 *  of years, never the full population of possible years. */
export function stddevSample(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

/** Where `target` falls among `values`, as a percentile (0-100): the share
 *  of values at or below it. */
export function percentileRank(values: number[], target: number): number {
  const atOrBelow = values.filter((v) => v <= target).length
  return (100 * atOrBelow) / values.length
}

const MIN_TREND_YEARS = 4

export type MannKendallResult = {
  tau: number
  z: number
  pValue: number
  trend: 'increasing' | 'decreasing' | 'no trend'
}

/** Standard normal CDF via the Abramowitz-Stegun approximation — good to
 *  ~1e-7, plenty for a trend-significance label. */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}

/** Mann-Kendall trend test over (years[i], values[i]) pairs: non-parametric,
 *  robust to a skewed/non-normal distribution like fish counts (unlike a
 *  least-squares fit, which RunTrendChart.tsx already draws for Run
 *  Overview). Returns null with fewer than MIN_TREND_YEARS points — too few
 *  to say anything meaningful about a trend. */
export function mannKendall(years: number[], values: number[]): MannKendallResult | null {
  const n = values.length
  if (n < MIN_TREND_YEARS) return null

  let s = 0
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      s += Math.sign(values[j] - values[i])
    }
  }

  // Tie correction: groups of equal values reduce the variance relative to
  // an all-distinct series.
  const tieGroups = new Map<number, number>()
  for (const v of values) tieGroups.set(v, (tieGroups.get(v) ?? 0) + 1)
  let tieSum = 0
  for (const count of tieGroups.values()) {
    if (count > 1) tieSum += count * (count - 1) * (2 * count + 5)
  }

  const variance = (n * (n - 1) * (2 * n + 5) - tieSum) / 18
  const z = s > 0 ? (s - 1) / Math.sqrt(variance) : s < 0 ? (s + 1) / Math.sqrt(variance) : 0
  const pValue = 2 * (1 - normalCdf(Math.abs(z)))

  const maxS = (n * (n - 1)) / 2
  const tau = s / maxS

  const trend = pValue < 0.05 ? (s > 0 ? 'increasing' : 'decreasing') : 'no trend'

  return { tau, z, pValue, trend }
}

/** Sen's slope: the median of every pairwise slope between (years[i],
 *  values[i]) and (years[j], values[j]) for i<j — a robust trend magnitude
 *  that pairs with Mann-Kendall's significance, sturdier against one outlier
 *  year than an ordinary least-squares slope. Same minimum-points guard as
 *  mannKendall. */
export function sensSlope(years: number[], values: number[]): number | null {
  const n = values.length
  if (n < MIN_TREND_YEARS) return null

  const slopes: number[] = []
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      if (years[j] !== years[i]) slopes.push((values[j] - values[i]) / (years[j] - years[i]))
    }
  }
  return slopes.length === 0 ? null : median(slopes)
}

export type CompletenessRow = {
  year: number
  daysCounted: number
  fractionOfBest: number
  flagged: boolean
}

/** A year is flagged when its days_counted falls below `threshold` of the
 *  best-covered year at this site within the rows given — self-calibrating
 *  per site rather than a fixed day count, since season length and typical
 *  monitoring cadence both vary a lot by site. */
export function completenessFlags(rows: AnnualRow[], threshold = 0.5): CompletenessRow[] {
  const maxDays = Math.max(0, ...rows.map((r) => r.days_counted))
  if (maxDays === 0) return []

  return rows
    .map((r) => {
      const fractionOfBest = r.days_counted / maxDays
      return { year: r.year, daysCounted: r.days_counted, fractionOfBest, flagged: fractionOfBest < threshold }
    })
    .sort((a, b) => a.year - b.year)
}

/** Postgres's EXTRACT(DOY) equivalent — Jan 1 is 1, matching /api/timing's
 *  day_of_year convention elsewhere in this app. */
function dayOfYear(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const start = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.floor((d.getTime() - start) / 86_400_000) + 1
}

function yearOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCFullYear()
}

export type TimingConsistency = {
  meanPeakDay: number
  medianPeakDay: number
  stddevPeakDay: number
  yearsUsed: number
}

/** For each year present in `rows`, finds the day-of-year of that year's
 *  single highest fish_count (same technique KeyDetails.tsx already uses
 *  for one year's peak date, repeated across every year here), then reports
 *  the mean/median/spread of those peak days across years — how consistent
 *  the run's timing is, independent of its size. A year with every
 *  fish_count null contributes no peak day. Ties within a year (more than
 *  one day sharing the max) use the earliest such day. */
export function peakDayOfYearStats(rows: CountRow[]): TimingConsistency | null {
  const bestByYear = new Map<number, { count: number; day: number }>()
  for (const row of rows) {
    if (row.fish_count === null) continue
    const year = yearOf(row.count_date)
    const day = dayOfYear(row.count_date)
    const best = bestByYear.get(year)
    if (best === undefined || row.fish_count > best.count) bestByYear.set(year, { count: row.fish_count, day })
  }

  const peakDays = [...bestByYear.values()].map((v) => v.day)
  if (peakDays.length === 0) return null

  return {
    meanPeakDay: mean(peakDays),
    medianPeakDay: median(peakDays),
    stddevPeakDay: stddevSample(peakDays),
    yearsUsed: peakDays.length,
  }
}
