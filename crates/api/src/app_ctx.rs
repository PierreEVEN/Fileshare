use utils::config::Config;
use database::Database;
use crate::upload::{Upload, UploadState};
use anyhow::Error;
use rand::random;
use std::collections::HashMap;
use std::fs;
use std::sync::Arc;

pub struct AppCtx {
    pub config: Config,
    pub database: Database,
    uploads: tokio::sync::RwLock<HashMap<String, Arc<tokio::sync::RwLock<Upload>>>>,
}

impl AppCtx {
    pub async fn new(config: Config) -> Result<Self, Error> {
        let database = Database::new(&config.backend_config).await?;

        Ok(Self {
            config,
            database,
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
            None => { Err(Error::msg("Upload not found")) }
            Some(upload) => { Ok(upload.clone()) }
        }
    }

    pub async fn finalize_upload(&self, id: &String, db: &Database) -> Result<UploadState, Error> {
        let item = self.uploads.write().await.remove(id).ok_or(Error::msg("Upload not found"))?;
        let mut upload = item.write().await;
        upload.store(db).await?;
        Ok(upload.get_state())
    }
}