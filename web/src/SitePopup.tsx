import { seriesLabel } from './format'
import { useApi } from './useApi'
import type { Series } from './types'

type Props = {
  locationId: number
  name: string
}

/** Contents of a pin's popup: the site name, then the series it offers.
 *
 *  react-leaflet portals popup children into the popup's content node, which
 *  Leaflet only creates once the popup is first opened — so this component
 *  does not mount, and useApi does not fetch, until a pin is clicked.
 *
 *  Leaflet draws the popup card itself and always light, so the classes here
 *  stay light-mode regardless of the page theme.
 */
export default function SitePopup({ locationId, name }: Props) {
  const { data: series, error } = useApi<Series[]>(`/api/locations/${locationId}/series`)

  return (
    <div className="min-w-[13rem] font-sans">
      <h3 className="text-[0.9375rem] font-semibold text-stone-900">{name}</h3>
      <p className="mt-0.5 mb-2 font-mono text-[0.6875rem] text-stone-500">
        Location {locationId}
      </p>

      {error !== null && <p className="font-mono text-xs text-red-700">{error}</p>}
      {error === null && series === null && (
        <p className="text-[0.8125rem] text-stone-500">Loading series…</p>
      )}
      {series !== null && series.length === 0 && (
        <p className="text-[0.8125rem] text-stone-500">No series recorded for this site.</p>
      )}

      {series !== null && series.length > 0 && (
        <ul className="max-h-50 list-none overflow-y-auto">
          {series.map((s) => (
            <li
              key={`${s.species_id}-${s.run ?? ''}`}
              className="flex justify-between gap-3 border-t border-stone-200 py-[3px] text-[0.8125rem]"
            >
              <span className="text-stone-900">{seriesLabel(s)}</span>
              <span className="font-mono text-xs whitespace-nowrap text-stone-500">
                {s.first_year}–{s.last_year}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
