use anyhow::Error;
use axum::body::Body;
use axum::http::HeaderMap;
use database::item::{DbItem};
use database::item::Trash::Both;
use database::object::Object;
use database::Database;
use futures::{io, TryStreamExt};
use rand::random;
use serde::Serialize;
use std::collections::HashMap;
use std::fs::exists;
use std::io::Write;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::{Arc, Weak};
use std::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt, BufWriter};
use tokio::sync::RwLock;
use tokio_util::io::StreamReader;
use database::repository::DbRepository;
use types::database_ids::{DatabaseId, ItemId, RepositoryId, UserId};
use types::enc_string::EncString;
use types::item::{FileData, Item};
use types::user::User;
use utils::config::BackendConfig;
use crate::permissions::Permissions;

pub struct UploadContext {
    uploads: Arc<RwLock<HashMap<u64, Arc<RwLock<Upload>>>>>,
    upload_path: PathBuf
}

impl UploadContext {
    pub fn new(config: &BackendConfig) -> Self {
        let upload_path = config.dynamic_cache_storage_path.join("upload");
        Self {
            uploads: Default::default(),
            upload_path,
        }
    }
}

impl UploadContext {
    pub async fn receive_request(&self, db: &Database, headers: &HeaderMap, permissions: &Permissions, connected_user: &User) -> Result<UploadStatus, Error> {
        let upload = self.find_or_register_upload_from_headers(db, headers, permissions, connected_user).await?;
        let mut upload = upload.write().await;

        match &upload.status {
            UploadStatus::WaitingForData { .. } => {
                upload.push_body_data();
            }
            UploadStatus::DataHashCollision { .. } => {}
            UploadStatus::Finished { item } => {
                return Ok(item);
            }
            UploadStatus::Failed { .. } => {}
        }


        Ok()
    }

    async fn find_or_register_upload_from_headers(&self, db: &Database, headers: &HeaderMap, permissions: &Permissions, connected_user: &User) -> Result<Arc<RwLock<Upload>>, Error> {
        Ok(if let Some(content_id) = headers.get("Content-Id") {
            let id = u64::from_str(content_id.to_str()?)?;
            let upload = self.uploads.read().await.get(&id).ok_or(Error::msg(format!("Upload {id} not found")))?;

            // Check permissions
            let item = &upload.read().await.item;
            if let Some(parent) = &item.parent_item {
                permissions.upload_to_directory(db, &DbItem::from_id(&db, parent, Both).await?).await?.require()?;
            } else {
                permissions.upload_to_repository(&db, &DbRepository::from_id(&db, &item.repository).await?).await?.require()?;
            }

            upload.cloned()
        } else {
            // Create a new upload
            let mut uploads = self.uploads.write().await;

            // Create temp dir if needed
            if !exists(&self.upload_path) { fs::create_dir_all(&self.upload_path).await?; }

            // Create a new upload id
            let id = loop {
                let id = random::<u64>();
                if !uploads.contains_key(&id) {
                    break id;
                }
            };

            // Parse headers and create upload
            let upload = self.new_upload_from_headers(id, headers, connected_user.id().clone(), &self.upload_path).await?;

            // Check permissions
            if let Some(parent) = &upload.item.parent_item {
                permissions.upload_to_directory(db, &DbItem::from_id(&db, parent, Both).await?).await?.require()?;
            } else {
                permissions.upload_to_repository(&db, &DbRepository::from_id(&db, &upload.item.repository).await?).await?.require()?;
            }

            let upload = Arc::new(RwLock::new(upload));
            uploads.insert(id.clone(), upload.clone());
            upload
        })
    }

    async fn new_upload_from_headers(&self, id: u64, headers: &HeaderMap, owner: UserId, temp_directory: &PathBuf) -> Result<Upload, Error> {
        // Create item structure
        let mut item = Item::default();
        item.name = EncString::try_from(headers.get("Content-Name").ok_or(Error::msg("missing Content-Name header"))?)?;
        item.description = match headers.get("Content-Description") { None => { None } Some(header) => { Some(EncString::try_from(header)?) } };
        item.in_trash = false;
        item.repository = RepositoryId::from(DatabaseId::from_str(headers.get("Content-Repository").ok_or(Error::msg("missing Content-Repository header"))?.to_str()?)?);
        item.parent_item = match headers.get("Content-Parent") { None => { None } Some(header) => { Some(ItemId::from(DatabaseId::from_str(header.to_str()?)?)) } };
        item.owner = owner.clone();
        item.file = Some(FileData {
            size: i64::from_str(headers.get("Content-Size").ok_or(Error::msg("missing Content-Size header"))?.to_str()?)?,
            mimetype: EncString::from(match mime_guess::from_path(PathBuf::from(item.name.plain()?.as_str())).first_raw() { None => { "application/octet-stream" } Some(mime_type) => { mime_type } }),
            timestamp: i64::from_str(headers.get("Content-Timestamp").ok_or(Error::msg("missing Content-Timestamp header"))?.to_str()?)?,
            object: Default::default(),
        });

        let temp_file_path = temp_directory.join(id.to_string());
        if temp_file_path.exists() { fs::remove_file(&temp_file_path)?; }
        let temp_file = BufWriter::new(tokio::fs::OpenOptions::new()
            .create(true)
            .append(false)
            .open(&temp_file_path)
            .await.map_err(|err| { Error::msg(format!("Cannot open file sink : {err}")) })?);

        Ok(Upload {
            upload_id: id,
            byte_transferred: 0,
            hasher: blake3::Hasher::new(),
            item,
            temp_file,
            temp_file_path,
            status: UploadStatus::WaitingForData { transferred: 0 },
            compare_task: None,
        })
    }

    pub async fn get_upload(&self, id: u64) -> Result<Arc<RwLock<Upload>>, Error> {
        match self.uploads.write().await.get(&id) {
            None => {Err(Error::msg(format!("Failed to get upload with id {}", id)))}
            Some(upload) => {Ok(upload.clone())}
        }
    }

    pub async fn close_upload(&self, id: u64) -> Result<(), Error> {
        self.uploads.write().await.remove(&id).ok_or(Error::msg(format!("Upload {id} not found")))?;
        Ok(())
    }
}


#[derive(Serialize, Debug, Clone)]
pub enum UploadStatus {
    WaitingForData { transferred: u64 },
    DataHashCollision { remaining: usize, compared: f64 },
    Finished { item: Item },
    Failed { error: String }
}

pub struct Upload {
    upload_id: u64,
    temp_file_path: PathBuf,
    item: Item,
    byte_transferred: usize,
    hasher: blake3::Hasher,
    status: UploadStatus,
    temp_file: BufWriter<tokio::fs::File>,
    compare_task: Option<tokio::task::JoinHandle<Result<(), Error>>>
}

impl Upload {

    pub async fn push_body_data(&mut self, db: &Database, body: Body) -> Result<UploadStatus, Error> {
        if self.data_full() {
            return Ok(self.get_state())
        }

        let mut body_reader = StreamReader::new(body.into_data_stream().map_err(|err| io::Error::new(io::ErrorKind::Other, err)));

        let mut buf = [0u8; 131072];
        loop {
            let read_data = body_reader.read(&mut buf).await?;
            if read_data == 0 { break; }
            let new_data = &buf[..read_data];
            // Hash file data
            let hash_data = self.hasher.write(new_data)?;
            // Write to temp file
            let write_data = self.temp_file.write(new_data).await?;
            if read_data != write_data && read_data != hash_data {
                return Err(Error::msg(format!("Failed to write the right amount of data (expected {}, got {})", read_data, write_data)));
            }
            self.byte_transferred += read_data;
            if self.byte_transferred > self.expected_size() {
                return Err(Error::msg(format!("Data overflow : {} > {}", self.byte_transferred, self.expected_size())));
            }
        }

        self.status = UploadStatus::WaitingForData { transferred: self.byte_transferred };

        if self.data_full() {
            self.check_conflicts(db).await?;
        }
    }

    pub fn data_full(&self) -> bool {
        self.byte_transferred == self.expected_size()
    }

    async fn check_conflicts(&mut self, db: &Database) -> Result<(), Error> {
        self.temp_file.flush().await?;
        let hash = self.hasher.clone().finalize().to_string();

        // Check file integrity
        assert_eq!(self.byte_transferred, self.expected_size(), "Transferred data overflow : {} > {}", self.byte_transferred, self.expected_size());

        // Check for object hash collision
        let mut hash_collisions = Object::from_hash(db, &hash).await?;
        if !hash_collisions.is_empty() {
            self.status = UploadStatus::DataHashCollision { remaining: hash_collisions.len(), compared: 0.0 };
            let temp_file_path = self.temp_file_path.clone();
            let db = db.clone();
            let mut item = self.item.clone();
            self.compare_task = Some(tokio::task::spawn(async move || {
                for existing_object in hash_collisions {
                    // Hash collision, we need to investigate and compare the whole file
                    if existing_object.equals_to_file(db, &temp_file_path).await? {
                        // On collision, remove the temp file and store
                        fs::remove_file(temp_file_path)?;
                        item.file.as_mut().unwrap().object = existing_object.id().clone();
                        DbItem::push(&mut item, db).await?;
                        self.status = UploadStatus::Finished { item };
                        return;
                    }
                    self.status = UploadStatus::DataHashCollision { remaining: hash_collisions.len(), compared: 0.0 }
                }
                self.status = UploadStatus::DataHashCollision { remaining: 0, compared: 1.0 }
            }));
            Ok(())
        } else {
            self.store(db, hash).await
        }
    }

    pub fn store_post_conflict(&self) {

    }

    async fn store(&mut self, db: &Database, hash: String) -> Result<(), Error> {
        // Check for path collision
        if let Ok(mut existing_at_path) = DbItem::from_path(db, &self.item.absolute_path, &self.item.repository, Both).await {
            if existing_at_path.directory.is_some() {
                let error = format!("Cannot store item to path {} : a directory with the same path already exists", existing_at_path.absolute_path.plain()?);
                self.status = UploadStatus::Failed { error: error.clone() };
                return Err(Error::msg(error));
            } else if let Some(file) = &mut existing_at_path.file {

                // Overwrite existing data with the new one
                if let Some(mut file) = &file {
                    let object = Object::insert(db, &self.temp_file_path, &hash).await?;
                    file.object = object.id().clone();
                }
                DbItem::push(&mut existing_at_path, db).await?;
                self.status = UploadStatus::Finished { item: existing_at_path.clone() };
            }
        }

        // Register the new object
        let object = Object::insert(db, &self.temp_file_path, &hash).await?;

        self.item.file.as_mut().unwrap().object = object.id().clone();
        DbItem::push(&mut self.item, db).await?;
        self.status = UploadStatus::Finished { item: self.item.clone() };
        Ok(())
    }

    pub fn item(&self) -> &Item {
        &self.item
    }

    pub fn id(&self) -> u64 {
        self.upload_id
    }

    pub async fn status(&self) -> UploadStatus {
        self.status.clone()
    }

    pub fn expected_size(&self) -> usize {
        self.item.file.as_ref().unwrap().size as usize
    }
}