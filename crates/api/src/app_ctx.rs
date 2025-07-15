use crate::upload::{Upload, UploadState};
use anyhow::Error;
use database::Database;
use rand::random;
use std::collections::HashMap;
use std::fs;
use std::sync::Arc;
use utils::config::Config;
use utils::stats::Statistics;
use video_server::StreamingContext;

pub struct AppCtx {
    pub config: Config,
    pub statistics: Arc<Statistics>,
    pub database: Database,
    streaming_context: StreamingContext,
    uploads: tokio::sync::RwLock<HashMap<String, Arc<tokio::sync::RwLock<Upload>>>>,
}

impl AppCtx {
    pub async fn new(config: Config) -> Result<Self, Error> {
        let database = Database::new(&config.backend_config).await?;

        let statistics = Arc::new(Statistics::default());

        Ok(Self {
            streaming_context: StreamingContext::new(config.backend_config.video_server.clone(), statistics.clone()),
            config,
            statistics,
            database,
            uploads: Default::default(),
        })
    }

    pub async fn add_upload(&self, mut upload: Upload) -> Result<String, Error> {
        let mut uploads = self.uploads.write().await;

        let mut id;
        loop {
            id = random::<u64>().to_string();
            if !uploads.contains_key(&id) {
                break;
            }
        }

        upload.id = id.clone();
        if upload.get_file_path().exists() {
            fs::remove_file(upload.get_file_path())?;
        }
        uploads.insert(id.clone(), Arc::new(tokio::sync::RwLock::new(upload)));
        Ok(id)
    }

    pub async fn get_upload(&self, id: &String) -> Result<Arc<tokio::sync::RwLock<Upload>>, Error> {
        match self.uploads.read().await.get(id) {
            None => Err(Error::msg("Upload not found")),
            Some(upload) => Ok(upload.clone()),
        }
    }

    pub async fn finalize_upload(&self, id: &String, db: &Database) -> Result<UploadState, Error> {
        let item = self
            .uploads
            .write()
            .await
            .remove(id)
            .ok_or(Error::msg("Upload not found"))?;
        let mut upload = item.write().await;
        upload.store(db).await?;
        Ok(upload.get_state())
    }

    pub fn streaming_context(&self) -> &StreamingContext {
        &self.streaming_context
    }
}
