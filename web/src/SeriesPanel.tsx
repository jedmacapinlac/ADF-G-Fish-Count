import { useState } from 'react'

import KeyDetails from './KeyDetails'
import SeriesData from './SeriesData'
import type { LocationFeature, Series } from './types'

type Props = {
  site: LocationFeature
  series: Series
  yearFrom: number
  yearTo: number
}

/** Owns the single "selected year" shared by KeyDetails' cards and the Daily
 *  Counts tab's per-day chart — separate from the filter bar's yearFrom/yearTo
 *  range, which scopes the other tabs.
 *
 *  SiteDetail keys this component on (locationId, speciesId), so switching
 *  site or species remounts it and resets the year, rather than carrying over
 *  a season that might not exist in the new series.
 */
export default function SeriesPanel({ site, series, yearFrom, yearTo }: Props) {
  // Most recent season first — the default anyone wants on opening a site.
  const [year, setYear] = useState(series.last_year)

  return (
    <>
      <KeyDetails site={site} series={series} year={year} onYearChange={setYear} />
      <SeriesData
        locationId={site.properties.location_id}
        speciesId={series.species_id}
        yearFrom={yearFrom}
        yearTo={yearTo}
        year={year}
      />
    </>
  )
}
