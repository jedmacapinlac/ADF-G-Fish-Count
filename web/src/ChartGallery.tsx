import { useState } from 'react'

import ChartModal from './ChartModal'
import { ChartPlaceholderIcon, MaximizeIcon } from './icons'
import RunTimingChart from './RunTimingChart'
import RunTrendChart from './RunTrendChart'
import TotalRunByYearChart from './TotalRunByYearChart'
import type { AnnualRow } from './types'

/** Charts for the Run Overview tab, most not yet built.
 *
 *  Peak Count, Days Counted, and Cumulative Run all come straight from the
 *  /api/annual rows this tab already fetches, same as Total Run. Best and
 *  Worst Years needs that same data compared against its own mean.
 *
 *  Swap a tile's placeholder body for the real chart once it's wired up; the
 *  title and square footprint can stay as-is. */
const PLACEHOLDER_CHARTS = [
  'Peak Count by Year',
  'Days Counted by Year',
  'Best and Worst Years',
  'Cumulative Run to Date',
]

type Props = {
  rows: AnnualRow[]
  locationId: number
  speciesId: number
  yearFrom: number
  yearTo: number
}

/** A horizontally scrolling row of big square chart tiles under Run
 *  Overview's table — one tile per chart this tab wants eventually, each
 *  just a title and an empty body until something draws into it.
 *
 *  A finished tile is clickable: it mounts a second, larger copy of the same
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

        {PLACEHOLDER_CHARTS.map((title) => (
          <ChartPlaceholder key={title} title={title} />
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

function ChartPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex aspect-square h-96 w-96 shrink-0 flex-col rounded-xl border border-stone-300 bg-stone-50 p-4 shadow-sm">
      <p className="text-sm font-semibold text-stone-900">{title}</p>
      <div className="mt-2 flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 text-stone-400">
        <ChartPlaceholderIcon className="h-10 w-10" />
        <p className="text-xs">Not wired up yet</p>
      </div>
    </div>
  )
}
