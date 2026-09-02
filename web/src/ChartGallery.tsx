import ChartTileGallery from './ChartTileGallery'
import RunTimingChart from './RunTimingChart'
import RunTrendChart from './RunTrendChart'
import TotalRunByYearChart from './TotalRunByYearChart'
import type { AnnualRow } from './types'

type Props = {
  rows: AnnualRow[]
  locationId: number
  speciesId: number
  yearFrom: number
  yearTo: number
}

/** The chart tiles for the Run Overview tab. */
export default function ChartGallery({ rows, locationId, speciesId, yearFrom, yearTo }: Props) {
  return (
    <ChartTileGallery
      charts={[
        { title: 'Total Run by Year', node: <TotalRunByYearChart rows={rows} /> },
        {
          title: 'Run Timing by Year',
          node: (
            <RunTimingChart locationId={locationId} speciesId={speciesId} yearFrom={yearFrom} yearTo={yearTo} />
          ),
        },
        { title: 'Trend Analysis', node: <RunTrendChart rows={rows} /> },
      ]}
    />
  )
}
