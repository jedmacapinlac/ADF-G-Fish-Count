import ChartTileGallery from './ChartTileGallery'
import CumulativeCountChart from './CumulativeCountChart'
import DailyCountsChart from './DailyCountsChart'
import type { CountRow } from './types'

type Props = {
  locationId: number
  speciesId: number
  rows: CountRow[]
  year: number
}

/** The chart tiles for the Daily Counts tab — same expand-on-click gallery
 *  as Run Overview's ChartGallery, just scoped to one season's daily rows. */
export default function DailyCountsGallery({ locationId, speciesId, rows, year }: Props) {
  return (
    <ChartTileGallery
      charts={[
        { title: `Daily Count (${year})`, node: <DailyCountsChart rows={rows} /> },
        {
          title: `Cumulative Total (${year})`,
          node: <CumulativeCountChart locationId={locationId} speciesId={speciesId} year={year} rows={rows} />,
        },
      ]}
    />
  )
}
