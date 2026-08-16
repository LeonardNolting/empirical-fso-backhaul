import os
from pathlib import Path
from typing import Tuple, List, Optional

import geopandas as gpd
import pandas as pd
from shapely.geometry import box

DEPARTEMENTS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "departements.geojson")


def get_bounds(points: List[Tuple[float, float]], max_dist: float) -> Tuple[float, float, float, float]:
    x, y = zip(*points)
    return (min(x) - max_dist, min(y) - max_dist, max(x) + max_dist, max(y) + max_dist)


def get_bdtopo_targets(rectangle, departements_gdf):
    target_codes = []
    intersected_deps = departements_gdf[departements_gdf.intersects(rectangle)]

    for _, dep in intersected_deps.iterrows():
        formatted_code = f"D{str(dep['code']).zfill(3)}"
        target_codes.append(formatted_code)

    return target_codes


def bdtopo_database_filename(target_code: str, version: str, date: str):
    return f"BDTOPO_{version}_TOUSTHEMES_GPKG_LAMB93_{target_code}_{date}"


def resolve_bdtopo_database_path(bdtopo_dir: str, target_code: str, version: str, date: str) -> Optional[Path]:
    filename = bdtopo_database_filename(target_code, version, date)
    base_path = Path(bdtopo_dir) / filename / "BDTOPO"

    if not base_path.exists():
        return None

    try:
        entries = [entry for entry in os.listdir(base_path) if entry.startswith("1")]
        if len(entries) == 0: return None
        path = base_path / entries[0]

        entries2 = os.listdir(path)
        if len(entries2) == 0: return None
        path = path / entries2[0]

        entries3 = os.listdir(path)
        if len(entries3) == 0: return None
        return path / entries3[0]
    except Exception:
        return None


def get_databases(bounds: Tuple[float, float, float, float], bdtopo_dir: str) -> Tuple[List[str], List[str]]:
    """Returns (valid_filenames, missing_filenames) within the given bounds."""
    if not os.path.exists(DEPARTEMENTS_FILE):
        raise FileNotFoundError(f"Missing départements file: {DEPARTEMENTS_FILE}")

    targets = get_bdtopo_targets(box(*bounds), gpd.read_file(DEPARTEMENTS_FILE).to_crs("EPSG:2154"))
    valid, missing = [], []

    for t in targets:
        path = resolve_bdtopo_database_path(bdtopo_dir, t, "3-5", "2025-12-15")
        if path and path.exists():
            valid.append(str(path))
        else:
            missing.append(bdtopo_database_filename(t, "3-5", "2025-12-15"))

    return valid, missing


def load_buildings(building_database_paths: List[str], bounds_tuple: Tuple[float, float, float, float]):
    print(f"Loading buildings from {len(building_database_paths)} sources...")
    gdfs = []
    for path in building_database_paths:
        try:
            gdf_chunk = gpd.read_file(
                path,
                layer="batiment",
                engine="pyogrio",
                bbox=bounds_tuple,
                columns=["geometry"]
            )
            if not gdf_chunk.empty:
                print(f"\tLoaded {len(gdf_chunk)} buildings from {path.split('/')[-1]}")
                gdfs.append(gdf_chunk)
            else:
                print(f"\tNo buildings found in bounds for {path.split('/')[-1]}")
        except Exception as e:
            print(f"\tCould not load {path}: {e}")

    if len(gdfs) == 0:
        raise ValueError("No buildings found in any of the provided files for this region.")

    combined_gdf = pd.concat(gdfs, ignore_index=True)
    _ = combined_gdf.sindex
    print(f"Loaded {len(combined_gdf)} buildings.")
    return combined_gdf
