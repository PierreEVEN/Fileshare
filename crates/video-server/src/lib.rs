use std::fs;
use crate::media_stream::MediaStreamPool;
use std::sync::Arc;
use std::time::Duration;
use tokio::task::JoinHandle;
use tokio::time::sleep;
use tracing::error;
use utils::config::VideoServerConfig;
use utils::stats::Statistics;
use crate::error::StreamingError;
use crate::media_info::stream_reference::StreamReference;
use crate::media_stream::media_stream::MediaStream;

pub mod error;
pub mod media_stream;
pub mod media_info;

pub struct StreamingContext {
    #[allow(unused)]
    builders: MediaStreamPool,
    #[allow(unused)]
    update_process: Option<JoinHandle<()>>
}

impl StreamingContext {
    pub fn new(global_config: VideoServerConfig, stats: Arc<Statistics>) -> Self {
        // Try clear old cache
        #[allow(unused)]
        fs::remove_dir_all(&global_config.cache_path);

        let tick_interval_ms = global_config.tick_interval_ms;
        let pool = MediaStreamPool::new(global_config, stats);
        let cloned_pool = pool.clone();
        let update_process = tokio::spawn(async move {
            loop {
                sleep(Duration::from_millis(tick_interval_ms)).await;
                if let Err(err) = cloned_pool.tick().await {
                    error!("Streaming tick failed : {}", err);
                }
            }
        });
        Self {
            builders: pool,
            update_process: Some(update_process),
        }
    }

    pub async fn get_or_create_stream(&self, stream_identifier: &StreamReference) -> Result<Arc<MediaStream>, StreamingError> {
        self.builders.get_or_create_stream(stream_identifier).await
    }
}

impl Drop for StreamingContext {
    fn drop(&mut self) {
        self.update_process.take().unwrap().abort();
    }
}