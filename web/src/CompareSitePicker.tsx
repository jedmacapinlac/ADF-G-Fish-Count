import { useMemo, useState } from 'react'

import { CloseIcon } from './icons'
import { CONTROL, LABEL } from './styles'
import type { LocationFeature } from './types'

type Props = {
  /** Sites already scoped to the current species — every one offered here is
   *  a valid comparison, so no further filtering happens in this component. */
  sites: LocationFeature[]
  /** The primary site, hidden from the list — comparing it against itself
   *  isn't a choice worth offering. */
  excludeId: number
  selectedIds: number[]
  onChange: (ids: number[]) => void
}

/** A compact checklist for picking sites to compare against the primary one.
 *  Sized to sit inside a tab panel rather than the sidebar's full height —
 *  see SiteList.tsx for the fuller single-select version this borrows its
 *  search-filter pattern from. */
export default function CompareSitePicker({ sites, excludeId, selectedIds, onChange }: Props) {
  const [query, setQuery] = useState('')

  const options = useMemo(
    () => sites.filter((f) => f.properties.location_id !== excludeId),
    [sites, excludeId],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') return options
    return options.filter((f) => f.properties.name.toLowerCase().includes(q))
  }, [query, options])

  const selectedSites = options.filter((f) => selectedIds.includes(f.properties.location_id))

  function toggle(locationId: number) {
    onChange(
      selectedIds.includes(locationId)
        ? selectedIds.filter((id) => id !== locationId)
        : [...selectedIds, locationId],
    )
  }

  return (
    <div className="max-w-md">
      <label className={LABEL}>Compare against</label>

      {selectedSites.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedSites.map((f) => (
            <button
              key={f.properties.location_id}
              type="button"
              onClick={() => toggle(f.properties.location_id)}
              className="flex items-center gap-1 rounded-full border border-sage-600 bg-sage-100 py-1 pr-1.5 pl-2.5 text-xs font-medium text-stone-900 hover:bg-sage-200"
            >
              {f.properties.name}
              <CloseIcon className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter sites…"
        className={`${CONTROL} mt-2 w-full`}
      />

      <ul className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-stone-300 bg-stone-50">
        {visible.length === 0 && (
          <li className="px-2 py-3 text-sm text-stone-500">No sites match “{query.trim()}”.</li>
        )}

        {visible.map((f) => {
          const { location_id, name } = f.properties
          const checked = selectedIds.includes(location_id)
          return (
            <li key={location_id}>
              <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm hover:bg-stone-200/60">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(location_id)}
                  className="accent-sage-600"
                />
                <span className={checked ? 'font-medium text-stone-900' : 'text-stone-800'}>{name}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
