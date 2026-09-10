import { dayOfYearLabel } from './format'
import { CalendarCheckIcon, ChartPlaceholderIcon, MedalIcon, SpanIcon, TrendingUpIcon } from './icons'
import StatRow from './StatRow'
import {
  completenessFlags,
  mannKendall,
  mean,
  median,
  peakDayOfYearStats,
  percentileRank,
  sensSlope,
  stddevSample,
} from './statsMath'
import { TD, TH } from './styles'
import { useApi } from './useApi'
import type { AnnualRow, CountRow } from './types'

type Props = {
  locationId: number
  speciesId: number
  yearFrom: number
  yearTo: number
  /** The single season the year picker controls elsewhere on this panel
   *  (KeyDetails/Daily Counts/Timing Milestones). "vs prior year" and
   *  "percentile rank" are pinned to this specific year, not just whichever
   *  year happens to be most recent in range, so they actually move when
   *  the picker changes. */
  year: number
}

type Row = {
  label: string
  value: number | string | null
  description?: string
  delta?: number | null
  deltaLabel?: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
}

type Group = {
  title: string
  rows: Row[]
}

/** A titled panel of StatRows — the Statistics tab's grouping unit. Plain
 *  StatCards (built for KeyDetails' one-line hints) got cramped once these
 *  cards needed a full explanatory sentence each; grouping related stats
 *  into labelled sections of wide rows gives the text room and reads more
 *  like a report than a dashboard strip. */
function StatGroup({ title, rows }: Group) {
  return (
    <div className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">{title}</p>
      <div className="mt-1">
        {rows.map((row) => (
          <StatRow key={row.label} {...row} />
        ))}
      </div>
    </div>
  )
}

/** Summary figures for the series over the selected year range: mean/median
 *  run size, year-over-year change, best/worst years, a Mann-Kendall
 *  trend-significance test with Sen's slope as its magnitude, volatility,
 *  where the selected year ranks historically, a per-year data-completeness
 *  flag, and how consistent the run's timing is across years. Everything
 *  here is derived from /api/annual and /api/counts, the same endpoints
 *  Run Overview and Key Details already fetch. No new backend route. */
export default function Statistics({ locationId, speciesId, yearFrom, yearTo, year }: Props) {
  const { data: annual, error: annualError } = useApi<AnnualRow[]>(
    `/api/annual?location_id=${locationId}&species_id=${speciesId}`,
  )
  const { data: countRows, error: countsError } = useApi<CountRow[]>(
    `/api/counts?location_id=${locationId}&species_id=${speciesId}&year_from=${yearFrom}&year_to=${yearTo}`,
  )

  const error = annualError ?? countsError
  const rows = (annual ?? []).filter((r) => r.year >= yearFrom && r.year <= yearTo)
  const withCounts = rows.filter((r): r is AnnualRow & { total_count: number } => r.total_count !== null)

  if (error !== null) return <p className="font-mono text-sm text-red-700">{error}</p>
  if (annual === null || countRows === null) return <p className="text-sm text-stone-700">Loading…</p>
  if (rows.length === 0) return <p className="text-sm text-stone-700">No years in the selected range.</p>

  const years = withCounts.map((r) => r.year)
  const totals = withCounts.map((r) => r.total_count)

  const selected = withCounts.find((r) => r.year === year)
  const priorYear = withCounts.find((r) => r.year === year - 1)

  const bestYear = withCounts.length === 0 ? null : withCounts.reduce((a, b) => (b.total_count > a.total_count ? b : a))
  const worstYear = withCounts.length === 0 ? null : withCounts.reduce((a, b) => (b.total_count < a.total_count ? b : a))

  const mk = mannKendall(years, totals)
  const sen = sensSlope(years, totals)
  const cv = totals.length < 2 ? null : stddevSample(totals) / mean(totals)
  const percentile = selected === undefined || totals.length === 0 ? null : percentileRank(totals, selected.total_count)
  const timing = peakDayOfYearStats(countRows)
  const flagged = completenessFlags(rows).filter((r) => r.flagged)

  const groups: Group[] = [
    {
      title: 'Run size',
      rows: [
        {
          label: 'Mean',
          value: totals.length === 0 ? null : Math.round(mean(totals)),
          description: `The average total run across the ${totals.length} year${totals.length === 1 ? '' : 's'} in range, pulled toward whichever direction has the more extreme years.`,
          icon: ChartPlaceholderIcon,
          exact: true,
        },
        {
          label: 'Median',
          value: totals.length === 0 ? null : median(totals),
          description: 'The middle year when every total is ranked, less swayed by one huge or tiny season than the mean above.',
          icon: ChartPlaceholderIcon,
          exact: true,
        },
        {
          label: 'Best year',
          value: bestYear?.total_count ?? null,
          description: bestYear !== null ? `The single highest total on record in range, set in ${bestYear.year}.` : undefined,
          icon: SpanIcon,
          exact: true,
        },
        {
          label: 'Worst year',
          value: worstYear?.total_count ?? null,
          description: worstYear !== null ? `The single lowest total on record in range, set in ${worstYear.year}.` : undefined,
          icon: SpanIcon,
          exact: true,
        },
      ],
    },
    {
      title: 'Trend',
      rows: [
        {
          label: `${year} vs prior year`,
          value: selected?.total_count ?? null,
          delta: selected !== undefined && priorYear !== undefined ? selected.total_count - priorYear.total_count : null,
          deltaLabel: priorYear !== undefined ? `vs ${priorYear.year}` : undefined,
          description:
            selected !== undefined && priorYear === undefined
              ? `No count for ${year - 1} to compare against.`
              : `${year}'s total against the year immediately before it, following the year picker above.`,
          icon: TrendingUpIcon,
        },
        {
          label: 'Mann-Kendall trend',
          value: mk === null ? null : mk.trend === 'increasing' ? 'Increasing' : mk.trend === 'decreasing' ? 'Decreasing' : 'No trend',
          description:
            mk === null
              ? 'Needs at least 4 years in range to say anything meaningful about a trend.'
              : `Tests whether counts are reliably rising or falling over the years, not just bouncing around. tau=${mk.tau.toFixed(2)}, p=${mk.pValue.toFixed(3)} (significant under 0.05).`,
          icon: TrendingUpIcon,
        },
        {
          label: "Sen's slope",
          value: sen === null ? null : Math.round(sen),
          description:
            sen === null
              ? 'Needs at least 4 years in range.'
              : "Fish/year change, taken as the median of every pairwise year-to-year comparison, sturdier against one outlier season than a plain best-fit line.",
          icon: TrendingUpIcon,
        },
      ],
    },
    {
      title: 'Variability & timing',
      rows: [
        {
          label: 'Coefficient of variation',
          value: cv === null ? null : `${Math.round(cv * 100)}%`,
          description: 'Year-to-year volatility as a share of the mean. Higher means a less predictable run size from one season to the next.',
          icon: ChartPlaceholderIcon,
        },
        {
          label: 'Percentile rank',
          value: percentile === null ? null : `${Math.round(percentile)}th`,
          description:
            selected === undefined
              ? `No count for ${year} to rank.`
              : `Where ${year}'s total falls among every in-range year, from lowest to highest, following the year picker above.`,
          icon: MedalIcon,
        },
        {
          label: 'Timing consistency',
          value: timing === null ? null : `~${dayOfYearLabel(Math.round(timing.meanPeakDay))}`,
          description:
            timing === null
              ? undefined
              : `Average peak date across ${timing.yearsUsed} year${timing.yearsUsed === 1 ? '' : 's'}, ± ${timing.stddevPeakDay.toFixed(0)} days. A tighter spread means the run arrives around the same time every year.`,
          icon: CalendarCheckIcon,
        },
      ],
    },
  ]

  return (
    <section>
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <StatGroup key={group.title} {...group} />
        ))}
      </div>

      {flagged.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
            Flagged years ({flagged.length} of {rows.length})
          </p>
          <p className="mt-1 text-xs text-stone-600">
            Days counted under half of this site's best-covered year in range. Treat these years' totals with
            caution.
          </p>
          <table className="mt-2 w-full max-w-sm">
            <thead>
              <tr>
                <th className={TH}>Year</th>
                <th className={TH}>Days counted</th>
                <th className={TH}>Of best year</th>
              </tr>
            </thead>
            <tbody>
              {flagged.map((f) => (
                <tr key={f.year}>
                  <td className={TD}>{f.year}</td>
                  <td className={TD}>{f.daysCounted}</td>
                  <td className={TD}>{Math.round(f.fractionOfBest * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
