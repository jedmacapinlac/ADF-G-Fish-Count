import { CONTROL, LABEL } from './styles'
import type { Species } from './types'

type Props = {
  species: Species[]
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
        <select
          value={speciesId ?? ''}
          onChange={(e) => onSpeciesChange(e.target.value === '' ? null : Number(e.target.value))}
          className={`${CONTROL} min-w-44`}
        >
          <option value="">All species</option>
          {species.map((s) => (
            <option key={s.species_id} value={s.species_id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>Start year</span>
        <input
          type="number"
          min={yearMin}
          max={yearMax}
          value={yearFrom}
          onChange={(e) => onYearFromChange(Number(e.target.value))}
          className={`${CONTROL} w-28`}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>End year</span>
        <input
          type="number"
          min={yearMin}
          max={yearMax}
          value={yearTo}
          onChange={(e) => onYearToChange(Number(e.target.value))}
          className={`${CONTROL} w-28`}
        />
      </label>

      {/* Swapping the values silently would hide the mistake; say so instead. */}
      {yearsInverted && (
        <p className="pb-1.5 text-sm text-red-700">Start year is after end year.</p>
      )}
    </div>
  )
}
