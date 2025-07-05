mod building_process;
pub mod track_preset;
pub mod preset_pool;
pub mod preset_ref;

use crate::error::{ErrorKind, StreamingError};
use crate::stream_id::StreamId;
use crate::tracks::presets::building_process::BuildingProcess;
use crate::tracks::track::Track;
use std::collections::HashMap;
use std::os::unix::fs::MetadataExt;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::RwLock;
use tokio::time::sleep;
use utils::config::VideoServerConfig;
use crate::tracks::presets::preset_ref::PresetRef;

pub struct PresetBuilder {
    building_processes: RwLock<HashMap<u32, Arc<RwLock<BuildingProcess>>>>,
    bound_streams: RwLock<HashMap<StreamId, Arc<RwLock<BuildingProcess>>>>,
    last_usage: RwLock<SystemTime>,
    preset_ref: PresetRef,
    global_config: Arc<VideoServerConfig>,
}

impl PresetBuilder {
    pub fn new(global_config: Arc<VideoServerConfig>, preset_ref: PresetRef) -> Self {
        Self {
            building_processes: Default::default(),
            bound_streams: Default::default(),
            last_usage: RwLock::new(SystemTime::now()),
            preset_ref,
            global_config,
        }
    }

    pub async fn get_init_chunk(&self, track: &Track, chunk: u32) -> Result<PathBuf, StreamingError> {
        self.touch().await;
        if self.is_init_done(chunk).await {
            return self.wait_for_init(chunk).await
        }

        // Check if our stream is already bound to this current process
        let mut streams = self.bound_streams.write().await;
        if let Some(existing) = streams.get(track.owning_stream().stream_id()) {
            let process = existing.write().await;
            // Check if our currently bound process have already generated our chunk or will generate it soon enough
            if process.start_num() == chunk {
                return self.wait_for_init(chunk).await;
            }
        }

        // Otherwise we should reset this stream to an existing valid process or a new one
        streams.insert(track.owning_stream().stream_id().clone(), self.find_or_create_process(track, chunk).await?);
        self.wait_for_init(chunk).await
    }

    pub async fn get_chunk(&self, track: &Track, chunk: u32) -> Result<PathBuf, StreamingError> {
        self.touch().await;
        if self.is_chunk_done(chunk) {
            return self.wait_for_chunk(chunk).await
        }

        // Check if our stream is already bound to this current process
        let mut streams = self.bound_streams.write().await;
        if let Some(existing) = streams.get(track.owning_stream().stream_id()) {
            let process = existing.write().await;
            // Check if our currently bound process have already generated our chunk or will generate it soon enough
            if process.start_num() >= chunk && process.chunk_eta(chunk) < Duration::from_millis(1000) {
                return self.wait_for_chunk(chunk).await;
            }
        }

        // Otherwise we should reset this stream to an existing valid process or a new one
        streams.insert(track.owning_stream().stream_id().clone(), self.find_or_create_process(track, chunk).await?);
        self.wait_for_chunk(chunk).await
    }

    // Create a new ffmpeg process that will generate missing video chunks
    async fn find_or_create_process(&self, track: &Track, chunk: u32) -> Result<Arc<RwLock<BuildingProcess>>, StreamingError> {
        let mut processes = self.building_processes.write().await;

        for (_, it) in &*processes {
            let mut process = it.write().await;
            if process.start_num() >= chunk && process.chunk_eta(chunk) == Duration::from_millis(0) {
                process.usage_count += 1;
                return Ok(it.clone());
            }
        }
        // Tell other processes to stop before this one to avoid duplications
        for (_, it) in &*processes {
            let mut process = it.write().await;
            if process.start_num() < chunk {
                process.set_limit(chunk);
            }
        }
        // Check what is the limit for this process
        let mut limit = None;
        for (_, it) in &*processes {
            let process = it.read().await;
            if process.start_num() > chunk && (limit.is_none() || process.start_num() < limit.unwrap()) {
                limit = Some(process.start_num() - 1);
            }
        }
        let new_process = BuildingProcess::new(chunk, limit, track, &self.preset_ref).await?;
        let new_process = Arc::new(RwLock::new(new_process));
        processes.insert(chunk, new_process.clone());

        Ok(new_process)
    }

    async fn is_init_done(&self, start_chunk: u32) -> bool {
        let path = self.preset_ref.init_path(&self.global_config.cache_path, start_chunk);
        if !path.exists() {
            return false;
        }
        match path.metadata() {
            Ok(data) => { data.size() > 0 }
            Err(_) => { false }
        }
    }

    async fn wait_for_init(&self, start_index: u32) -> Result<PathBuf, StreamingError> {
        let path = self.preset_ref.init_path(&self.global_config.cache_path, start_index);
        let mut tries = 100;
        while tries > 0 {
            if self.is_init_done(start_index).await {return Ok(path)}
            sleep(Duration::from_millis(100)).await;
            tries -= 1;
        }

        if self.is_init_done(start_index).await { Ok(path) }
        else { Err(StreamingError::new(ErrorKind::InitNotFound{track: 0, num: start_index })) }
    }

    async fn wait_for_chunk(&self, chunk: u32) -> Result<PathBuf, StreamingError> {
        let path = self.preset_ref.chunk_path(&self.global_config.cache_path, chunk.to_string());
        let mut tries = 100;
        while tries > 0 {
            if self.is_chunk_done(chunk) { return Ok(path) }
            sleep(Duration::from_millis(100)).await;
            tries -= 1;
        }

        if self.is_chunk_done(chunk) { Ok(path) }
        else { Err(StreamingError::new(ErrorKind::ChunkNotFound{track: 0, num: chunk})) }
    }

    // Mark this stream as alive by resetting the destroy counter
    async fn touch(&self) {
        *self.last_usage.write().await = SystemTime::now();
    }

    async fn chunk_eta(&self, chunk: u32) -> Duration {
        let mut min_eta = Duration::MAX;
        for (_, it) in &*self.building_processes.read().await {
            let process = it.read().await;
            if process.start_num() <= chunk {
                let eta = process.chunk_eta(chunk);
                if eta < min_eta {
                    min_eta = eta
                }
            }
        }
        min_eta
    }

    fn is_chunk_done(&self, chunk: u32) -> bool {
        self.preset_ref.chunk_path(&self.global_config.cache_path, chunk.to_string()).exists()
    }

    pub async fn disconnect_stream(&self, stream: &StreamId) -> Result<(), StreamingError> {
        let mut building_processes = self.building_processes.write().await;
        if let Some(removed_process) = self.bound_streams.write().await.remove(stream) {
            let mut removed_proc = removed_process.write().await;
            removed_proc.usage_count -= 1;
            if removed_proc.usage_count == 0 {
                for (index, (start, _)) in building_processes.iter().enumerate() {
                    if *start == removed_proc.start_num() {
                        removed_proc.kill().await?;
                        building_processes.remove(&(index as u32));
                        break;
                    }
                }
            }
        }
        Ok(())
    }
}
