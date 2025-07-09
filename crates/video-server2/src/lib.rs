use crate::media_stream::MediaStreamPool;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::task::JoinHandle;
use tokio::time::sleep;
use tracing::error;
use utils::config::VideoServerConfig;

pub mod media_info;
pub mod error;
mod media_stream;

pub struct StreamingContext {
    builders: MediaStreamPool,
    update_process: Option<JoinHandle<()>>,
    should_stop: Arc<AtomicBool>
}

impl StreamingContext {
    pub fn new(global_config: VideoServerConfig) -> Self {
        let tick_interval_ms = global_config.tick_interval_ms;
        let pool = MediaStreamPool::new(global_config);
        let should_stop = Arc::new(AtomicBool::new(false));
        let should_stop_cloned = should_stop.clone();
        let cloned_pool = pool.clone();
        let update_process = tokio::spawn(async move {
            if should_stop_cloned.load(Ordering::SeqCst) {
                return;
            }
            sleep(Duration::from_millis(tick_interval_ms)).await;
            if let Err(err) = cloned_pool.tick().await {
                error!("Streaming tick failed : {}", err);
            }
        });
        Self {
            builders: pool,
            update_process: Some(update_process),
            should_stop,
        }
    }
}