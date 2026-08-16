import geopandas as gpd
import matplotlib.pyplot as plt
from matplotlib.patches import Patch
from shapely.geometry import Point
from typing import Tuple, Optional


def visualize_snap(
        buildings: gpd.GeoDataFrame,
        original_point: Tuple[float, float],
        snapped_point: Optional[Tuple[float, float]],
        view_radius: float = 50.0,
        max_snap_dist: float = 20.0
):
    fig, ax = plt.subplots(figsize=(10, 10))

    cx, cy = original_point
    center = Point(original_point)

    v_xmin, v_ymin = cx - view_radius, cy - view_radius
    v_xmax, v_ymax = cx + view_radius, cy + view_radius

    # Filter buildings for the view
    # (we query a slightly larger area than the view to ensure buildings on the edge are included)
    b_rad = view_radius * 3
    b_xmin, b_ymin = cx - b_rad, cy - b_rad
    b_xmax, b_ymax = cx + b_rad, cy + b_rad

    local_buildings = buildings.cx[b_xmin:b_xmax, b_ymin:b_ymax]

    if not local_buildings.empty:
        local_buildings.plot(ax=ax, color='lightgray', edgecolor='black', alpha=0.5)

    legend_elements = [
        Patch(facecolor='lightgray', edgecolor='black', alpha=0.5, label='Buildings'),
        plt.Line2D([0], [0], marker='x', color='red', linestyle='None', markersize=10, label='Original Point')
    ]

    if snapped_point:
        snapped_geom = Point(snapped_point)
        distance_moved = center.distance(snapped_geom)

        circle = plt.Circle((center.x, center.y), distance_moved,
                            color='blue', fill=False, linestyle='--', linewidth=1.5, label='Snap Distance')
        ax.add_patch(circle)
        legend_elements.append(plt.Line2D([0], [0], color='blue', linestyle='--', label='Snap Distance'))

        ax.plot([center.x, snapped_geom.x], [center.y, snapped_geom.y],
                color='blue', linestyle='-', linewidth=2)

        ax.scatter([snapped_geom.x], [snapped_geom.y], c='green', s=100, zorder=5)
        legend_elements.append(plt.Line2D([0], [0], marker='o', color='green', linestyle='None', label='Snapped Point'))

        print(f"Distance moved: {distance_moved:.4f} meters")
    else:
        # Draw max search radius if no building found
        circle = plt.Circle((center.x, center.y), max_snap_dist,
                            color='red', fill=False, linestyle=':', linewidth=2, label=f'Max Search ({max_snap_dist}m)')
        ax.add_patch(circle)
        legend_elements.append(plt.Line2D([0], [0], color='red', linestyle=':', label=f'Max Search ({max_snap_dist}m)'))

        print(f"Point was not snapped (no building within {max_snap_dist}m limit).")

    ax.scatter([center.x], [center.y], c='red', marker='x', s=100, zorder=5)

    ax.set_xlim(v_xmin, v_xmax)
    ax.set_ylim(v_ymin, v_ymax)
    ax.set_aspect('equal')

    ax.set_xlabel("Lambert-93 X (m)")
    ax.set_ylabel("Lambert-93 Y (m)")
    ax.grid(True, linestyle=':', alpha=0.6)

    ax.legend(handles=legend_elements, loc='upper right')

    plt.show()
