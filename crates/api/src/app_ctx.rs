use crate::upload::{Upload, UploadState};
use anyhow::Error;
use database::Database;
use rand::random;
use std::collections::HashMap;
use std::fs;
use std::sync::Arc;
use tracing::info;
use types::database_ids::DatabaseId;
use utils::config::Config;
use utils::server_error::ServerError;
use video_server::media::{Media, MediaState};
use video_server::stream_id::StreamId;

pub struct AppCtx {
    pub config: Config,
    pub database: Database,
    streams: tokio::sync::RwLock<HashMap<StreamId, Arc<Media>>>,
    uploads: tokio::sync::RwLock<HashMap<String, Arc<tokio::sync::RwLock<Upload>>>>,
}

impl AppCtx {
    pub async fn new(config: Config) -> Result<Self, Error> {
        let database = Database::new(&config.backend_config).await?;
        // Try clear old cache
        #[allow(unused)]
        fs::remove_dir_all(&config.backend_config.video_server.cache_path);

        Ok(Self {
            config,
            database,
            streams: Default::default(),
            uploads: Default::default(),
        })
    }

    pub async fn add_upload(&self, mut upload: Upload) -> Result<String, Error> {
        let mut uploads = self.uploads.write().await;

        let mut id;
        loop {
            id = random::<usize>().to_string();
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

    pub async fn create_stream(&self, state: MediaState) -> Result<StreamId, ServerError> {
        let mut streams = self.streams.write().await;
        let id: StreamId = loop {
            let id = StreamId::from(random::<DatabaseId>().abs());
            if !(*streams).contains_key(&id) {
                break id;
            }
        };
        info!("Create stream @{} for item #{}", id, state.item_id());
        let media = Media::new(state, id)?;
        streams.insert(id, Arc::new(media));
        Ok(id)
    }

    pub async fn get_stream(&self, id: &StreamId) -> Option<Arc<Media>> {
        self.streams.write().await.get(id).cloned()
    }

    pub async fn kill_stream(&self, id: &StreamId) -> Result<(), Error> {
        if let Some(stream) = self.streams.write().await.remove(id) {
            stream.kill().await?;
        }
        Ok(())
    }
}
