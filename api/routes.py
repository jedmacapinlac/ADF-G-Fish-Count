from fastapi import APIRouter, Query
from sqlalchemy import text

from .db import engine

router = APIRouter(prefix="/api", tags=["fish counts"])

@router.get("/locations")
def list_locations(species_id: int | None = None):
    """GeoJSON FeatureCollection of the counting sites — drives the map.

    One feature per location: a Point geometry built from locations.latitude /
    longitude, plus the location id and name in properties. The series offered at
    a site are fetched on demand from /locations/{id}/series when a pin is
    clicked, rather than being inlined here.

    Sites with no coordinates (Yentna River, 43) are emitted with a null
    geometry. That is valid GeoJSON — Leaflet skips such features when drawing —
    and it keeps the site present in the response for non-map views.

    Note: GeoJSON coordinates are [longitude, latitude], not [lat, lon].

    species_id is optional: when given, only sites that have a series for
    that species are returned — this is what scopes the Compare Sites picker
    to sites that are actually comparable.
    """

    with engine.connect() as conn:
        if species_id is None:
            rows = conn.execute(
                text("""
                    SELECT name,
                        latitude,
                        longitude,
                        location_id
                    FROM locations
                """)
            ).mappings().all()
        else:
            rows = conn.execute(
                text("""
                    SELECT l.name,
                        l.latitude,
                        l.longitude,
                        l.location_id
                    FROM locations l
                    JOIN series s USING (location_id)
                    WHERE s.species_id = :species_id
                """),
                {"species_id": species_id},
            ).mappings().all()

        features = []
        for row in rows:
            if row["latitude"] is None or row["longitude"] is None:
                geometry = None
            else:
                geometry = {
                    "type": "Point",
                    "coordinates": [row["longitude"], row["latitude"]],
                }
            features.append({
                "type": "Feature",
                "geometry": geometry,
                "properties": { "location_id": row["location_id"], "name": row["name"] }
            })
        return {"type" : "FeatureCollection", "features" : features}
            
@router.get("/species")
def list_species():
    """The 11 species, for a global 'all sockeye sites' style filter."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
            SELECT species_id, name 
                FROM species 
                ORDER BY name
            """)
        ).mappings().all()
    return [dict(row) for row in rows]


@router.get("/locations/{location_id}/series")
def list_series_for_location(location_id: int):
    """What one site offers: species, run, and the year range for each."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT sp.species_id,
                       sp.name AS species_name,
                       s.run,
                       s.first_year,
                       s.last_year,
                       s.n_records
                FROM series s
                JOIN species sp USING (species_id)
                WHERE s.location_id = :location_id
                ORDER BY sp.name
            """),
            {"location_id": location_id},
        ).mappings().all()
    return [dict(row) for row in rows]

@router.get("/timing")
def get_timing(location_id: int, species_id: int, year_from: int, year_to: int):
    """
    Calculates how run builds up over season, day by day for a single site and species for a given year range.
    """
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                WITH counted_days AS (
                    SELECT year,
                        count_date,
                        fish_count
                    FROM daily_counts
                    WHERE location_id = :location_id
                    AND species_id = :species_id
                    AND year >= :year_from
                    AND year <= :year_to
                    AND fish_count IS NOT NULL
                )
                SELECT
                    year,
                    count_date,
                    EXTRACT(DOY FROM count_date)::int AS day_of_year,
                    SUM(fish_count) OVER (
                        PARTITION BY year
                        ORDER BY count_date
                    ) AS cumulative_count,
                    ROUND(
                        100.0 * SUM(fish_count) OVER (PARTITION BY year ORDER BY count_date)
                        / NULLIF(SUM(fish_count) OVER (PARTITION BY year), 0),
                        2
                    ) AS pct_of_total
                FROM counted_days
                ORDER BY year, count_date;
            """),
            {"location_id": location_id,
            "species_id": species_id,
            "year_from": year_from,
            "year_to": year_to,
            }            
        ).mappings().all()
    return [dict(row) for row in rows]
        
@router.get("/counts")
def list_counts(location_id: int, species_id: int, year_from: int, year_to: int):
    """
    Daily counts for one series over a year range — what the chart draws.

    fish_count is nullable: NULL means no count was taken that day, which is
    different from 0. Do not coerce one into the other.
    """

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT fish_count, 
                    count_date 
                FROM daily_counts
                WHERE location_id = :location_id
                    AND species_id = :species_id
                    AND year >= :year_from 
                    AND year <= :year_to
                ORDER BY count_date
            """),
            {"location_id" : location_id,
             "species_id": species_id,
             "year_from": year_from,
             "year_to": year_to
            }
        ).mappings().all()
    return [dict(row) for row in rows]


@router.get("/annual")
def list_annual(location_id: int, species_id: int):
    """Per-year totals for one series — trends, and the basis for site comparison.

    Aggregate in SQL (GROUP BY year), not in Python. The database should return
    roughly what the chart plots.
    """
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT year,
                       SUM(fish_count)   AS total_count,
                       COUNT(fish_count) AS days_counted,
                       MAX(fish_count)   AS peak_count
                FROM daily_counts
                WHERE location_id = :location_id
                  AND species_id = :species_id
                GROUP BY year
                ORDER BY year
            """),
            {"location_id" : location_id,
             "species_id" : species_id,
            }
        ).mappings().all()
        return [dict(row) for row in rows]

@router.get("/annual/compare")
def compare_annual(
    species_id: int,
    location_id: list[int] = Query(...),
    year_from: int | None = None,
    year_to: int | None = None,
):
    """Per-year totals for one species across several sites at once.

    The multi-location version of /annual — one grouped query instead of one
    request per site, per its docstring's own note that /annual is "the
    basis for site comparison". year_from/year_to are optional so the full
    range each site has is included when the caller doesn't narrow it.
    """
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT location_id,
                       year,
                       SUM(fish_count)   AS total_count,
                       COUNT(fish_count) AS days_counted,
                       MAX(fish_count)   AS peak_count
                FROM daily_counts
                WHERE species_id = :species_id
                  AND location_id = ANY(:location_ids)
                  AND (:year_from IS NULL OR year >= :year_from)
                  AND (:year_to IS NULL OR year <= :year_to)
                GROUP BY location_id, year
                ORDER BY location_id, year
            """),
            {
                "species_id": species_id,
                "location_ids": location_id,
                "year_from": year_from,
                "year_to": year_to,
            },
        ).mappings().all()
    return [dict(row) for row in rows]


@router.get("/timing/compare")
def compare_timing(species_id: int, year: int, location_id: list[int] = Query(...)):
    """How the run builds up over one season, for several sites at once.

    The multi-location version of /timing, scoped to a single year rather
    than a range — comparing run *shape* across sites for one season, not an
    average blurred across several.
    """
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                WITH counted_days AS (
                    SELECT location_id,
                        count_date,
                        fish_count
                    FROM daily_counts
                    WHERE species_id = :species_id
                    AND year = :year
                    AND location_id = ANY(:location_ids)
                    AND fish_count IS NOT NULL
                )
                SELECT
                    location_id,
                    EXTRACT(DOY FROM count_date)::int AS day_of_year,
                    SUM(fish_count) OVER (
                        PARTITION BY location_id
                        ORDER BY count_date
                    ) AS cumulative_count,
                    ROUND(
                        100.0 * SUM(fish_count) OVER (PARTITION BY location_id ORDER BY count_date)
                        / NULLIF(SUM(fish_count) OVER (PARTITION BY location_id), 0),
                        2
                    ) AS pct_of_total
                FROM counted_days
                ORDER BY location_id, count_date;
            """),
            {
                "species_id": species_id,
                "year": year,
                "location_ids": location_id,
            },
        ).mappings().all()
    return [dict(row) for row in rows]

