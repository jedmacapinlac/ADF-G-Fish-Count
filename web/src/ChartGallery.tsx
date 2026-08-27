import { ChartPlaceholderIcon } from './icons'

/** Charts for the Run Overview tab, not yet built.
 *
 *  Total Run, Peak Count, Days Counted, and Cumulative Run all come straight
 *  from the /api/annual rows this tab already fetches. Run Size vs. Series
 *  Average and Best and Worst Years need that same data compared against its
 *  own mean. Run Timing needs the daily rows instead — same data gap the
 *  Timing tab's Unbuilt note already describes.
 *
 *  Swap a tile's placeholder body for the real chart once it's wired up; the
 *  title and square footprint can stay as-is. */
const CHARTS = [
  'Total Run by Year',
  'Peak Count by Year',
  'Days Counted by Year',
  'Run Size vs. Series Average',
  'Best and Worst Years',
  'Cumulative Run to Date',
  'Run Timing by Year',
]

/** A horizontally scrolling row of big square chart tiles under Run
 *  Overview's table — one tile per chart this tab wants eventually, each
 *  just a title and an empty body until something draws into it. */
export default function ChartGallery() {
  return (
    <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
      {CHARTS.map((title) => (
        <ChartPlaceholder key={title} title={title} />
      ))}
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
