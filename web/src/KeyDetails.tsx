import { formatDate, seriesLabel } from './format'
import {
  CalendarCheckIcon,
  CalendarDaysIcon,
  MedalIcon,
  PeakIcon,
  SpanIcon,
  TrendingUpIcon,
} from './icons'
import StatCard from './StatCard'
import { CONTROL, LABEL } from './styles'
import { useApi } from './useApi'
import type { AnnualRow, CountRow, LocationFeature, Series } from './types'

type Props = {
  site: LocationFeature
  series: Series
  /** Shared with the Daily Counts tab's per-day chart — both read the same
   *  selected season. Owned by SeriesPanel, not this component, so the two
   *  stay in sync. */
  year: number
  onYearChange: (year: number) => void
}

/** The top half of the right panel: what is selected, one year of it, and six
 *  figures about that year.
 *
 *  This section's year is separate from the filter bar's range — the cards
 *  describe a single season, while most tabs below cover the range (Daily
 *  Counts follows this same year instead — see SeriesPanel). Both are
 *  labelled so they're not mistaken for each other.
 *
 *  ── Wiring the cards ──────────────────────────────────────────────────────
 *  Every value is null, which renders as an em dash. Fetch what they need at
 *  the top of this component (useApi, same as the tab panels) and drop the
 *  expression into the matching `value:` below. They all key on `year`.
 *
 *  /api/annual gives total_count, days_counted and peak_count per year — enough
 *  for the total, the peak, days counted, and a rank across years. Peak date
 *  and season span need the daily rows, so /api/counts for that one year.
 *  Neither needs a new endpoint.
 */
export default function KeyDetails({ site, series, year, onYearChange }: Props) {
  const { data: annual, error: annualError } = useApi<AnnualRow[]>(
    `/api/annual?location_id=${site.properties.location_id}&species_id=${series.species_id}`
  )

  const { data: dailyRows, error: dailyRowError } = useApi<CountRow[]>(
    `/api/counts?location_id=${site.properties.location_id}&species_id=${series.species_id}&year_from=${year}&year_to=${year}`
  )
  const error = annualError ?? dailyRowError
  const row = (annual ?? []).find((r) => r.year === year)
  const peakDates = (dailyRows ?? []).filter((r) => r.fish_count === row?.peak_count)
  const countedDays = (dailyRows ?? []).filter((r) => r.fish_count !== null)
  const rankedYears = [...(annual ?? [])].sort(
    (a, b) => (b.total_count ?? -Infinity) - (a.total_count ?? -Infinity),
  )
  const rank = row === undefined ? null : rankedYears.findIndex((r) => r.year === year) + 1

  const years = Array.from(
    { length: series.last_year - series.first_year + 1 },
    (_, i) => series.last_year - i,
  )

  const cards: {
    label: string
    value: number | string | null
    hint?: string
    delta?: number | null
    deltaLabel?: string
    icon: React.ComponentType<{ className?: string }>
  }[] = [
    {
      label: `${year} Total`,
      value: row?.total_count ?? null,
      hint: countedDays.length === 0
        ? undefined
        : `Through ${formatDate(countedDays[countedDays.length - 1].count_date)}`,
      delta: null,
      deltaLabel: 'vs. series mean',
      icon: TrendingUpIcon,
    },
    { label: `Peak day (${year})`,
      value: row?.peak_count ?? null,
      hint: 'Highest single-day count',
      icon: PeakIcon,
    },
    { label: 'Peak date',
      value: peakDates.length === 0
        ? null
        : formatDate(peakDates[0].count_date) + (peakDates.length > 1 ? ` (+${peakDates.length - 1})` : ''),
      hint: 'When the run crested',
      icon: CalendarCheckIcon,
    },
    { label: 'Days counted',
      value: row?.days_counted ?? null,
      hint: `Days with a count in ${year}`,
      icon: CalendarDaysIcon,
    },
    { label: 'Season span',
      value: countedDays.length === 0
      ? null
      : `${formatDate(countedDays[0].count_date)}–${formatDate(countedDays[countedDays.length - 1].count_date)}`,
      hint: 'First to last count',
      icon: SpanIcon,
    },
    { label: 'Rank',
      value: rank,
      hint: `Of ${years.length} years on record`,
      icon: MedalIcon,
    },
  ]

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-stone-900">
            {site.properties.name}
            <span className="px-2 font-normal text-stone-400">—</span>
            {seriesLabel(series)}
          </h2>

          <p className="mt-1 text-sm text-stone-700">
            Run of record{' '}
            <span className="font-mono text-stone-900">
              {series.first_year}–{series.last_year}
            </span>
            <span className="text-stone-600">
              {' · '}
              {series.n_records.toLocaleString()} records · location {site.properties.location_id}
            </span>
          </p>
        </div>

        <label className="flex flex-col gap-1">
          <span className={LABEL}>Year</span>
          <select
            value={year}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className={`${CONTROL} w-28`}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error !== null && <p className="mt-3 font-mono text-sm text-red-700">{error}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <p className="mt-2 text-xs text-stone-600">
        These cards cover {year} only. The tabs below follow the year range in the filter bar.
      </p>
    </section>
  )
}
