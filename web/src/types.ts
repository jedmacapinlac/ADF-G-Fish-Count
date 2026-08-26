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
