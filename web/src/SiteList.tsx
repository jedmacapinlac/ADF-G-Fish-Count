import { useEffect, useMemo, useRef, useState } from 'react'

import type { LocationFeature } from './types'

type Props = {
  /** All sites, including any without coordinates. */
  sites: LocationFeature[]
  selectedId: number | null
  onSelect: (locationId: number) => void
}

export default function SiteList({ sites, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const selectedRow = useRef<HTMLLIElement | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') return sites
    return sites.filter((f) => f.properties.name.toLowerCase().includes(q))
  }, [query, sites])

  // Selection can come from a pin click, so reveal the matching row.
  useEffect(() => {
    selectedRow.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-stone-300 pt-3 dark:border-slate-800">
      <div className="pb-2">
        <h2 className="text-xs font-semibold tracking-wide text-stone-500 uppercase dark:text-slate-400">
          Select a Site
        </h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter sites…"
          className="mt-2 w-full rounded-lg border border-stone-300 bg-stone-200/70 px-2 py-1.5 text-sm text-stone-900 placeholder:text-stone-500 focus:border-sage-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto pb-2">
        {visible.length === 0 && (
          <li className="px-2 py-3 text-sm text-stone-500">No sites match “{query.trim()}”.</li>
        )}

        {visible.map((feature) => {
          const { location_id, name } = feature.properties
          const isSelected = location_id === selectedId
          const hasCoords = feature.geometry !== null

          return (
            <li key={location_id} ref={isSelected ? selectedRow : null}>
              <button
                type="button"
                disabled={!hasCoords}
                onClick={() => onSelect(location_id)}
                className={`flex w-full items-baseline justify-between gap-2 rounded-r-lg border-l-4 px-2 py-1.5 text-left text-sm ${
                  isSelected
                    ? 'border-sage-600 bg-sage-200/70 font-medium text-stone-900 dark:bg-sage-950/40 dark:text-slate-100'
                    : 'border-transparent hover:bg-stone-200/80 dark:hover:bg-slate-800'
                } ${hasCoords ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
              >
                <span>{name}</span>
                {!hasCoords && (
                  <span className="shrink-0 text-xs text-stone-500 italic">no coordinates</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
