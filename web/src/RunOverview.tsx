import ChartGallery from './ChartGallery'
import { formatCount } from './format'
import { TD, TH } from './styles'
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
      <p className="font-mono text-xs text-stone-600">/api/annual</p>

      {error !== null && <p className="mt-2 font-mono text-sm text-red-700">{error}</p>}
      {error === null && data === null && <p className="mt-2 text-sm text-stone-700">Loading…</p>}

      <ChartGallery rows={rows} />

      {data !== null && rows.length === 0 && (
        <p className="mt-4 text-sm text-stone-700">No years in the selected range.</p>
      )}

      {rows.length > 0 && (
        <div className="mt-4 max-h-40 w-full overflow-y-auto rounded-lg border border-stone-300 bg-stone-50">
          <table className="w-full">
            <thead className="sticky top-0 border-b border-stone-300 bg-stone-100">
              <tr>
                <th className={`${TH} pl-3`}>Year</th>
                <th className={TH}>Total</th>
                <th className={TH}>Days</th>
                <th className={TH}>Peak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.year} className="border-b border-stone-200 last:border-0">
                  <td className={`${TD} pl-3 text-stone-900`}>{row.year}</td>
                  <td className={TD}>{formatCount(row.total_count)}</td>
                  <td className={TD}>{row.days_counted.toLocaleString()}</td>
                  <td className={TD}>{formatCount(row.peak_count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
