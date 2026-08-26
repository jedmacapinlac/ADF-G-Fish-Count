import { formatCount } from './format'
import { TD, TH } from './styles'
import { useApi } from './useApi'
import type { CountRow } from './types'

type Props = {
  locationId: number
  speciesId: number
  yearFrom: number
  yearTo: number
}

/** Daily rows are capped so a 30-year series doesn't put ~10,000 <tr>s in the
 *  DOM. The full count is still reported above the table. */
const DAILY_ROW_LIMIT = 500

/** Raw daily rows for one series, from /api/counts. */
export default function DailyCounts({ locationId, speciesId, yearFrom, yearTo }: Props) {
  const rangeIsValid = yearFrom <= yearTo

  const { data, error } = useApi<CountRow[]>(
    rangeIsValid
      ? `/api/counts?location_id=${locationId}&species_id=${speciesId}&year_from=${yearFrom}&year_to=${yearTo}`
      : null,
  )

  const rows = data ?? []

  return (
    <section>
      <p className="font-mono text-xs text-stone-600">/api/counts</p>

      {!rangeIsValid && (
        <p className="mt-2 text-sm text-stone-700">Fix the year range to load daily counts.</p>
      )}
      {error !== null && <p className="mt-2 font-mono text-sm text-red-700">{error}</p>}
      {rangeIsValid && error === null && data === null && (
        <p className="mt-2 text-sm text-stone-700">Loading…</p>
      )}
      {data !== null && rows.length === 0 && (
        <p className="mt-2 text-sm text-stone-700">No daily counts in the selected range.</p>
      )}

      {rows.length > 0 && (
        <>
          <p className="mt-1 text-xs text-stone-600">
            {rows.length.toLocaleString()} rows
            {rows.length > DAILY_ROW_LIMIT &&
              ` · showing the first ${DAILY_ROW_LIMIT.toLocaleString()}`}
          </p>
          <div className="mt-1 max-h-96 w-full overflow-y-auto rounded-lg border border-stone-300 bg-stone-50">
            <table className="w-full">
              <thead className="sticky top-0 border-b border-stone-300 bg-stone-100">
                <tr>
                  <th className={`${TH} pl-3`}>Date</th>
                  <th className={TH}>Count</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, DAILY_ROW_LIMIT).map((row) => (
                  <tr key={row.count_date} className="border-b border-stone-200 last:border-0">
                    <td className={`${TD} pl-3 text-stone-900`}>{row.count_date}</td>
                    <td className={TD}>{formatCount(row.fish_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
