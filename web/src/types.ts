/** Shapes returned by the FastAPI routes in api/routes.py. */

export type LocationProperties = {
  location_id: number
  name: string
}

/** GeoJSON coordinates are [longitude, latitude]. Sites without coordinates
 *  come back with a null geometry — see list_locations(). */
export type LocationFeature = {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] } | null
  properties: LocationProperties
}

export type LocationCollection = {
  type: 'FeatureCollection'
  features: LocationFeature[]
}

export type Species = {
  species_id: number
  name: string
}

export type Series = {
  species_id: number
  species_name: string
  run: string | null
  first_year: number
  last_year: number
  n_records: number
}

/** A row from /api/annual. total_count and peak_count are null when every
 *  fish_count in that year is null. */
export type AnnualRow = {
  year: number
  total_count: number | null
  days_counted: number
  peak_count: number | null
}

/** A row from /api/counts. A null fish_count means no count was taken that
 *  day, which is not the same as a count of zero — never coerce it. */
export type CountRow = {
  count_date: string
  fish_count: number | null
}

/** A row from /api/timing — one counted day, with its running share of that
 *  year's total. No-count days are excluded server-side entirely (they never
 *  appear as a row), so every row here is a real, counted day.
 *
 *  pct_of_total is only null in the edge case where a year's total is
 *  legitimately zero (every day counted, every count zero) — nothing to take
 *  a percentage of. */
export type TimingRow = {
  year: number
  count_date: string
  day_of_year: number
  cumulative_count: number
  pct_of_total: number | null
}
