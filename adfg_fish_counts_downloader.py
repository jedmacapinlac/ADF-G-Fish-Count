#!/usr/bin/env python3
"""Download Alaska Department of Fish & Game fish-count data.

The script reads an Excel metadata file with columns such as:

    location_name, chinook_start, chinook_end, sockeye_start, sockeye_end, ...

For every non-empty ``*_start`` / ``*_end`` pair, it resolves the ADF&G
location and species IDs, downloads the requested daily counts, and writes:

* one CSV per location/species/run series;
* one combined CSV containing all downloaded records;
* a download manifest and an error log.

ADF&G's link labeled "Excel format" is actually a tab-delimited text export.
The site expects selected years in descending groups of no more than five; this
script enforces that limit, retries empty batches one year at a time, validates
returned location/species IDs, and never writes a zero-byte series as success.

Example
-------
python adfg_fish_counts_downloader.py \
    --metadata "ADF&G Fish Counts.xlsx" \
    --output-dir adfg_fish_counts

Dependencies
------------
pip install pandas openpyxl requests beautifulsoup4
"""

from __future__ import annotations

import argparse
import csv
import logging
import re
import sys
import time
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from difflib import SequenceMatcher
from io import StringIO
from pathlib import Path
from typing import Iterable
from urllib.parse import urlencode, urljoin

import pandas as pd
import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE_URL = "https://www.adfg.alaska.gov/sf/FishCounts/index.cfm"
HOME_URL = "https://www.adfg.alaska.gov/sf/FishCounts/"

# These are used as page-loading hints and as a last-resort fallback. The
# script normally reads the actual IDs from ADF&G's drop-down menus.
BASE_SPECIES_HINT_IDS: dict[str, int] = {
    "chinook": 410,
    "sockeye": 420,
    "coho": 430,
    "pink": 440,
    "chum": 450,
    "dolly varden": 531,
    "steelhead": 540,
}

# ADF&G uses stable numeric codes for the standard species and for the
# explicitly separated run components.  These codes are safer than inferring
# a species from the page's current search menu because that menu can omit
# historical location/species combinations.
SERIES_ID_MAP: dict[str, tuple[str, int]] = {
    "chinook": ("Chinook", 410),
    "chinook early run": ("Chinook - Early Run", 411),
    "chinook late run": ("Chinook - Late Run", 412),
    "sockeye": ("Sockeye", 420),
    "sockeye early run": ("Sockeye - Early Run", 421),
    "sockeye late run": ("Sockeye - Late Run", 422),
    "coho": ("Coho", 430),
    "pink": ("Pink", 440),
    "chum": ("Chum", 450),
    "chum summer": ("Chum - Summer", 451),
    "dolly varden": ("Dolly Varden", 531),
    "steelhead": ("Steelhead", 540),
}

# Last-resort IDs for run-specific labels. Site menus are preferred because
# some runs are encoded in the location name rather than the species ID.
# ADF&G's public result page displays and exports at most five selected years
# at a time. Requests with larger or differently ordered year lists can return
# an empty response even when data exist.
MAX_YEARS_PER_REQUEST = 5

LOCATION_ALIASES: dict[str, str] = {
    # The metadata workbook uses "Klang"; ADF&G currently lists "Klag".
    "klang": "klag",
}

SPECIES_WORDS = {
    "chinook",
    "king",
    "sockeye",
    "red",
    "coho",
    "silver",
    "pink",
    "humpy",
    "chum",
    "dog",
    "steelhead",
    "dolly",
    "varden",
}


@dataclass(frozen=True)
class DownloadTask:
    location_name: str
    series_label: str
    start_year: int
    end_year: int
    latitude: float | None
    longitude: float | None


@dataclass(frozen=True)
class MenuOption:
    label: str
    value: int


class NoRecordsError(RuntimeError):
    """Raised when ADF&G returns no rows after batch and single-year retries."""


def normalize_text(value: object) -> str:
    """Normalize names for matching while retaining meaningful run words."""
    text = "" if value is None else str(value)
    text = unicodedata.normalize("NFKD", text)
    text = text.replace("&", " and ")
    text = text.replace("–", "-").replace("—", "-")
    text = text.lower().strip()
    text = re.sub(r"\blate[- ]run\b", "late run", text)
    text = re.sub(r"\bearly[- ]run\b", "early run", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def safe_filename(value: str) -> str:
    text = normalize_text(value).replace(" ", "_")
    return text or "unnamed"


def parse_coordinate(value: object, axis: str) -> float | None:
    """Convert coordinates such as '58.07 N' or '152.8 W' to decimals."""
    if value is None or pd.isna(value):
        return None
    text = str(value).strip().upper()
    match = re.search(r"[-+]?\d+(?:\.\d+)?", text)
    if not match:
        return None
    number = float(match.group(0))
    if "S" in text or "W" in text:
        number = -abs(number)
    elif "N" in text or "E" in text:
        number = abs(number)

    if axis == "latitude" and not (-90 <= number <= 90):
        raise ValueError(f"Invalid latitude {value!r}")
    if axis == "longitude" and not (-180 <= number <= 180):
        raise ValueError(f"Invalid longitude {value!r}")
    return number


def create_session(user_agent: str) -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=5,
        connect=5,
        read=5,
        status=5,
        backoff_factor=0.8,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET"}),
        respect_retry_after_header=True,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=4, pool_maxsize=4)
    session.mount("https://", adapter)
    session.headers.update(
        {
            "User-Agent": user_agent,
            "Accept": "text/html,application/xhtml+xml,application/json,text/plain,*/*",
        }
    )
    return session


def read_metadata(path: Path) -> tuple[pd.DataFrame, list[DownloadTask]]:
    metadata = pd.read_excel(path, sheet_name=0)
    metadata.columns = [str(c).strip() for c in metadata.columns]

    if "location_name" not in metadata.columns:
        raise ValueError("The workbook must contain a 'location_name' column.")

    start_columns = [c for c in metadata.columns if c.endswith("_start")]
    if not start_columns:
        raise ValueError("No '*_start' columns were found in the workbook.")

    tasks: list[DownloadTask] = []
    for row_number, row in metadata.iterrows():
        location = str(row.get("location_name", "")).strip()
        if not location or location.lower() == "nan":
            continue

        latitude = parse_coordinate(row.get("latitude"), "latitude")
        longitude = parse_coordinate(row.get("longitude"), "longitude")

        for start_column in start_columns:
            series_label = start_column[: -len("_start")].strip().replace("_", " ")
            end_column = f"{start_column[: -len('_start')]}_end"
            if end_column not in metadata.columns:
                raise ValueError(
                    f"Column {start_column!r} has no matching {end_column!r}."
                )

            start_value = row[start_column]
            end_value = row[end_column]
            if pd.isna(start_value) and pd.isna(end_value):
                continue
            if pd.isna(start_value) or pd.isna(end_value):
                raise ValueError(
                    f"Incomplete year range at Excel row {row_number + 2}: "
                    f"{location}, {series_label}."
                )

            start_year = int(start_value)
            end_year = int(end_value)
            if start_year > end_year:
                raise ValueError(
                    f"Start year exceeds end year at Excel row {row_number + 2}: "
                    f"{location}, {series_label}, {start_year}-{end_year}."
                )

            tasks.append(
                DownloadTask(
                    location_name=location,
                    series_label=series_label,
                    start_year=start_year,
                    end_year=end_year,
                    latitude=latitude,
                    longitude=longitude,
                )
            )

    return metadata, tasks


def numeric_options(select) -> list[MenuOption]:
    options: list[MenuOption] = []
    for option in select.find_all("option"):
        label = option.get_text(" ", strip=True)
        raw_value = str(option.get("value", "")).strip()
        if not label or not re.fullmatch(r"\d+", raw_value):
            continue
        options.append(MenuOption(label=label, value=int(raw_value)))
    return options


def choose_location_select(soup: BeautifulSoup, expected_locations: Iterable[str]):
    expected = {normalize_text(x) for x in expected_locations}
    best_select = None
    best_score = -1.0

    for select in soup.find_all("select"):
        options = numeric_options(select)
        if not options:
            continue
        normalized_labels = [normalize_text(o.label) for o in options]
        exact_overlap = sum(label in expected for label in normalized_labels)
        geographic_labels = sum(
            bool(
                re.search(
                    r"\b(river|creek|lake|lagoon|channel|slough|susitna|deshka|situk|klag)\b",
                    label,
                )
            )
            for label in normalized_labels
        )
        name_hint = normalize_text(
            f"{select.get('name', '')} {select.get('id', '')}"
        )
        hint_bonus = 10 if "location" in name_hint else 0
        score = exact_overlap * 20 + geographic_labels + hint_bonus + len(options) / 100
        if score > best_score:
            best_score = score
            best_select = select

    return best_select


def scrape_location_catalog(
    session: requests.Session, expected_locations: Iterable[str], timeout: float
) -> list[MenuOption]:
    response = session.get(HOME_URL, timeout=timeout)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    select = choose_location_select(soup, expected_locations)
    if select is None:
        raise RuntimeError("Could not identify the ADF&G location drop-down menu.")

    options = numeric_options(select)
    if not options:
        raise RuntimeError("The ADF&G location menu contained no numeric IDs.")
    return options


def resolve_location(task_name: str, catalog: list[MenuOption]) -> MenuOption:
    requested = normalize_text(task_name)
    requested = LOCATION_ALIASES.get(requested, requested)

    exact = {
        LOCATION_ALIASES.get(normalize_text(option.label), normalize_text(option.label)): option
        for option in catalog
    }
    if requested in exact:
        return exact[requested]

    scored: list[tuple[float, MenuOption]] = []
    for option in catalog:
        candidate = LOCATION_ALIASES.get(
            normalize_text(option.label), normalize_text(option.label)
        )
        score = SequenceMatcher(None, requested, candidate).ratio()
        scored.append((score, option))
    scored.sort(key=lambda item: item[0], reverse=True)

    best_score, best = scored[0]
    second_score = scored[1][0] if len(scored) > 1 else 0.0
    if best_score < 0.78 or (best_score - second_score < 0.03 and best_score < 0.94):
        suggestions = ", ".join(
            f"{item.label!r} ({score:.2f})" for score, item in scored[:3]
        )
        raise RuntimeError(
            f"Could not confidently match metadata location {task_name!r}. "
            f"Closest ADF&G options: {suggestions}"
        )
    return best


def base_species_name(series_label: str) -> str:
    label = normalize_text(series_label)
    if "chinook" in label or "king" in label:
        return "chinook"
    if "sockeye" in label or re.search(r"\bred\b", label):
        return "sockeye"
    if "coho" in label or "silver" in label:
        return "coho"
    if "pink" in label or "humpy" in label:
        return "pink"
    if "chum" in label or re.search(r"\bdog\b", label):
        return "chum"
    if "steelhead" in label:
        return "steelhead"
    if "dolly" in label or "varden" in label:
        return "dolly varden"
    raise ValueError(f"Unrecognized fish series label: {series_label!r}")


def choose_species_select(soup: BeautifulSoup):
    """Identify the species selector without confusing it with locations.

    ADF&G location IDs are mostly one- or two-digit values, while fish species
    IDs are in the 400-599 range.  Earlier scoring could select the location
    menu because location labels such as ``Kenai River (late-run sockeye)``
    contain fish names.  This version requires actual species-range IDs.
    """
    best_select = None
    best_score = -1.0
    for select in soup.find_all("select"):
        all_options = numeric_options(select)
        options = [option for option in all_options if 400 <= option.value <= 599]
        if not options:
            continue

        recognized = 0
        for option in options:
            try:
                base_species_name(option.label)
                recognized += 1
            except ValueError:
                pass
        if recognized == 0:
            continue

        name_hint = normalize_text(
            f"{select.get('name', '')} {select.get('id', '')}"
        )
        hint_bonus = 100 if "species" in name_hint else 0
        location_penalty = 100 if "location" in name_hint else 0
        score = hint_bonus - location_penalty + recognized * 10 + len(options)
        if score > best_score:
            best_score = score
            best_select = select
    return best_select

def scrape_species_catalog(
    session: requests.Session,
    location_id: int,
    task_labels: Iterable[str],
    timeout: float,
) -> list[MenuOption]:
    hint_ids: list[int] = []
    for label in task_labels:
        base = base_species_name(label)
        hint = BASE_SPECIES_HINT_IDS[base]
        if hint not in hint_ids:
            hint_ids.append(hint)
    for fallback in (420, 410, 430, 450, 440, 540, 531):
        if fallback not in hint_ids:
            hint_ids.append(fallback)

    last_error: Exception | None = None
    for species_hint in hint_ids:
        try:
            response = session.get(
                BASE_URL,
                params={
                    "ADFG": "main.displayResults",
                    "COUNTLOCATIONID": location_id,
                    "SpeciesID": species_hint,
                },
                timeout=timeout,
            )
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")
            select = choose_species_select(soup)
            if select is None:
                continue
            options = [
                option
                for option in numeric_options(select)
                if 400 <= option.value <= 599
                and any(
                    word in normalize_text(option.label).split()
                    for word in SPECIES_WORDS
                )
            ]
            if options:
                return options
        except Exception as exc:  # try another hint before failing
            last_error = exc

    if last_error:
        raise RuntimeError(
            f"Could not read species menu for ADF&G location ID {location_id}: {last_error}"
        ) from last_error
    raise RuntimeError(
        f"Could not identify a species menu for ADF&G location ID {location_id}."
    )


def deterministic_species_option(
    requested_label: str, location_name: str
) -> MenuOption:
    """Resolve a metadata series to ADF&G's stable species/run code.

    The Kenai late-run sockeye series is the important exception: ADF&G
    encodes the run in the *location* (location 40) and uses ordinary Sockeye
    species code 420 rather than the general late-run code 422.
    """
    requested = normalize_text(requested_label)
    location = normalize_text(location_name)

    if (
        requested == "sockeye late run"
        and "late run sockeye" in location
    ):
        return MenuOption(label="Sockeye", value=420)

    if requested not in SERIES_ID_MAP:
        # Accept minor wording variation by canonicalizing through the existing
        # base-species parser and explicit qualifier words.
        base = base_species_name(requested)
        qualifiers = [q for q in ("early", "late", "summer") if q in requested.split()]
        canonical = " ".join([base, *qualifiers, "run" if qualifiers and qualifiers[0] in {"early", "late"} else ""]).strip()
        canonical = re.sub(r"\s+", " ", canonical)
        if canonical not in SERIES_ID_MAP:
            raise ValueError(f"No deterministic ADF&G species code for {requested_label!r}")
        requested = canonical

    label, value = SERIES_ID_MAP[requested]
    if not 400 <= value <= 599:
        raise RuntimeError(
            f"Internal species mapping error: {requested_label!r} resolved to {value}."
        )
    return MenuOption(label=label, value=value)


def species_match_score(
    requested_label: str, option_label: str, location_name: str, all_options: list[MenuOption]
) -> float:
    requested = normalize_text(requested_label)
    option = normalize_text(option_label)
    location = normalize_text(location_name)

    requested_base = base_species_name(requested)
    try:
        option_base = base_species_name(option)
    except ValueError:
        return -1000.0
    if requested_base != option_base:
        return -1000.0

    score = 50.0
    score += 20.0 * SequenceMatcher(None, requested, option).ratio()

    qualifiers = ("early", "late", "summer")
    requested_qualifiers = {q for q in qualifiers if q in requested.split()}
    option_qualifiers = {q for q in qualifiers if q in option.split()}

    for qualifier in qualifiers:
        if qualifier in requested_qualifiers and qualifier in option_qualifiers:
            score += 35
        elif qualifier in requested_qualifiers and qualifier not in option_qualifiers:
            score -= 35
        elif qualifier not in requested_qualifiers and qualifier in option_qualifiers:
            score -= 20

    # Some ADF&G locations encode the run in the location name while the
    # species menu simply says Sockeye or Chinook. Allow that only when no
    # same-base menu option explicitly carries the requested qualifier.
    for qualifier in requested_qualifiers:
        explicit_exists = any(
            base_species_name(candidate.label) == requested_base
            and qualifier in normalize_text(candidate.label).split()
            for candidate in all_options
        )
        if qualifier in location.split() and not explicit_exists and not option_qualifiers:
            score += 45

    if requested == option:
        score += 100
    return score


def resolve_species(
    requested_label: str,
    location_name: str,
    catalog: list[MenuOption] | None = None,
) -> MenuOption:
    """Resolve species without relying on the current ADF&G menu.

    Current search menus may omit historical species, so standard codes are
    resolved deterministically.  When a trustworthy species catalog is
    supplied, an exact run-specific option may override the fallback, but only
    if its ID is in the species range.
    """
    deterministic = deterministic_species_option(requested_label, location_name)
    if not catalog:
        return deterministic

    requested = normalize_text(requested_label)
    exact_candidates = [
        option for option in catalog
        if 400 <= option.value <= 599
        and normalize_text(option.label) == requested
    ]
    if len(exact_candidates) == 1:
        return exact_candidates[0]

    # Never let a location ID masquerade as a species ID.
    if not 400 <= deterministic.value <= 599:
        raise RuntimeError(
            f"Resolved invalid species ID {deterministic.value} for {requested_label!r}."
        )
    return deterministic

def chunk_years(start_year: int, end_year: int, batch_size: int) -> list[list[int]]:
    """Return descending year batches compatible with the ADF&G UI/export."""
    safe_batch_size = min(max(1, batch_size), MAX_YEARS_PER_REQUEST)
    years = list(range(end_year, start_year - 1, -1))
    return [
        years[i : i + safe_batch_size]
        for i in range(0, len(years), safe_batch_size)
    ]


def parse_tsv_export(text: str) -> pd.DataFrame:
    stripped = text.lstrip("\ufeff\r\n ")
    if not stripped:
        return pd.DataFrame()

    # ADF&G may return an HTML error page while still using status 200.
    if stripped[:50].lower().startswith(("<!doctype html", "<html")):
        soup = BeautifulSoup(stripped, "html.parser")
        plain = soup.get_text(" ", strip=True)
        if "no records matching" in plain.lower():
            return pd.DataFrame()
        raise RuntimeError(f"ADF&G returned HTML instead of tabular data: {plain[:300]}")

    frame = pd.read_csv(
        StringIO(stripped),
        sep="\t",
        dtype=str,
        quoting=csv.QUOTE_MINIMAL,
        keep_default_na=False,
    )
    frame.columns = [str(c).strip() for c in frame.columns]
    if frame.empty:
        return frame

    expected = {"year", "count_date", "fish_count"}
    lower_map = {c.lower(): c for c in frame.columns}
    if not expected.issubset(lower_map):
        raise RuntimeError(
            "Unexpected ADF&G export columns: " + ", ".join(frame.columns)
        )

    frame = frame.rename(columns={original: lower for lower, original in lower_map.items()})
    return frame


def download_task(
    session: requests.Session,
    task: DownloadTask,
    location: MenuOption,
    species: MenuOption,
    timeout: float,
    batch_size: int,
    delay: float,
) -> tuple[pd.DataFrame, list[str]]:
    downloaded_frames: list[pd.DataFrame] = []
    source_urls: list[str] = []

    def request_years(years: list[int]) -> pd.DataFrame:
        params = {
            "ADFG": "export.excel",
            "countLocationID": location.value,
            "speciesID": species.value,
            # Match the site's own links: comma-separated, newest to oldest.
            "year": ",".join(str(year) for year in sorted(years, reverse=True)),
        }
        response = session.get(BASE_URL, params=params, timeout=timeout)
        response.raise_for_status()
        source_urls.append(response.url)
        frame = parse_tsv_export(response.text)
        if delay > 0:
            time.sleep(delay)
        return frame

    for year_batch in chunk_years(task.start_year, task.end_year, batch_size):
        batch = request_years(year_batch)

        # Some ADF&G series intermittently return an empty multi-year export.
        # Retry each requested year separately before concluding data are absent.
        if batch.empty and len(year_batch) > 1:
            logging.warning(
                "Empty %d-year export for %s | %s (%s); retrying one year at a time",
                len(year_batch),
                task.location_name,
                task.series_label,
                ",".join(map(str, year_batch)),
            )
            single_year_frames = []
            for year in year_batch:
                single = request_years([year])
                if not single.empty:
                    single_year_frames.append(single)
            if single_year_frames:
                batch = pd.concat(single_year_frames, ignore_index=True)

        if not batch.empty:
            downloaded_frames.append(batch)

    if not downloaded_frames:
        raise NoRecordsError(
            "ADF&G returned zero rows after five-year and single-year retries. "
            f"Resolved mapping: {location.label} [{location.value}] + "
            f"{species.label} [{species.value}], years "
            f"{task.start_year}-{task.end_year}."
        )

    result = pd.concat(downloaded_frames, ignore_index=True)
    result.columns = [str(c).strip().lower() for c in result.columns]

    # Reject a response for the wrong series instead of silently saving it.
    if "count_location_id" in result.columns:
        returned_location_ids = set(
            pd.to_numeric(result["count_location_id"], errors="coerce")
            .dropna()
            .astype(int)
        )
        if returned_location_ids and returned_location_ids != {location.value}:
            raise RuntimeError(
                f"ADF&G returned location IDs {sorted(returned_location_ids)}; "
                f"expected {location.value}."
            )
    if "species_id" in result.columns:
        returned_species_ids = set(
            pd.to_numeric(result["species_id"], errors="coerce")
            .dropna()
            .astype(int)
        )
        if returned_species_ids and returned_species_ids != {species.value}:
            raise RuntimeError(
                f"ADF&G returned species IDs {sorted(returned_species_ids)}; "
                f"expected {species.value}."
            )

    if "count_date" in result.columns:
        result["count_date"] = pd.to_datetime(
            result["count_date"], errors="coerce"
        ).dt.strftime("%Y-%m-%d")
    if "year" in result.columns:
        result["year"] = pd.to_numeric(result["year"], errors="coerce").astype("Int64")
    if "fish_count" in result.columns:
        result["fish_count"] = pd.to_numeric(
            result["fish_count"].replace({"": pd.NA, "-": pd.NA}), errors="coerce"
        ).astype("Int64")

    result.insert(0, "metadata_location_name", task.location_name)
    result.insert(1, "metadata_series_label", task.series_label)
    result.insert(2, "metadata_start_year", task.start_year)
    result.insert(3, "metadata_end_year", task.end_year)
    result.insert(4, "latitude", task.latitude)
    result.insert(5, "longitude", task.longitude)
    result.insert(6, "resolved_location_name", location.label)
    result.insert(7, "resolved_location_id", location.value)
    result.insert(8, "resolved_species_name", species.label)
    result.insert(9, "resolved_species_id", species.value)
    result["downloaded_at_utc"] = datetime.now(timezone.utc).isoformat()

    dedupe_columns = [
        column
        for column in (
            "resolved_location_id",
            "resolved_species_id",
            "count_date",
            "year",
        )
        if column in result.columns
    ]
    if dedupe_columns:
        result = result.drop_duplicates(subset=dedupe_columns, keep="last")

    sort_columns = [
        column
        for column in ("resolved_location_id", "resolved_species_id", "count_date")
        if column in result.columns
    ]
    if sort_columns:
        result = result.sort_values(sort_columns, kind="stable").reset_index(drop=True)
    return result, source_urls


def write_csv(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False, encoding="utf-8-sig")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download ADF&G fish counts using an Excel metadata table."
    )
    parser.add_argument(
        "--metadata",
        type=Path,
        default=Path("ADF&G Fish Counts.xlsx"),
        help="Path to the metadata workbook.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("adfg_fish_counts"),
        help="Directory for downloaded data and logs.",
    )
    parser.add_argument(
        "--location-filter",
        default="",
        help=(
            "Optional case-insensitive substring used to run only matching "
            "metadata locations, e.g. 'Kenai River'."
        ),
    )
    parser.add_argument(
        "--series-filter",
        default="",
        help=(
            "Optional case-insensitive substring used to run only matching "
            "series labels, e.g. 'sockeye late run'."
        ),
    )
    parser.add_argument(
        "--year-batch-size",
        type=int,
        default=MAX_YEARS_PER_REQUEST,
        help=(
            "Years included in each ADF&G export request. ADF&G supports at "
            "most 5; larger values are automatically reduced (default: 5)."
        ),
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.25,
        help="Delay in seconds between export requests (default: 0.25).",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=60.0,
        help="HTTP timeout in seconds (default: 60).",
    )
    parser.add_argument(
        "--continue-on-error",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Continue downloading after an individual series fails.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Resolve workbook tasks but do not contact ADF&G or download data.",
    )
    parser.add_argument(
        "--user-agent",
        default="ADF&G-fish-count-research-downloader/3.0 (academic use; resolver v3)",
        help="User-Agent sent to ADF&G.",
    )
    parser.add_argument(
        "--log-level",
        choices=("DEBUG", "INFO", "WARNING", "ERROR"),
        default="INFO",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s | %(levelname)s | %(message)s",
    )

    if args.year_batch_size < 1:
        raise ValueError("--year-batch-size must be at least 1.")
    if args.year_batch_size > MAX_YEARS_PER_REQUEST:
        logging.warning(
            "ADF&G supports at most %d years per export; reducing --year-batch-size from %d to %d",
            MAX_YEARS_PER_REQUEST,
            args.year_batch_size,
            MAX_YEARS_PER_REQUEST,
        )
        args.year_batch_size = MAX_YEARS_PER_REQUEST
    if args.delay < 0:
        raise ValueError("--delay cannot be negative.")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    series_dir = args.output_dir / "series"
    series_dir.mkdir(parents=True, exist_ok=True)

    _, tasks = read_metadata(args.metadata)
    total_tasks = len(tasks)
    if args.location_filter:
        wanted = normalize_text(args.location_filter)
        tasks = [
            task for task in tasks
            if wanted in normalize_text(task.location_name)
        ]
    if args.series_filter:
        wanted = normalize_text(args.series_filter)
        tasks = [
            task for task in tasks
            if wanted in normalize_text(task.series_label)
        ]
    if not tasks:
        raise ValueError(
            "No metadata tasks matched the supplied location/series filters."
        )
    logging.info(
        "Selected %d of %d download tasks from %s",
        len(tasks),
        total_tasks,
        args.metadata,
    )

    task_table = pd.DataFrame(
        [
            {
                "location_name": task.location_name,
                "series_label": task.series_label,
                "start_year": task.start_year,
                "end_year": task.end_year,
                "latitude": task.latitude,
                "longitude": task.longitude,
            }
            for task in tasks
        ]
    )
    write_csv(task_table, args.output_dir / "metadata_tasks.csv")

    if args.dry_run:
        logging.info("Dry run complete; no web requests were made.")
        return 0

    session = create_session(args.user_agent)
    unique_locations = list(dict.fromkeys(task.location_name for task in tasks))
    location_catalog = scrape_location_catalog(session, unique_locations, args.timeout)
    logging.info("Found %d ADF&G locations in the site menu", len(location_catalog))

    resolved_locations: dict[str, MenuOption] = {}
    for name in unique_locations:
        resolved_locations[name] = resolve_location(name, location_catalog)
        logging.debug(
            "Location: %s -> %s [%s]",
            name,
            resolved_locations[name].label,
            resolved_locations[name].value,
        )

    # Standard species IDs are resolved from ADF&G's stable codes.  For the
    # handful of explicitly separated early/late/summer runs, inspect the
    # location-specific species menu as an optional confirmation.  Failure to
    # read that menu is non-fatal because deterministic run codes remain.
    species_catalogs: dict[str, list[MenuOption]] = {
        location_name: [] for location_name in unique_locations
    }
    run_words = {"early", "late", "summer"}
    tasks_by_location: dict[str, list[DownloadTask]] = {}
    for task in tasks:
        tasks_by_location.setdefault(task.location_name, []).append(task)

    for location_name, location_tasks in tasks_by_location.items():
        needs_run_catalog = any(
            run_words.intersection(normalize_text(task.series_label).split())
            for task in location_tasks
        )
        if not needs_run_catalog:
            continue
        try:
            resolved_location = resolved_locations[location_name]
            species_catalogs[location_name] = scrape_species_catalog(
                session,
                resolved_location.value,
                [task.series_label for task in location_tasks],
                args.timeout,
            )
            logging.debug(
                "Run-specific species at %s: %s",
                location_name,
                ", ".join(
                    f"{o.label} [{o.value}]"
                    for o in species_catalogs[location_name]
                ),
            )
            if args.delay > 0:
                time.sleep(args.delay)
        except Exception as exc:
            logging.warning(
                "Could not confirm run-specific species menu at %s; "
                "using stable ADF&G codes instead: %s",
                location_name,
                exc,
            )

    all_frames: list[pd.DataFrame] = []
    manifest_rows: list[dict[str, object]] = []
    error_rows: list[dict[str, object]] = []

    for index, task in enumerate(tasks, start=1):
        location = resolved_locations[task.location_name]
        species: MenuOption | None = None
        try:
            species = resolve_species(
                task.series_label,
                task.location_name,
                species_catalogs[task.location_name],
            )
            logging.info(
                "[%d/%d] %s [%d] | %s -> %s [%d] | %d-%d",
                index,
                len(tasks),
                task.location_name,
                location.value,
                task.series_label,
                species.label,
                species.value,
                task.start_year,
                task.end_year,
            )
            frame, source_urls = download_task(
                session,
                task,
                location,
                species,
                args.timeout,
                args.year_batch_size,
                args.delay,
            )

            filename = (
                f"{safe_filename(task.location_name)}__"
                f"{safe_filename(task.series_label)}__"
                f"{task.start_year}_{task.end_year}.csv"
            )
            output_path = series_dir / filename
            write_csv(frame, output_path)
            all_frames.append(frame)

            manifest_rows.append(
                {
                    "metadata_location_name": task.location_name,
                    "metadata_series_label": task.series_label,
                    "start_year": task.start_year,
                    "end_year": task.end_year,
                    "resolved_location_name": location.label,
                    "resolved_location_id": location.value,
                    "resolved_species_name": species.label,
                    "resolved_species_id": species.value,
                    "records_downloaded": len(frame),
                    "output_file": str(output_path),
                    "source_urls": " | ".join(source_urls),
                    "status": "success",
                }
            )
        except Exception as exc:
            logging.exception(
                "Failed: %s | %s", task.location_name, task.series_label
            )
            filename = (
                f"{safe_filename(task.location_name)}__"
                f"{safe_filename(task.series_label)}__"
                f"{task.start_year}_{task.end_year}.csv"
            )
            stale_output = series_dir / filename
            # Remove blank/stale files from earlier runs so their presence is
            # never mistaken for a successful download.
            if stale_output.exists() and stale_output.stat().st_size <= 4:
                stale_output.unlink()

            status = "no_records" if isinstance(exc, NoRecordsError) else "error"
            manifest_rows.append(
                {
                    "metadata_location_name": task.location_name,
                    "metadata_series_label": task.series_label,
                    "start_year": task.start_year,
                    "end_year": task.end_year,
                    "resolved_location_name": location.label,
                    "resolved_location_id": location.value,
                    "resolved_species_name": species.label if species is not None else "",
                    "resolved_species_id": species.value if species is not None else "",
                    "records_downloaded": 0,
                    "output_file": "",
                    "source_urls": "",
                    "status": status,
                }
            )
            error_rows.append(
                {
                    "metadata_location_name": task.location_name,
                    "metadata_series_label": task.series_label,
                    "start_year": task.start_year,
                    "end_year": task.end_year,
                    "error_type": type(exc).__name__,
                    "error_message": str(exc),
                }
            )
            if not args.continue_on_error:
                break

    combined = pd.concat(all_frames, ignore_index=True) if all_frames else pd.DataFrame()
    if not combined.empty:
        dedupe = [
            c
            for c in (
                "resolved_location_id",
                "resolved_species_id",
                "count_date",
                "year",
            )
            if c in combined.columns
        ]
        if dedupe:
            combined = combined.drop_duplicates(subset=dedupe, keep="last")
        sort_cols = [
            c
            for c in (
                "resolved_location_name",
                "resolved_species_name",
                "count_date",
            )
            if c in combined.columns
        ]
        if sort_cols:
            combined = combined.sort_values(sort_cols, kind="stable")

    write_csv(combined, args.output_dir / "adfg_fish_counts_all.csv")
    write_csv(pd.DataFrame(manifest_rows), args.output_dir / "download_manifest.csv")
    write_csv(pd.DataFrame(error_rows), args.output_dir / "download_errors.csv")

    logging.info(
        "Finished: %d records, %d successful/no-record series, %d errors",
        len(combined),
        len(manifest_rows),
        len(error_rows),
    )
    logging.info("Combined output: %s", args.output_dir / "adfg_fish_counts_all.csv")
    return 1 if error_rows else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrupted by user.", file=sys.stderr)
        raise SystemExit(130)
