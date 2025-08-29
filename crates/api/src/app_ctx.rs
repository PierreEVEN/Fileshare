use crate::upload::UploadContext;
use anyhow::Error;
use converter::ConverterTool;
use database::Database;
use std::sync::Arc;
use utils::config::Config;
use utils::stats::Statistics;
use video_server::StreamingContext;

pub struct AppCtx {
    pub config: Config,
    pub statistics: Arc<Statistics>,
    pub database: Database,
    streaming_context: StreamingContext,
    upload_context: UploadContext,
    pub converter: ConverterTool
}

impl AppCtx {
    pub async fn new(config: Config) -> Result<Self, Error> {
        let database = Database::new(&config.backend_config).await?;

        let statistics = Arc::new(Statistics::default());

        Ok(Self {
            converter: ConverterTool::new(config.backend_config.thumbnail_processes),
            streaming_context: StreamingContext::new(config.backend_config.video_server.clone(), statistics.clone()),
            upload_context: UploadContext::new(&config.backend_config),
            config,
            statistics,
            database,
        })
    }
    pub fn streaming_context(&self) -> &StreamingContext {
        &self.streaming_context
    }
    pub fn upload_context(&self) -> &UploadContext {
        &self.upload_context
    }
}
