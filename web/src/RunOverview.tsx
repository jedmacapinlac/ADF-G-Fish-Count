import ChartGallery from './ChartGallery'
import { useApi } from './useApi'
import type { AnnualRow } from './types'

type Props = {
  locationId: number
  speciesId: number
  yearFrom: number
  yearTo: number
}

/** Per-year totals for one series, from /api/annual. */
export default function RunOverview({ locationId, speciesId, yearFrom, yearTo }: Props) {
  const { data, error } = useApi<AnnualRow[]>(
    `/api/annual?location_id=${locationId}&species_id=${speciesId}`,
  )

  // /api/annual takes no year parameters, so this narrowing happens here.
  const rows = (data ?? []).filter((r) => r.year >= yearFrom && r.year <= yearTo)

  return (
    <section>
      {error !== null && <p className="font-mono text-sm text-red-700">{error}</p>}
      {error === null && data === null && <p className="text-sm text-stone-700">Loading…</p>}

      <ChartGallery rows={rows} locationId={locationId} speciesId={speciesId} yearFrom={yearFrom} yearTo={yearTo} />

      {data !== null && rows.length === 0 && (
        <p className="mt-4 text-sm text-stone-700">No years in the selected range.</p>
      )}
    </section>
  )
}
