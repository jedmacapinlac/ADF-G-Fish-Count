from fastapi import APIRouter

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
    raise NotImplementedError


@router.get("/species")
def list_species():
    """The 11 species, for a global 'all sockeye sites' style filter."""
    raise NotImplementedError


@router.get("/locations/{location_id}/series")
def list_series_for_location(location_id: int):
    """What one site offers: species, run, and the year range for each.

    May turn out to be redundant with /locations if that endpoint already
    embeds the series. Decide whether the map payload is fat and self-sufficient
    or thin with follow-up requests.
    """
    raise NotImplementedError


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
    raise NotImplementedError


@router.get("/annual")
def list_annual(location_id: int, species_id: int):
    """Per-year totals for one series — trends, and the basis for site comparison.

    Aggregate in SQL (GROUP BY year), not in Python. The database should return
    roughly what the chart plots.

    Note 2026 is a partial, in-progress season and will read low.
    """
    raise NotImplementedError
