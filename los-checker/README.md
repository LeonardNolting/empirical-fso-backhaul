# Line-of-sight identification application

This project serves the purpose of identifying the lines-of-sight (LoS) between nodes (mobile antennas) given an
obstruction model in the form of a digital surface map (DSM).
 
## Functionality

The application reads a `.csv` file containing locations of nodes from `./data`. The file is selected via the `--region`
argument. The default region is `paris_small`, which is 10x10 km and centered on the Eiffel Tower.

From the node locations, the geographical region is identified, and the application offers to automatically download the
DSM tiles for this region to `./tiles`.

As soon as the tiles have been downloaded, the LoS analysis begins. For this, every pair of nodes is considered. It is
possible to set an upper bound on the distance between two nodes via the `--max-link-length` argument, given in meters.

When the analysis is complete, the results are written to `./results`. In the subfolder with the region name,
`clear.csv` contains the node pairs with LoS, and `blocked.csv` contains the node pairs without LoS.

## Prerequisites

For compiling the code, an up-to-date installation of the Rust programming language is required. Consult
https://rust-lang.org/tools/install/ for the installation process.

## Example usage

Run in crate root (this folder):
```shell
cargo run --release
```

This will first compile the code and then execute the resulting binary. Command-line arguments can be passed as follows:
```shell
cargo run --release -- --region [name] --max-link-length [value]
```

Note the extra `--` separating the compiler arguments from the arguments passed to the resulting binary.

## Data formats

The input files in `./data` must be headerless, comma-separated CSV files with the following fields:
- date of the entry/database, written as single integer (unused)
- unique integer identifier of the entry within the database
- x and y coordinates in the Lambert-93 coordinate system
- z coordinate given in meters above sea level
- an capitalized boolean (`True` or `False`) indicating whether the node is "active"

During LoS analysis, node pairs where neither node is marked active are skipped.

The result files in `./results` are headerless, comma-separated CSV files with the following fields:
- integer identifiers of the two nodes
- distance between the two nodes in meters

## Algorithm

The LoS analysis algorithm is based on the 1987 paper 'A Fast Voxel Traversal Algorithm for Ray Tracing' by John
Amanatides and Andrew Woo.
