pub mod media_stream;
pub mod stream_track;
pub mod track_preset;
pub mod video_avc1;
pub mod preset_description;
mod ffmpeg_process;

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use utils::config::VideoServerConfig;
use crate::error::StreamingError;
use crate::media_info::stream_reference::StreamReference;
use crate::media_stream::media_stream::MediaStream;

#[derive(Clone)]
pub struct MediaStreamPool {
    pool: Arc<RwLock<HashMap<StreamReference, Arc<MediaStream>>>>,
    global_config: Arc<VideoServerConfig>,
}

impl MediaStreamPool {
    pub fn new(global_config: VideoServerConfig) -> Self {
        Self {
            pool: Arc::default(),
            global_config: Arc::new(global_config),
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
        let new_stream = Arc::new(MediaStream::new(self.global_config.clone(), stream_identifier.clone())?);
        pool.insert(stream_identifier.clone(), new_stream.clone());
        Ok(new_stream)
    }

    pub async fn tick(&self) -> Result<(), StreamingError> {
        let mut orphan_streams = vec![];
        for (path, stream) in &*self.pool.read().await {
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
        }
        Ok(())
    }
}
