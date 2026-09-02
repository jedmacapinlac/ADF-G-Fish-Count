import { useEffect, useRef, useState } from 'react'

import { ChevronDownIcon } from './icons'
import { CONTROL } from './styles'
import { useApi } from './useApi'
import type { Series, Species } from './types'

type Props = {
  /** The full species list, used as a fallback until a site's own series
   *  load, and as the source of truth for display names. */
  species: Species[]
  locationId: number | null
  value: number | null
  onChange: (speciesId: number | null) => void
}

type Option = { id: number; name: string }

/** A styled stand-in for the native <select>, scoped to whatever species the
 *  selected site actually has a series for — picking one that leads nowhere
 *  isn't a choice worth offering. A native <select>'s open panel can't be
 *  restyled in most browsers, so matching the rest of this app's look means
 *  building the open/close state, the option list, and the keyboard
 *  interaction by hand instead.
 *
 *  Falls back to the full species list whenever there's no site selected yet,
 *  or while that site's series are still loading — an empty dropdown while
 *  waiting would look broken, and every species is a valid pick with no site
 *  chosen to scope it against.
 *
 *  There is no "All species" option — a value outside what's currently
 *  offered (nothing picked yet, or a site switch that dropped the previous
 *  pick) snaps to the first option instead, so the dropdown always names a
 *  real, in-range choice.
 */
export default function SpeciesSelect({ species, locationId, value, onChange }: Props) {
  const { data: siteSeries } = useApi<Series[]>(
    locationId === null ? null : `/api/locations/${locationId}/series`,
  )

  const available =
    siteSeries === null
      ? species
      : species.filter((sp) => siteSeries.some((s) => s.species_id === sp.species_id))

  const options: Option[] = available.map((sp) => ({ id: sp.species_id, name: sp.name }))
  const selectedIndex = Math.max(0, options.findIndex((o) => o.id === value))
  const selected = options.find((o) => o.id === value) ?? options[0]

  const firstOptionId = options[0]?.id
  useEffect(() => {
    if (firstOptionId !== undefined && !options.some((o) => o.id === value)) {
      onChange(firstOptionId)
    }
    // Re-check whenever the option set's shape or the current value changes —
    // not `options` itself, which is a fresh array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstOptionId, options.length, value, onChange])

  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(selectedIndex)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Click (or tap) outside the control closes it, same as a native <select>.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current !== null && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // Move keyboard focus onto the option list as soon as it opens, so arrow
  // keys work immediately without an extra click.
  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  function openList() {
    setHighlighted(selectedIndex)
    setOpen(true)
  }

  function commit(index: number) {
    onChange(options[index].id)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openList()
          }
        }}
        className={`${CONTROL} flex min-w-44 cursor-pointer items-center justify-between gap-2 bg-white text-left`}
      >
        <span>{selected?.name ?? 'Loading…'}</span>
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-stone-500" />
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setHighlighted((i) => Math.min(i + 1, options.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHighlighted((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              commit(highlighted)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setOpen(false)
            }
          }}
          className="absolute z-10 mt-1 max-h-64 w-full min-w-44 overflow-y-auto rounded-lg border border-stone-300 bg-white py-1 shadow-lg focus:outline-none"
        >
          {options.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={o.id === value}
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => commit(i)}
              className={`cursor-pointer px-3 py-1.5 text-sm ${
                i === highlighted ? 'bg-sage-100 text-stone-900' : 'text-stone-800'
              } ${o.id === value ? 'font-semibold' : ''}`}
            >
              {o.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
