use std::io;
use std::path::Path;
use std::sync::Arc;
use reqwest::{Client, Response};
use tokio::sync::Semaphore;
use tokio::time::{interval, Duration};
use tokio::io::AsyncWriteExt;
use indicatif::{ProgressBar, ProgressStyle};
use tokio::fs::File;
use crate::tiles::{tile_filename, TileCoordinates, TileRegion};

struct TileBounds {
    x_min: f32,
    x_max: f32,
    y_min: f32,
    y_max: f32,
}

impl TileBounds {
    fn new(coordinates: TileCoordinates) -> Self {
        Self {
            x_min: (coordinates.x * 1000) as f32 - 0.25,
            x_max: ((coordinates.x + 1) * 1000) as f32 - 0.25,
            y_min: ((coordinates.y - 1) * 1000) as f32 + 0.25,
            y_max: (coordinates.y * 1000) as f32 + 0.25,
        }
    }
}

fn tile_url_and_filename(coordinates: TileCoordinates) -> (String, String) {
    let bounds = TileBounds::new(coordinates);
    let filename = tile_filename(coordinates);
    let url = format!(
        "https://data.geopf.fr/wms-r\
        ?SERVICE=WMS&VERSION=1.3.0&EXCEPTIONS=text/xml&REQUEST=GetMap\
        &LAYERS=IGNF_LIDAR-HD_MNS_ELEVATION.ELEVATIONGRIDCOVERAGE.LAMB93\
        &FORMAT=image/geotiff&STYLES=&CRS=EPSG:2154\
        &BBOX={},{},{},{}\
        &WIDTH=2000&HEIGHT=2000\
        &FILENAME={filename}",
        bounds.x_min, bounds.y_min, bounds.x_max, bounds.y_max,
    );
    (url, filename)
}

async fn write_response_to_file(mut response: Response, mut file: File) -> io::Result<()> {
    // Stream the response body directly to the file without loading it entirely into RAM
    while let Some(chunk) = response.chunk().await.expect("failed to read chunk") {
        file.write_all(&chunk).await?;
    }

    file.flush().await?;
    Ok(())
}

fn temp_filename(filename: &str) -> String {
    format!("temp_{filename}")
}

pub async fn download_tile_async(client: &Client, directory: impl AsRef<Path>, coordinates: TileCoordinates) {
    let (url, filename) = tile_url_and_filename(coordinates);
    let temp_filename = temp_filename(&filename);

    let path = directory.as_ref().join(filename);
    let temp_path = directory.as_ref().join(temp_filename);

    // Use Tokio's async filesystem operations
    let file_result = tokio::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp_path)
        .await;

    let file = match file_result {
        Ok(file) => file,
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => return,
        Err(error) => panic!("failed to create file: {error}"),
    };

    // Execute the async network request
    let response = client.get(&url).send().await.expect("request failed");

    if let Err(error) = write_response_to_file(response, file).await {
        println!("failed to write to file: {error}");
        tokio::fs::remove_file(&temp_path).await.expect("failed to delete partially-written file");
    }

    tokio::fs::rename(temp_path, path).await.expect("failed to rename file");
}

pub struct TileAvailability {
    pub total_tiles: usize,
    pub missing_tiles: Vec<TileCoordinates>,
    pub partial_tiles: Vec<TileCoordinates>,
}

pub fn check_tile_availability(directory: impl AsRef<Path>, region: TileRegion) -> TileAvailability {
    let dir = directory.as_ref();

    let mut missing_tiles = Vec::new();
    let mut partial_tiles = Vec::new();
    for coordinates in region.coordinates() {
        let filename = tile_filename(coordinates);
        let temp_filename = temp_filename(&filename);
        let path = dir.join(&filename);
        let temp_path = dir.join(&temp_filename);

        if temp_path.exists() {
            partial_tiles.push(coordinates);
        }
        if !path.exists() {
            missing_tiles.push(coordinates);
        }
    }

    TileAvailability {
        total_tiles: region.area(),
        missing_tiles,
        partial_tiles,
    }
}

pub async fn delete_partial_tiles(directory: impl AsRef<Path>, tile_coordinates: Vec<TileCoordinates>) {
    for coordinates in tile_coordinates {
        let filename = tile_filename(coordinates);
        let temp_filename = temp_filename(&filename);
        let temp_path = directory.as_ref().join(temp_filename);
        tokio::fs::remove_file(temp_path).await.expect("failed to delete file");
    }
}

pub async fn download_tiles(directory: impl AsRef<Path>, tile_coordinates: Vec<TileCoordinates>) {
    let client = Client::new();

    // Concurrency Control: Cap at 10 simultaneous downloads.
    let max_concurrent_downloads = 10;
    let semaphore = Arc::new(Semaphore::new(max_concurrent_downloads));

    // Rate Limiting: 10 requests per second = 1 tick every 100ms.
    let mut rate_limit = interval(Duration::from_millis(100));

    // Progress bar setup (now accurately tracking only remaining files)
    let pb = ProgressBar::new(tile_coordinates.len() as u64);
    pb.set_style(ProgressStyle::default_bar()
        .template("[{elapsed_precise}] {wide_bar:.cyan/blue} {pos:>7}/{len:7} {msg}")
        .unwrap()
        .progress_chars("#+-"));
    pb.enable_steady_tick(Duration::from_millis(100));

    let mut tasks = Vec::new();

    // Iterate ONLY over the coordinates that still need to be downloaded
    for coordinates in tile_coordinates {
        // Wait until 100ms has passed since the last tick
        rate_limit.tick().await;

        let permit = semaphore.clone().acquire_owned().await.unwrap();

        let client = client.clone();
        let dir = directory.as_ref().to_path_buf();
        let pb = pb.clone();

        let task = tokio::spawn(async move {
            let _permit = permit;
            download_tile_async(&client, &dir, coordinates).await;
            pb.inc(1);
        });

        tasks.push(task);
    }

    // Await the completion of all spawned tasks
    for task in tasks {
        let _ = task.await;
    }

    pb.finish();
}