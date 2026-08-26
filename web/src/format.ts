import type { Series } from './types'

/** Null means no count was taken that day; zero means one was taken and no
 *  fish passed. Never render the first as the second. */
export function formatCount(value: number | null): string {
  return value === null ? '—' : value.toLocaleString()
}

/** Stat-tile values: compact past five figures so a large run doesn't outgrow
 *  its card. Null still means no count, not a count of zero.
 *
 *  Deliberately not tabular figures at the caller — these stand alone rather
 *  than in a column, and fixed-width digits look loose at display sizes. */
export function formatCompact(value: number | null): string {
  if (value === null) return '—'
  if (Math.abs(value) < 100_000) return value.toLocaleString()
  return value.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 })
}

/** How a series is named in the UI.
 *
 *  ADF&G bakes the run into its species names ("Sockeye - Late Run"), and the
 *  loader also parses it into series.run — so for most run-tagged series the
 *  two say the same thing. Append the run only when the name doesn't already
 *  carry it, which keeps a separate Run column from being necessary without
 *  assuming which form species.name holds.
 */
export function seriesLabel(series: Series): string {
  const { species_name, run } = series
  if (run === null) return species_name
  if (species_name.toLowerCase().includes(run.toLowerCase())) return species_name
  return `${species_name} · ${run} run`
}
