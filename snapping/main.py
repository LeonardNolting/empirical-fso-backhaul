import argparse
import csv
import os
import sys

from pyproj import Transformer

from snap import snap
from util import get_databases, get_bounds


def load_points_from_csv(filepath):
    points = []
    with open(filepath, 'r', newline='') as f:
        reader = csv.reader(f)
        for row in reader:
            if not row or len(row) < 2: continue
            try:
                x = float(row[0])
                y = float(row[1])
                points.append((x, y))
            except ValueError:
                pass  # Skip header or invalid rows
    return points


def save_points_to_csv(points, filepath):
    with open(filepath, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["x", "y"])
        for p in points:
            writer.writerow(["", ""] if p is None else [p[0], p[1]])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Snap points to BDTOPO buildings.")
    parser.add_argument("--bdtopo-dir", type=str, default="./bdtopo",
                        help="Path to the directory containing BDTOPO databases.")
    parser.add_argument("--crs", type=str, default="EPSG:4326", help="Coordinate Reference System of input points.")
    parser.add_argument("--input", type=str, default="./points.csv",
                        help="Path to input CSV file containing points (X,Y).")
    parser.add_argument("--output", type=str, default="./snapped.csv",
                        help="Path to output CSV file for snapped points.")
    parser.add_argument("--test", action="store_true", help="Run a simple test with a dummy point in Paris.")

    args = parser.parse_args()

    if args.test:
        input_points = [(2.578521, 49.206509)]
        print(f"Testing with points: {input_points} in {args.crs}")
    else:
        if not os.path.exists(args.input):
            print(f"Error: Input file '{args.input}' not found. Run with --test, or provide a valid CSV file.")
            sys.exit(1)

        input_points = load_points_from_csv(args.input)
        if len(input_points) == 0:
            print(f"Error: No valid points found in '{args.input}'. Expected x, y columns.")
            sys.exit(1)

        print(f"Loaded {len(input_points)} points from '{args.input}' (CRS: {args.crs})")

    # Use Lambert93 CRS internally
    to_l93 = Transformer.from_crs(args.crs, "EPSG:2154", always_xy=True)
    points = [to_l93.transform(x, y) for x, y in input_points]

    _, missing_dbs = get_databases(get_bounds(points, max_dist=20.0), bdtopo_dir=args.bdtopo_dir)

    if len(missing_dbs) > 0:
        print(f"Error: Missing {len(missing_dbs)} required BDTOPO databases in {os.path.abspath(args.bdtopo_dir)}:")
        for missing in missing_dbs:
            print(f"  - {missing}")
        print("\nPlease download them before proceeding.")
        sys.exit(1)

    snapped_points = snap(points, bdtopo_dir=args.bdtopo_dir)

    from_l93 = Transformer.from_crs("EPSG:2154", args.crs, always_xy=True)
    output_points = [None if p is None else from_l93.transform(*p) for p in snapped_points]

    if args.test:
        print(f"Result: {output_points}")
    else:
        save_points_to_csv(output_points, args.output)
        print(f"Saved {len(output_points)} snapped points to '{args.output}'")

    if len(input_points) <= 10:
        from util import load_buildings
        from view import visualize_snap

        bounds = get_bounds(points, max_dist=20.0)
        valid_paths, _ = get_databases(bounds, bdtopo_dir=args.bdtopo_dir)
        buildings = load_buildings(valid_paths, bounds)
        for i, (original, snapped) in enumerate(zip(points, snapped_points)):
            visualize_snap(buildings, original, snapped)
