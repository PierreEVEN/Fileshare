use std::path::PathBuf;
use crate::media_stream::MediaStreamPool;
use std::sync::Arc;
use std::time::Duration;
use tokio::task::JoinHandle;
use tokio::time::sleep;
use tracing::error;
use utils::config::VideoServerConfig;
use crate::error::StreamingError;
use crate::media_stream::media_stream::MediaStream;

pub mod media_info;
pub mod error;
pub mod media_stream;

pub struct StreamingContext {
    #[allow(unused)]
    builders: MediaStreamPool,
    #[allow(unused)]
    update_process: Option<JoinHandle<()>>
}

impl StreamingContext {
    pub fn new(global_config: VideoServerConfig) -> Self {
        let tick_interval_ms = global_config.tick_interval_ms;
        let pool = MediaStreamPool::new(global_config);
        let cloned_pool = pool.clone();
        let update_process = tokio::spawn(async move {
            sleep(Duration::from_millis(tick_interval_ms)).await;
            if let Err(err) = cloned_pool.tick().await {
                error!("Streaming tick failed : {}", err);
            }
        });
        Self {
            builders: pool,
            update_process: Some(update_process),
        }
    }

    pub async fn get_or_create_stream(&self, file: &PathBuf) -> Result<Arc<MediaStream>, StreamingError> {
        self.builders.get_or_create_stream(file).await
    }
}

impl Drop for StreamingContext {
    fn drop(&mut self) {
        self.update_process.take().unwrap().abort();
    }
}