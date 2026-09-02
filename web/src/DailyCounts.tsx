import DailyCountsGallery from './DailyCountsGallery'
import { useApi } from './useApi'
import type { CountRow } from './types'

type Props = {
  locationId: number
  speciesId: number
  /** The season this tab shows — KeyDetails' own year picker above, not the
   *  filter bar's range. See SeriesPanel. */
  year: number
}

/** Daily counts for one season, from /api/counts — one bar per day. */
export default function DailyCounts({ locationId, speciesId, year }: Props) {
  const { data, error } = useApi<CountRow[]>(
    `/api/counts?location_id=${locationId}&species_id=${speciesId}&year_from=${year}&year_to=${year}`,
  )

  const rows = data ?? []

  return (
    <section>
      {error !== null && <p className="font-mono text-sm text-red-700">{error}</p>}
      {error === null && data === null && <p className="text-sm text-stone-700">Loading…</p>}
      {data !== null && rows.length === 0 && (
        <p className="text-sm text-stone-700">No daily counts for {year}.</p>
      )}

      {rows.length > 0 && (
        <DailyCountsGallery locationId={locationId} speciesId={speciesId} rows={rows} year={year} />
      )}
    </section>
  )
}
