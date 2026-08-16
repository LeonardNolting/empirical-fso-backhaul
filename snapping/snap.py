from typing import Tuple, List, Optional

import geopandas as gpd
from shapely.geometry import Point
from shapely.ops import nearest_points

from util import (
    get_bounds,
    get_databases,
    load_buildings
)


def snap(points: List[Tuple[float, float]], bdtopo_dir: str = "./bdtopo", max_search_dist: float = 20.0) -> List[
    Optional[Tuple[float, float]]]:
    """
    Snaps 2D points (in Lambert93 EPSG:2154) to the closest building footprint.
    Returns a list of snapped points (Lambert93) or None if no building was within max_search_dist.
    """
    if len(points) == 0: return []
    print(f"Snapping {len(points)} points...")

    bounds = get_bounds(points, max_search_dist)
    valid_paths, missing = get_databases(bounds, bdtopo_dir)

    if len(missing) > 0:
        raise FileNotFoundError(f"Missing required BDTOPO databases: {', '.join(missing)}")

    buildings = load_buildings(valid_paths, bounds)

    points_geom = gpd.GeoSeries(
        [Point(x, y) for x, y in points],
        crs=buildings.crs
    )

    closest_indices, distances = buildings.sindex.nearest(
        points_geom,
        return_distance=True,
        max_distance=max_search_dist
    )

    snapped_points: List[Optional[Tuple[float, float]]] = [None] * len(points)

    for i in range(len(closest_indices[0])):
        point_index = closest_indices[0][i]
        build_index = closest_indices[1][i]

        user_pt = points_geom.iloc[point_index]
        building_poly = buildings.geometry.iloc[build_index]

        _, nearest_point_on_building = nearest_points(user_pt, building_poly)

        snapped_points[point_index] = (nearest_point_on_building.x, nearest_point_on_building.y)

    return snapped_points
