pub mod media_stream;
pub mod stream_track;
pub mod track_preset;
pub mod video_avc1;
pub mod preset_description;
mod ffmpeg_process;

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicI32, Ordering};
use tokio::sync::RwLock;
use utils::config::VideoServerConfig;
use utils::stats::Statistics;
use crate::error::StreamingError;
use crate::media_info::stream_reference::StreamReference;
use crate::media_stream::media_stream::MediaStream;

#[derive(Clone)]
pub struct MediaStreamPool {
    pool: Arc<RwLock<HashMap<StreamReference, Arc<MediaStream>>>>,
    global_config: Arc<VideoServerConfig>,
    stats: Arc<StreamingStats>
}

pub struct StreamingStats {
    stats: Arc<Statistics>,
    proc_count: Arc<AtomicI32>
}

impl StreamingStats {
    pub fn add_proc(&self) {
        self.proc_count.fetch_add(1, Ordering::SeqCst);
        self.stats.set_value("VideoStreaming".to_string(), "FFMpeg processes".to_string(), vec![self.proc_count.load(Ordering::SeqCst).to_string()]);
    }
    pub fn remove_proc(&self) {
        self.proc_count.fetch_sub(1, Ordering::SeqCst);
        self.stats.set_value("VideoStreaming".to_string(), "FFMpeg processes".to_string(), vec![self.proc_count.load(Ordering::SeqCst).to_string()]);
    }
}

impl MediaStreamPool {
    pub fn new(global_config: VideoServerConfig, stats: Arc<Statistics>) -> Self {
        Self {
            pool: Arc::default(),
            global_config: Arc::new(global_config),
            stats: Arc::new(StreamingStats { stats, proc_count: Arc::new(Default::default()) })
        }
    }

    pub async fn get_or_create_stream(&self, stream_identifier: &StreamReference) -> Result<Arc<MediaStream>, StreamingError> {
        // Try get without lock
        if let Some(stream) = self.pool.read().await.get(stream_identifier) {
            return Ok(stream.clone())
        }

        // Get or insert
        let mut pool = self.pool.write().await;
        if let Some(stream) = pool.get(stream_identifier) {
            return Ok(stream.clone())
        }
        let new_stream = Arc::new(MediaStream::new(self.global_config.clone(), self.stats.clone(), stream_identifier.clone())?);
        pool.insert(stream_identifier.clone(), new_stream.clone());
        self.update_stream_stats(&*pool).await?;
        Ok(new_stream)
    }

    async fn update_stream_stats(&self, pool: &HashMap<StreamReference, Arc<MediaStream>>) -> Result<(), StreamingError> {
        let mut streams = vec![];

        for (key, stream) in pool {
            streams.push(format!("{} : {}", key.id(), stream.get_stats().await?));
        }
        self.stats.stats.set_value("VideoStreaming".to_string(), "Streams".to_string(), streams);
        Ok(())
    }

    pub async fn tick(&self) -> Result<(), StreamingError> {
        let mut orphan_streams = vec![];
        for (path, stream) in &*self.pool.read().await {
            stream.tick().await?;
            if stream.is_orphan().await? {
                orphan_streams.push(path.clone());
            }
        }
        if !orphan_streams.is_empty() {
            let mut pool = self.pool.write().await;
            for key in &orphan_streams {
                if let Some(stream) = pool.get(key) {
                    stream.destroy().await?;
                }
                pool.remove(key);
            }
            self.update_stream_stats(&*pool).await?;
        }
        Ok(())
    }
}
