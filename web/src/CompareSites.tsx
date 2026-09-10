import { useState } from 'react'

import ChartTileGallery from './ChartTileGallery'
import CompareAnnualChart, { type SiteRef } from './CompareAnnualChart'
import CompareDaysCountedChart from './CompareDaysCountedChart'
import CompareSitePicker from './CompareSitePicker'
import CompareTimingChart from './CompareTimingChart'
import { ChevronLeftIcon } from './icons'
import { useApi } from './useApi'
import type { CompareAnnualRow, CompareTimingRow, LocationCollection } from './types'

type Props = {
  locationId: number
  speciesId: number
  yearFrom: number
  yearTo: number
  year: number
}

function locationIdParams(ids: number[]): string {
  return ids.map((id) => `location_id=${id}`).join('&')
}

/** Compares the current site's species against other sites that also carry
 *  it — replaces the placeholder note in SeriesData.tsx. Species always
 *  matches by construction (this tab never leaves the currently selected
 *  species, unlike a second independent species picker would), and sites
 *  can have different year ranges, so the comparison charts plot each site
 *  as its own series and let gaps show up as gaps rather than requiring
 *  years to line up. */
export default function CompareSites({ locationId, speciesId, yearFrom, yearTo, year }: Props) {
  const { data: collection, error: sitesError } = useApi<LocationCollection>(
    `/api/locations?species_id=${speciesId}`,
  )
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [collapsed, setCollapsed] = useState(false)

  const allSites = collection?.features ?? []
  const otherSites = allSites.filter((f) => f.properties.location_id !== locationId)
  const primary = allSites.find((f) => f.properties.location_id === locationId)

  const sites: SiteRef[] =
    primary === undefined
      ? []
      : [
          { location_id: primary.properties.location_id, name: primary.properties.name },
          ...selectedIds.flatMap((id) => {
            const f = allSites.find((s) => s.properties.location_id === id)
            return f === undefined ? [] : [{ location_id: id, name: f.properties.name }]
          }),
        ]

  const ids = [locationId, ...selectedIds]
  const annualPath =
    selectedIds.length === 0
      ? null
      : `/api/annual/compare?species_id=${speciesId}&${locationIdParams(ids)}&year_from=${yearFrom}&year_to=${yearTo}`
  const timingPath =
    selectedIds.length === 0
      ? null
      : `/api/timing/compare?species_id=${speciesId}&${locationIdParams(ids)}&year=${year}`

  const { data: annualRows, error: annualError } = useApi<CompareAnnualRow[]>(annualPath)
  const { data: timingRows, error: timingError } = useApi<CompareTimingRow[]>(timingPath)

  const error = sitesError ?? annualError ?? timingError

  return (
    <section>
      {error !== null && <p className="font-mono text-sm text-red-700">{error}</p>}

      {error === null && collection === null && <p className="text-sm text-stone-700">Loading sites…</p>}

      {collection !== null && otherSites.length === 0 && (
        <p className="text-sm text-stone-700">No other sites currently have data for this species.</p>
      )}

      {collection !== null && otherSites.length > 0 && (
        <div className="flex items-start gap-6">
          <div
            className={`shrink-0 rounded-lg border border-stone-300 bg-stone-100 p-3 ${collapsed ? 'w-11' : 'w-64'}`}
          >
            <div className="flex items-center justify-between gap-2">
              {!collapsed && (
                <span className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
                  Compare against
                </span>
              )}
              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? 'Expand site picker' : 'Collapse site picker'}
                aria-expanded={!collapsed}
                className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-900"
              >
                <ChevronLeftIcon
                  className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
                />
              </button>
            </div>

            {collapsed && selectedIds.length > 0 && (
              <p className="mt-2 text-center text-xs font-semibold text-stone-600">{selectedIds.length}</p>
            )}

            {!collapsed && (
              <div className="mt-2">
                <CompareSitePicker
                  sites={allSites}
                  excludeId={locationId}
                  selectedIds={selectedIds}
                  onChange={setSelectedIds}
                  hideLabel
                />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {selectedIds.length === 0 && (
              <p className="text-sm text-stone-700">Select one or more sites to compare.</p>
            )}

            {selectedIds.length > 0 && (
              <ChartTileGallery
                charts={[
                  { title: 'Total Run by Year', node: <CompareAnnualChart rows={annualRows ?? []} sites={sites} /> },
                  { title: `Run Timing (${year})`, node: <CompareTimingChart rows={timingRows ?? []} sites={sites} /> },
                  {
                    title: 'Days Counted by Year',
                    node: <CompareDaysCountedChart rows={annualRows ?? []} sites={sites} />,
                  },
                ]}
              />
            )}
          </div>
        </div>
      )}
    </section>
  )
}
