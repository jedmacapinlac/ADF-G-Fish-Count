import { useState } from 'react'

import SpeciesSelect from './SpeciesSelect'
import { CONTROL, LABEL } from './styles'
import type { Species } from './types'

type YearInputProps = {
  label: string
  value: number
  onChange: (year: number) => void
  min: number
  max: number
}

/** A number input can't sit in an empty state while a controlled `value` prop
 *  keeps forcing a number back in — clearing the field to retype would
 *  immediately snap back to "0". This keeps its own text buffer so it can be
 *  blank mid-edit, and only commits a real year up to the parent once the
 *  text actually parses as one. Blurring while invalid/empty reverts to the
 *  last committed year rather than leaving the field stuck empty. */
function YearInput({ label, value, onChange, min, max }: YearInputProps) {
  const [text, setText] = useState(String(value))

  return (
    <label className="flex flex-col gap-1">
      <span className={LABEL}>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={text}
        onChange={(e) => {
          const next = e.target.value
          setText(next)
          const parsed = Number(next)
          if (next !== '' && Number.isInteger(parsed)) onChange(parsed)
        }}
        onBlur={() => setText(String(value))}
        className={`${CONTROL} w-28 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
    </label>
  )
}

type Props = {
  species: Species[]
  locationId: number | null
  speciesId: number | null
  onSpeciesChange: (speciesId: number | null) => void
  yearFrom: number
  yearTo: number
  onYearFromChange: (year: number) => void
  onYearToChange: (year: number) => void
  yearMin: number
  yearMax: number
}

export default function FilterBar({
  species,
  locationId,
  speciesId,
  onSpeciesChange,
  yearFrom,
  yearTo,
  onYearFromChange,
  onYearToChange,
  yearMin,
  yearMax,
}: Props) {
  const yearsInverted = yearFrom > yearTo

  return (
    <div className="flex flex-wrap items-end gap-4 border-b border-stone-300 bg-stone-100 px-6 py-4">
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Species</span>
        <SpeciesSelect
          species={species}
          locationId={locationId}
          value={speciesId}
          onChange={onSpeciesChange}
        />
      </label>

      <YearInput label="Start year" value={yearFrom} onChange={onYearFromChange} min={yearMin} max={yearMax} />
      <YearInput label="End year" value={yearTo} onChange={onYearToChange} min={yearMin} max={yearMax} />

      {/* Swapping the values silently would hide the mistake; say so instead. */}
      {yearsInverted && (
        <p className="pb-1.5 text-sm text-red-700">Start year is after end year.</p>
      )}
    </div>
  )
}
