mod media_stream;
mod stream_track;
mod track_preset;

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use types::database_ids::ItemId;
use utils::config::VideoServerConfig;
use crate::error::StreamingError;
use crate::media_stream::media_stream::MediaStream;
use crate::tracks::presets::PresetBuilder;
use crate::tracks::presets::preset_ref::PresetRef;

#[derive(Clone)]
pub struct MediaStreamPool {
    pool: Arc<RwLock<HashMap<ItemId, MediaStream>>>,
    global_config: Arc<VideoServerConfig>,
}

impl MediaStreamPool {
    pub fn new(global_config: VideoServerConfig) -> Self {
        Self {
            pool: Arc::default(),
            global_config: Arc::new(global_config),
        }
    }

    pub fn global_config(&self) -> &Arc<VideoServerConfig> {
        &self.global_config
    }

    pub async fn tick(&self) -> Result<(), StreamingError> {
        let mut orphan_streams = vec![];
        for (id, stream) in &*self.pool.read().await {
            if stream.is_orphan().await? {
                orphan_streams.push(id.clone());
            }
        }
        if !orphan_streams.is_empty() {
            let mut pool = self.pool.write().await;
            for key in &orphan_streams {
                if let Some(stream) = pool.get(key) {
                    stream.destroy().await;
                }
                pool.remove(key);
            }
        }
        Ok(())
    }
}
