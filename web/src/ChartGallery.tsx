import { useState } from 'react'

import ChartModal from './ChartModal'
import { MaximizeIcon } from './icons'
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

/** A horizontally scrolling row of big square chart tiles for the Run
 *  Overview tab.
 *
 *  A tile is clickable: it mounts a second, larger copy of the same
 *  chart in a modal (its own fetch, its own hover/selector state) rather than
 *  resizing the small one in place, so the small tile keeps rendering
 *  underneath while the modal is open. */
export default function ChartGallery({ rows, locationId, speciesId, yearFrom, yearTo }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const charts: { title: string; node: React.ReactNode }[] = [
    { title: 'Total Run by Year', node: <TotalRunByYearChart rows={rows} /> },
    {
      title: 'Run Timing by Year',
      node: (
        <RunTimingChart locationId={locationId} speciesId={speciesId} yearFrom={yearFrom} yearTo={yearTo} />
      ),
    },
    { title: 'Trend Analysis', node: <RunTrendChart rows={rows} /> },
  ]

  const expandedChart = charts.find((c) => c.title === expanded)

  return (
    <>
      <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
        {charts.map((c) => (
          <ChartTile key={c.title} title={c.title} onExpand={() => setExpanded(c.title)}>
            {c.node}
          </ChartTile>
        ))}
      </div>

      {expandedChart !== undefined && (
        <ChartModal title={expandedChart.title} onClose={() => setExpanded(null)}>
          {expandedChart.node}
        </ChartModal>
      )}
    </>
  )
}

function ChartTile({
  title,
  onExpand,
  children,
}: {
  title: string
  onExpand: () => void
  children: React.ReactNode
}) {
  return (
    <div
      onClick={onExpand}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onExpand()
      }}
      aria-label={`Expand ${title}`}
      className="group flex aspect-square h-96 w-96 shrink-0 cursor-pointer flex-col rounded-xl border border-stone-300 bg-stone-50 p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-stone-900">{title}</p>
        <MaximizeIcon className="h-4 w-4 shrink-0 text-stone-400 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="mt-2 min-h-0 flex-1">{children}</div>
    </div>
  )
}
