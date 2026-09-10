import { useState } from 'react'

import CompareSites from './CompareSites'
import DailyCounts from './DailyCounts'
import RunOverview from './RunOverview'
import Statistics from './Statistics'
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
          <CompareSites
            key={speciesId}
            locationId={locationId}
            speciesId={speciesId}
            yearFrom={yearFrom}
            yearTo={yearTo}
            year={year}
          />
        )}
        {tab === 'statistics' && <Statistics {...rangeProps} year={year} />}
      </div>
    </div>
  )
}
