import { useState } from 'react'

import DailyCounts from './DailyCounts'
import RunOverview from './RunOverview'
import Tabs from './Tabs'
import TimingGallery from './TimingGallery'
import type { TabId } from './seriesTabs'

type Props = {
  locationId: number
  speciesId: number
  yearFrom: number
  yearTo: number
  /** The single season Daily Counts reads, shared with KeyDetails above —
   *  see SeriesPanel. */
  year: number
}

/** The tabbed views of one series.
 *
 *  Only the active tab is mounted, so each panel's fetch fires when its tab is
 *  first opened rather than all of them on load. Tab state lives here, and
 *  SiteDetail is keyed on the site, so changing sites resets it to the first tab.
 */
export default function SeriesData({ locationId, speciesId, yearFrom, yearTo, year }: Props) {
  const [tab, setTab] = useState<TabId>('run-overview')

  const rangeProps = { locationId, speciesId, yearFrom, yearTo }

  return (
    <div className="mt-6">
      <Tabs active={tab} onChange={setTab} />

      <div className="pt-4">
        {tab === 'run-overview' && <RunOverview {...rangeProps} />}
        {tab === 'daily-counts' && <DailyCounts locationId={locationId} speciesId={speciesId} year={year} />}
        {tab === 'timing' && (
          <TimingGallery
            locationId={locationId}
            speciesId={speciesId}
            yearFrom={yearFrom}
            yearTo={yearTo}
            year={year}
          />
        )}
        {tab === 'compare-sites' && (
          <Unbuilt>
            This species across other sites. Nothing on the page holds that data, and asking
            /api/annual once per site would be ~100 requests — it needs a route that aggregates
            across locations in SQL.
          </Unbuilt>
        )}
        {tab === 'statistics' && (
          <Unbuilt>
            Summary figures for the series — mean and median run size, year-over-year change, best
            and worst years. All derivable from the /api/annual rows the Run Overview tab already
            fetches.
          </Unbuilt>
        )}
      </div>
    </div>
  )
}

/** A tab that exists but has no content yet, with a note on what would fill it. */
function Unbuilt({ children }: { children: React.ReactNode }) {
  return <p className="max-w-2xl text-sm text-stone-500">{children}</p>
}
