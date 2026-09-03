import ChartTileGallery from './ChartTileGallery'
import TimingHeatmapChart from './TimingHeatmapChart'
import TimingMilestonesChart from './TimingMilestonesChart'

type Props = {
  locationId: number
  speciesId: number
  yearFrom: number
  yearTo: number
  year: number
}

/** The chart tiles for the Timing tab — same expand-on-click gallery as the
 *  other tabs. The milestones tile is scoped to one season (the picker
 *  above); the heatmap needs the filter bar's whole range instead, since a
 *  single year has nothing to make rows out of. */
export default function TimingGallery({ locationId, speciesId, yearFrom, yearTo, year }: Props) {
  return (
    <ChartTileGallery
      charts={[
        {
          title: `Run Timing Milestones (${year})`,
          node: <TimingMilestonesChart locationId={locationId} speciesId={speciesId} year={year} />,
        },
        {
          title: `Daily Count Heatmap (${yearFrom}–${yearTo})`,
          node: (
            <TimingHeatmapChart locationId={locationId} speciesId={speciesId} yearFrom={yearFrom} yearTo={yearTo} />
          ),
        },
      ]}
    />
  )
}
