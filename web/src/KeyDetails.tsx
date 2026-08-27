import { useState } from 'react'

import { seriesLabel } from './format'
import StatCard from './StatCard'
import { CONTROL, LABEL } from './styles'
import { useApi } from './useApi'
import type { AnnualRow, CountRow, LocationFeature, Series } from './types'

type Props = {
  site: LocationFeature
  series: Series
}

/** The top half of the right panel: what is selected, one year of it, and six
 *  figures about that year.
 *
 *  This section has its own year, separate from the filter bar's range — the
 *  cards describe a single season, while the tabs below cover the range. Both
 *  are labelled so the two are not mistaken for each other.
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
export default function KeyDetails({ site, series }: Props) {
  // Most recent season first — the default anyone wants on opening a site.
  const [year, setYear] = useState(series.last_year)

  const { data: annual, error: annualError } = useApi<AnnualRow[]>(
    `/api/annual?location_id=${site.properties.location_id}&species_id=${series.species_id}`
  )

  const { data: peak, error: peakError } = useApi<CountRow[]>(
    `/api/counts?location_id=${site.properties.location_id}&species_id=${series.species_id}&year_from=${year}&year_to=${year}`
  )
  const error = annualError ?? peakError
  const row = (annual ?? []).find((r) => r.year === year)

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
  }[] = [
    {
      label: 'Total run',
      value: row?.total_count ?? null,
      hint: `Escapement in ${year}`,
      delta: null,
      deltaLabel: 'vs. series mean',
    },
    { label: 'Peak day', 
      value: null, 
      hint: 'Highest single-day count' 
    },
    { label: 'Peak date', 
      value: null, hint: 
      'When the run crested' 
    },
    { label: 'Days counted',
      value: null, 
      hint: `Days with a count in ${year}` 
    },
    { label: 'Season span', 
      value: null, 
      hint: 'First to last count' 
    },
    { label: 'Rank', 
      value: null,
      hint: `Of ${years.length} years on record` 
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
            onChange={(e) => setYear(Number(e.target.value))}
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
