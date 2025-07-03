use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use std::sync::Arc;
use rand::random;
use tokio::sync::RwLock;
use tracing::info;
use types::database_ids::DatabaseId;
use utils::config::VideoServerConfig;
use crate::error::StreamingError;
use tracks::presets::preset_pool::PresetPool;
use tracks::presets::PresetBuilder;
use crate::stream::{Stream, StreamState};
use crate::stream_id::StreamId;

pub mod stream;
pub mod media_info;
pub mod stream_id;
pub mod tracks;
pub mod error;

struct ServerContext {
    streams: RwLock<HashMap<StreamId, Arc<Stream>>>,
    builders: PresetPool,
}

impl ServerContext {
    pub fn new(global_config: VideoServerConfig) -> Self {
        Self {
            streams: Default::default(),
            builders: PresetPool::new(global_config),
        }
    }

    pub async fn create_stream(&self, state: StreamState) -> Result<StreamId, StreamingError> {
        let mut streams = self.streams.write().await;
        // Generate a new stream id
        let id: StreamId = loop {
            let id = StreamId::from(random::<DatabaseId>().abs());
            if !(*streams).contains_key(&id) {
                break id;
            }
        };
        // Instantiate new stream
        info!("Create stream @{} for item #{}", id, state.item_id());
        streams.insert(id, Arc::new(Stream::new(state, id, self.builders.clone())?));
        Ok(id)
    }

    pub async fn get_stream(&self, id: &StreamId) -> Option<Arc<Stream>> {
        self.streams.write().await.get(id).cloned()
    }

    pub async fn kill_stream(&self, id: &StreamId) -> Result<(), StreamingError> {
        if let Some(stream) = self.streams.write().await.remove(id) {
            stream.kill().await?;
        }
        Ok(())
    }
}