import { ChartPlaceholderIcon } from './icons'
import TotalRunByYearChart from './TotalRunByYearChart'
import type { AnnualRow } from './types'

/** Charts for the Run Overview tab, most not yet built.
 *
 *  Peak Count, Days Counted, and Cumulative Run all come straight from the
 *  /api/annual rows this tab already fetches, same as Total Run. Run Size vs.
 *  Series Average and Best and Worst Years need that same data compared
 *  against its own mean. Run Timing needs the daily rows instead — same data
 *  gap the Timing tab's Unbuilt note already describes.
 *
 *  Swap a tile's placeholder body for the real chart once it's wired up; the
 *  title and square footprint can stay as-is. */
const PLACEHOLDER_CHARTS = [
  'Peak Count by Year',
  'Days Counted by Year',
  'Run Size vs. Series Average',
  'Best and Worst Years',
  'Cumulative Run to Date',
  'Run Timing by Year',
]

type Props = {
  rows: AnnualRow[]
}

/** A horizontally scrolling row of big square chart tiles under Run
 *  Overview's table — one tile per chart this tab wants eventually, each
 *  just a title and an empty body until something draws into it. */
export default function ChartGallery({ rows }: Props) {
  return (
    <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
      <ChartTile title="Total Run by Year">
        <TotalRunByYearChart rows={rows} />
      </ChartTile>

      {PLACEHOLDER_CHARTS.map((title) => (
        <ChartPlaceholder key={title} title={title} />
      ))}
    </div>
  )
}

function ChartTile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex aspect-square h-96 w-96 shrink-0 flex-col rounded-xl border border-stone-300 bg-stone-50 p-4 shadow-sm">
      <p className="text-sm font-semibold text-stone-900">{title}</p>
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
