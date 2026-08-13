from fastapi import APIRouter
from sqlalchemy import text

from .db import engine

router = APIRouter(prefix="/api", tags=["fish counts"])

@router.get("/locations")
def list_locations():
    """GeoJSON FeatureCollection of the counting sites — drives the map.

    One feature per location: a Point geometry built from locations.latitude /
    longitude, and properties carrying the location id, the name, and the series
    available there (species name, run, first_year, last_year) so clicking a pin
    can fill the filter menus without a second request.

    Join locations -> series -> species.

    Watch out:
      - GeoJSON coordinates are [longitude, latitude], not [lat, lon].
      - Yentna River (43) has no coordinates. Decide: omit, or null geometry.
    """

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT name, 
                    latitude, 
                    longitude,
                    location_id
                FROM locations
            """)
        ).mappings().all()
        features = []
        for row in rows:
            features.append({
                "type": "Feature",
                "geometry": { "type": "Point", "coordinates": [row["longitude"], row["latitude"]] },
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


@router.get("/counts")
def list_counts(location_id: int, species_id: int, year_from: int, year_to: int):
    """Daily counts for one series over a year range — what the chart draws.

    Open decisions:
      - Are year bounds inclusive?
      - Is there a maximum span a caller may request?
      - Array of objects, or parallel arrays of dates and values?
      - Empty result for a nonexistent series: 404, or 200 with an empty list?

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

