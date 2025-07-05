use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use utils::config::VideoServerConfig;
use crate::error::StreamingError;
use crate::tracks::presets::PresetBuilder;
use crate::tracks::presets::preset_ref::PresetRef;

#[derive(Clone)]
pub struct PresetPool {
    pool: Arc<RwLock<HashMap<PresetRef, Arc<PresetBuilder>>>>,
    global_config: Arc<VideoServerConfig>,
}

impl PresetPool {
    pub fn new(global_config: VideoServerConfig) -> Self {
        Self {
            pool: Arc::new(Default::default()),
            global_config: Arc::new(global_config),
        }
    }

    pub async fn find_or_create_preset(&self, track_ref: &PresetRef) -> Result<Arc<PresetBuilder>, StreamingError> {
        let mut builders = self.pool.write().await;
        if let Some(track) = builders.get(track_ref) {
            Ok(track.clone())
        } else {
            track_ref.init_directories(&self.global_config.cache_path)?;
            let new_builder = Arc::new(PresetBuilder::new(self.global_config.clone(), track_ref.clone()));
            builders.insert(track_ref.clone(), new_builder.clone());
            Ok(new_builder)
        }
    }
    pub async fn get_builder(&self, track_ref: &PresetRef) -> Option<Arc<PresetBuilder>> {
        self.pool.read().await.get(track_ref).cloned()
    }

    pub fn global_config(&self) -> &Arc<VideoServerConfig> {
        &self.global_config
    }
}
