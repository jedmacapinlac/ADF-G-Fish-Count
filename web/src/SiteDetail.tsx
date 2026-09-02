import SeriesPanel from './SeriesPanel'
import { useApi } from './useApi'
import type { LocationFeature, Series } from './types'

type Props = {
  site: LocationFeature | undefined
  speciesId: number | null
  yearFrom: number
  yearTo: number
}

/** The right-hand panel: key details for one (site, species) pair up top, the
 *  tabbed views of that series below.
 *
 *  The species comes from the filter bar and nowhere else — there is no
 *  per-site picker any more, so exactly one series is ever in view and the
 *  panel has no selection state of its own.
 */
export default function SiteDetail({ site, speciesId, yearFrom, yearTo }: Props) {
  const locationId = site?.properties.location_id ?? null
  const { data: series, error } = useApi<Series[]>(
    locationId === null ? null : `/api/locations/${locationId}/series`,
  )

  if (site === undefined || locationId === null) {
    return <Prompt>Select a site on the map or from the list to see what it offers.</Prompt>
  }

  if (error !== null) {
    return (
      <div className="p-6">
        <p className="font-mono text-sm text-red-700">{error}</p>
      </div>
    )
  }

  if (series === null) return <Prompt>Loading series…</Prompt>

  if (speciesId === null) {
    return (
      <Prompt>
        {site.properties.name} has {series.length} series. Pick a species in the filter above to
        see it.
      </Prompt>
    )
  }

  // series is keyed on (location_id, species_id), so a site offers at most one
  // series per species — this can never be ambiguous.
  const match = series.find((s) => s.species_id === speciesId)

  if (match === undefined) {
    return <Prompt>{site.properties.name} has no series for the selected species.</Prompt>
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      {/* Keyed on the series so the shared year resets when the selection
          changes — a year held over from a site with a longer record could fall
          outside the new one entirely. */}
      <SeriesPanel
        key={`${locationId}-${speciesId}`}
        site={site}
        series={match}
        yearFrom={yearFrom}
        yearTo={yearTo}
      />
    </div>
  )
}

/** The panel when there is nothing to show in it yet. */
function Prompt({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <p className="max-w-sm text-center text-sm text-stone-700">{children}</p>
    </div>
  )
}
