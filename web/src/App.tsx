import { useEffect, useMemo, useState } from 'react'

import { fetchJson, isAbortError, toMessage } from './api'
import FilterBar from './FilterBar'
import { ChevronLeftIcon } from './icons'
import SiteDetail from './SiteDetail'
import SiteList from './SiteList'
import SiteMap from './SiteMap'
import type { LocationCollection, LocationFeature, Species } from './types'

/** No route exposes the global year range yet — a /api/meta returning
 *  min(year)/max(year) from daily_counts would. Until then these bound the
 *  year inputs; the data itself starts in 1974. */
const YEAR_MIN = 1974
const YEAR_MAX = new Date().getFullYear()

function App() {
  const [features, setFeatures] = useState<LocationFeature[] | null>(null)
  const [species, setSpecies] = useState<Species[]>([])
  const [error, setError] = useState<string | null>(null)

  const [sitePanelCollapsed, setSitePanelCollapsed] = useState(false)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [speciesId, setSpeciesId] = useState<number | null>(null)
  const [yearFrom, setYearFrom] = useState(YEAR_MIN)
  const [yearTo, setYearTo] = useState(YEAR_MAX)

  useEffect(() => {
    const controller = new AbortController()

    Promise.all([
      fetchJson<LocationCollection>('/api/locations', controller.signal).then((data) =>
        setFeatures(data.features),
      ),
      fetchJson<Species[]>('/api/species', controller.signal).then(setSpecies),
    ]).catch((err: unknown) => {
      if (!isAbortError(err)) setError(toMessage(err))
    })

    return () => controller.abort()
  }, [])

  // /api/locations has no ORDER BY, so the order is whatever Postgres returns.
  const sites = useMemo(
    () =>
      [...(features ?? [])].sort((a, b) => a.properties.name.localeCompare(b.properties.name)),
    [features],
  )

  // A null geometry (a site with no coordinates) can't be drawn on the map,
  // but it still belongs in the list.
  const mappable = useMemo(() => sites.filter((f) => f.geometry !== null), [sites])
  const unmapped = sites.length - mappable.length
  const selected = sites.find((f) => f.properties.location_id === selectedId)

  return (
    <div className="flex h-full flex-col bg-stone-200 text-stone-600">
      <header className="flex items-baseline gap-4 border-b border-stone-300 bg-stone-100 px-5 py-3">
        <h1 className="text-lg font-semibold tracking-tight text-stone-900">
          ADF&amp;G Fish Counts
        </h1>
        <p className="text-sm">
          {error !== null && <span className="font-mono text-red-700">{error}</span>}
          {error === null && features === null && 'Loading sites…'}
          {error === null && features !== null && (
            <>
              {mappable.length} sites
              {unmapped > 0 && (
                <span className="opacity-70"> · {unmapped} without coordinates</span>
              )}
            </>
          )}
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          className={`flex min-h-0 w-full shrink-0 flex-col border-b border-stone-300 bg-stone-100 lg:border-r lg:border-b-0 ${
            sitePanelCollapsed ? 'gap-0 px-2 py-3 lg:w-12' : 'gap-3 px-4 py-4 lg:w-[30rem] lg:pl-6'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            {!sitePanelCollapsed && (
              <h2 className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
                Fish Count Sites
              </h2>
            )}
            <button
              type="button"
              onClick={() => setSitePanelCollapsed((c) => !c)}
              aria-label={sitePanelCollapsed ? 'Expand site panel' : 'Collapse site panel'}
              aria-expanded={!sitePanelCollapsed}
              className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-900"
            >
              <ChevronLeftIcon
                className={`h-4 w-4 transition-transform ${sitePanelCollapsed ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {!sitePanelCollapsed && (
            <>
              {/* isolate: Leaflet's own CSS gives its controls z-index:1000
                  with nothing to contain it — without a stacking context here
                  that leaks out and floats above app UI like the chart modal,
                  no matter how high that UI's own z-index is set. */}
              <div className="isolate h-96 shrink-0 overflow-hidden rounded-xl border border-stone-300 lg:h-[28rem]">
                <SiteMap features={mappable} selectedId={selectedId} onSelect={setSelectedId} />
              </div>

              <SiteList sites={sites} selectedId={selectedId} onSelect={setSelectedId} />
            </>
          )}
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <FilterBar
            species={species}
            locationId={selectedId}
            speciesId={speciesId}
            onSpeciesChange={setSpeciesId}
            yearFrom={yearFrom}
            yearTo={yearTo}
            onYearFromChange={setYearFrom}
            onYearToChange={setYearTo}
            yearMin={YEAR_MIN}
            yearMax={YEAR_MAX}
          />

          {/* Keying on the site remounts the panel when it changes, which
              clears the series it had picked — a leftover selection from the
              previous site would be meaningless here. */}
          <SiteDetail
            key={selectedId ?? 'none'}
            site={selected}
            speciesId={speciesId}
            yearFrom={yearFrom}
            yearTo={yearTo}
          />
        </main>
      </div>
    </div>
  )
}

export default App
