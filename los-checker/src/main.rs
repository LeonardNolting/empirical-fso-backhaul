use crate::cli::Args;
use crate::curvature::curvature_drop;
use crate::nodes::{read_nodes, Node};
use crate::ray::Ray3;
use crate::tile_rays::par_tile_rays_for_tile;
use crate::tiles::download::{check_tile_availability, delete_partial_tiles, download_tiles};
use crate::tiles::{load_tile, TileRegion};
use crate::transform::TileSpacePositionAcrossTiles;
use clap::Parser;
use indicatif::*;
use rayon::iter::ParallelIterator;
use rayon::prelude::IntoParallelRefIterator;
use std::fs::File;
use std::io;
use std::io::{BufWriter, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;
use tokio::fs::create_dir_all;

pub mod cli;
pub mod curvature;
pub mod intersection;
pub mod map;
pub mod nodes;
pub mod ray;
pub mod tile;
pub mod tile_rays;
pub mod tiles;
pub mod transform;
pub mod traversal;

pub fn node_ray(first_node: Node, second_node: Node, max_length_km: f64) -> Option<Ray3<f64>> {
    if !first_node.active && !second_node.active {
        return None;
    }

    let first_position: TileSpacePositionAcrossTiles = first_node.position().into();
    let second_position: TileSpacePositionAcrossTiles = second_node.position().into();

    let distance_squared = (first_position.x - second_position.x)
        * (first_position.x - second_position.x)
        + (first_position.y - second_position.y) * (first_position.y - second_position.y);

    if distance_squared > max_length_km * max_length_km {
        return None;
    }

    Some(Ray3 {
        start_x: first_position.x,
        start_y: first_position.y,
        start_z: first_node.z,
        diff_x: second_position.x - first_position.x,
        diff_y: second_position.y - first_position.y,
        diff_z: second_node.z - first_node.z,
    })
}

pub fn node_pairs(nodes: &[Node]) -> impl Iterator<Item = (Node, Node)> {
    nodes
        .iter()
        .enumerate()
        .flat_map(move |(first_node_index, &first_node)| {
            nodes[..first_node_index]
                .iter()
                .map(move |&second_node| (first_node, second_node))
        })
}

pub fn node_rays(nodes: &[Node], max_length_km: f64) -> impl Iterator<Item = Ray3<f64>> {
    node_pairs(nodes).filter_map(move |(first_node, second_node)| {
        node_ray(first_node, second_node, max_length_km)
    })
}

#[tokio::main]
#[allow(unreachable_code)]
async fn main() {
    let Args {
        max_link_length,
        region: region_name,
    } = Args::parse();
    let max_link_length_km = max_link_length / 1000.0;

    println!("Starting region {}", region_name);
    let tiles_directory = format!("./tiles/{region_name}");
    let nodes_file = format!("./data/{region_name}.csv");

    let nodes = read_nodes(&nodes_file);

    println!("Loaded nodes");

    // empty region at first
    let mut region = TileRegion {
        x_min: i32::MAX,
        x_max: i32::MIN,
        y_min: i32::MAX,
        y_max: i32::MIN,
    };

    // expand the region to fit all nodes
    for node in &nodes {
        let position = node.position();
        let position: TileSpacePositionAcrossTiles = position.into();
        region.expand_to_include(position);
    }

    std::fs::create_dir_all(&tiles_directory).unwrap();

    let tile_availability = check_tile_availability(&tiles_directory, region);

    if !tile_availability.partial_tiles.is_empty() {
        let partial_tiles = tile_availability.partial_tiles.len();
        let delete = dialoguer::Confirm::new()
            .with_prompt(format!("Found {partial_tiles} partially downloaded tiles in {tiles_directory}, delete them?"))
            .interact()
            .unwrap();
        if delete {
            delete_partial_tiles(&tiles_directory, tile_availability.partial_tiles).await;
            println!("Deleted partially downloaded tiles")
        }
    }

    if tile_availability.missing_tiles.is_empty() {
        println!("All required tiles already in {tiles_directory}");
    } else {
        let missing_tiles = tile_availability.missing_tiles.len();
        let estimated_bytes = (missing_tiles as u64) * 16_000_000;
        let size = humansize::format_size(estimated_bytes, humansize::DECIMAL);
        let download = dialoguer::Confirm::new()
            .with_prompt(format!(
                "Missing {missing_tiles} tiles, download estimated {size}?"
            ))
            .interact()
            .unwrap();
        if download {
            println!("Downloading tiles to {tiles_directory}");
            download_tiles(&tiles_directory, tile_availability.missing_tiles).await;
            println!("Finished downloading tiles");
        } else {
            return;
        }
    }

    let start = Instant::now();
    let rays = node_rays(&nodes, max_link_length_km).collect::<Vec<_>>();
    println!(
        "collected {:?} rays in {:?} for {:?}",
        rays.len(),
        start.elapsed(),
        region_name
    );

    let is_free = rays
        .iter()
        .map(|_| AtomicBool::new(true))
        .collect::<Vec<_>>();
    let start = Instant::now();

    let (total_tile_ray_count, checked_tile_ray_count) = region
        .par_coordinates()
        .progress_count(region.area() as u64)
        .map(|tile_coordinates| {
            (
                tile_coordinates,
                load_tile(&tiles_directory, tile_coordinates),
            )
        })
        .map(|(tile_coordinates, tile)| {
            let tile_rays =
                par_tile_rays_for_tile(tile_coordinates, rays.par_iter().map(|ray| ray.as_ray_2()));

            tile_rays
                .map(|(tile_ray, ray_index)| {
                    if is_free[ray_index].load(Ordering::Relaxed) == false {
                        // ray already intersects in other tile
                        // `1` is for counting the tile ray
                        // `0` indicates that this tile ray is not being checked
                        return (1, 0);
                    }

                    let whole_ray = &rays[ray_index];
                    // whole_ray coordinates are in tile space, where 1.0 is 1000 m
                    let whole_ray_length_in_meters = (whole_ray.diff_x * whole_ray.diff_x
                        + whole_ray.diff_y * whole_ray.diff_y)
                        .sqrt()
                        * 1_000.0;
                    let mut start_z = whole_ray.start_z + whole_ray.diff_z * tile_ray.start_t;
                    let mut end_z = whole_ray.start_z + whole_ray.diff_z * tile_ray.end_t;
                    start_z -= curvature_drop(tile_ray.start_t, whole_ray_length_in_meters);
                    end_z -= curvature_drop(tile_ray.end_t, whole_ray_length_in_meters);
                    let ray = tile_ray.ray.with_z(start_z, end_z - start_z);
                    let free = tile.is_line_free(ray);
                    if !free {
                        is_free[ray_index].store(false, Ordering::Relaxed);
                    }

                    // `1` is for counting the tile ray
                    // `1` indicates that this tile ray has been checked
                    (1, 1)
                })
                .reduce(|| (0, 0), |a, b| (a.0 + b.0, a.1 + b.1))
        })
        .reduce(|| (0, 0), |a, b| (a.0 + b.0, a.1 + b.1));

    let duration = start.elapsed();
    let free_count = is_free
        .iter()
        .filter(|free| free.load(Ordering::Relaxed))
        .count();
    let total_count = is_free.len();
    let whole_ray_count = rays.len();
    println!(
        "{:.2}% free ({free_count} of {total_count})",
        free_count as f64 / total_count as f64 * 100.0
    );
    println!(
        "{:.2} tile rays checked per ray",
        checked_tile_ray_count as f64 / whole_ray_count as f64
    );
    println!(
        "{:.2} million tile rays checked per second",
        checked_tile_ray_count as f64 / duration.as_secs_f64() / 1e6
    );
    println!(
        "{:.2}% of tile rays checked ({checked_tile_ray_count} of {total_tile_ray_count})",
        checked_tile_ray_count as f64 / total_tile_ray_count as f64 * 100.0
    );
    println!("took {:?}", duration);

    // export results
    type RayData = (u32, u32, f64);

    let ray_data = node_pairs(&nodes).filter_map(|(first_node, second_node)| {
        let ray = node_ray(first_node, second_node, max_link_length_km)?;
        let ray = ray.as_ray_2();
        let length_km = (ray.diff_x * ray.diff_x + ray.diff_y * ray.diff_y).sqrt();
        let length = length_km * 1000.0;
        Some((first_node.database_line, second_node.database_line, length))
    });

    let mut clear = Vec::new();
    let mut blocked = Vec::new();
    for (index, data) in ray_data.enumerate() {
        let is_free = is_free[index].load(Ordering::Relaxed);
        if is_free {
            clear.push(data);
        } else {
            blocked.push(data);
        }
    }

    fn write_ray_data(mut out: impl Write, data: impl Iterator<Item = RayData>) -> io::Result<()> {
        for (first_node, second_node, length) in data {
            writeln!(out, "{first_node},{second_node},{length}")?;
        }
        Ok(())
    }

    let export_directory = format!("./results/{region_name}");

    create_dir_all(&export_directory).await.unwrap();

    let clear_file = File::create(format!("{export_directory}/clear.csv")).unwrap();
    let blocked_file = File::create(format!("{export_directory}/blocked.csv")).unwrap();

    write_ray_data(BufWriter::new(clear_file), clear.into_iter()).unwrap();
    write_ray_data(BufWriter::new(blocked_file), blocked.into_iter()).unwrap();

    println!("Wrote results to {export_directory}");
}
