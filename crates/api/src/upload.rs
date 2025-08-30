use crate::permissions::Permissions;
use anyhow::Error;
use axum::body::Body;
use axum::extract::Request;
use axum::http::{HeaderMap, StatusCode};
use database::item::Trash::Both;
use database::item::DbItem;
use database::object::Object;
use database::repository::DbRepository;
use database::Database;
use futures::{io, TryStreamExt};
use rand::random;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::fs::{exists, File};
use std::io::{BufReader, Write};
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::{Arc};
use tokio::io::{AsyncWriteExt, BufWriter};
use tokio::sync::{RwLock};
use tokio_util::io::StreamReader;
use tracing::{error, info};
use tracing::log::warn;
use types::database_ids::{DatabaseId, ItemId, RepositoryId, UserId};
use types::enc_string::EncString;
use types::item::{FileData, Item};
use types::user::User;
use utils::config::BackendConfig;
use utils::server_error::ServerError;
use crate::app_ctx::AppCtx;

pub type UploadId = DatabaseId;

fn safe_rename(src: &Path, dst: &Path) -> std::io::Result<()> {
    match fs::rename(src, dst) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::CrossesDevices => {
            fs::copy(src, dst)?;
            fs::remove_file(src)
        }
        Err(e) => Err(e),
    }
}

#[derive(Serialize, Debug, Clone)]
pub enum UploadStatus {
    WaitingForData { transferred: usize },
    DataHashCollision { remaining: usize, compared: f64 },
    Finished { item: Item },
    Failed { error: String }
}

pub struct UploadContext {
    uploads: Arc<RwLock<HashMap<UploadId, Arc<RwLock<Upload>>>>>,
    temp_directory: PathBuf
}

impl UploadContext {
    pub fn new(config: &BackendConfig) -> Self {
        let temp_directory = config.dynamic_cache_storage_path.join("upload");
        if temp_directory.exists() {
            if let Err(err) = fs::remove_dir_all(&temp_directory) {
                error!("Failed to remove outdated upload cache : {}", err);
            }
        }
        Self {
            uploads: Default::default(),
            temp_directory,
        }
    }

    pub async fn receive_request(&self, ctx: &Arc<AppCtx>, request: Request, permissions: &Permissions, connected_user: &User) -> Result<(UploadStatus, UploadId), ServerError> {

        let upload = self.find_or_register_upload_from_headers(&ctx.database, request.headers(), permissions, connected_user).await?;

        // If upload is asking for data, append body
        let status = upload.read().await.status.clone();
        if let UploadStatus::WaitingForData { .. } = status {
            self.push_body_data(&upload, ctx, request.into_body()).await?;
        }

        let upload = upload.read().await;
        match &upload.status {
            // Remove upload if it failed or finished
            UploadStatus::Finished { item }  => {
                info!("Upload {} is finished : {}", upload.upload_id, item.name);
                self.uploads.write().await.remove(&upload.upload_id).ok_or(Error::msg(format!("Failed to unregister upload : upload {} not found", upload.upload_id)))?;
            }
            UploadStatus::Failed { error } => {
                warn!("Upload {} failed: {}", upload.upload_id, error);
                self.uploads.write().await.remove(&upload.upload_id).ok_or(Error::msg(format!("Failed to unregister upload : upload {} not found", upload.upload_id)))?;
            }
            _ => {}
        }
        Ok((upload.status.clone(), upload.upload_id))
    }

    /// Parse headers : if Content-Id is found, try to find existing upload by id else create a new one with given parameters
    async fn find_or_register_upload_from_headers(&self, db: &Database, headers: &HeaderMap, permissions: &Permissions, connected_user: &User) -> Result<Arc<RwLock<Upload>>, ServerError> {
        Ok(if let Some(content_id) = headers.get("Content-Id") {
            let id = UploadId::from_str(content_id.to_str()?)?;
            let uploads = self.uploads.read().await;
            let upload = uploads.get(&id).ok_or(Error::msg(format!("Upload {id} not found")))?;

            // Check permissions
            let item = &upload.read().await.item;
            if let Some(parent) = &item.parent_item {
                permissions.upload_to_directory(db, &DbItem::from_id(&db, parent, Both).await?).await?.require()?;
            } else {
                permissions.upload_to_repository(&db, &DbRepository::from_id(&db, &item.repository).await?).await?.require()?;
            }

            upload.clone()
        } else {
            // Create a new upload
            let mut uploads = self.uploads.write().await;

            // Create temp dir if needed
            if !exists(&self.temp_directory)? { fs::create_dir_all(&self.temp_directory)?; }

            // Create a new upload id
            let id = loop {
                let id = random::<UploadId>().abs();
                if !uploads.contains_key(&id) {
                    break id;
                }
            };

            // Parse headers and create upload
            let upload = self.new_upload_from_headers(id, headers, connected_user.id().clone(), &self.temp_directory).await?;

            // Check permissions
            if let Some(parent) = &upload.item.parent_item {
                permissions.upload_to_directory(db, &DbItem::from_id(&db, parent, Both).await?).await?.require()?;
            } else {
                permissions.upload_to_repository(&db, &DbRepository::from_id(&db, &upload.item.repository).await?).await?.require()?;
            }

            let upload = Arc::new(RwLock::new(upload));
            uploads.insert(id.clone(), upload.clone());
            info!("Create upload #{}", id);
            upload
        })
    }

    /// Instantiate a new upload object from input headers
    async fn new_upload_from_headers(&self, id: UploadId, headers: &HeaderMap, owner: UserId, temp_directory: &PathBuf) -> Result<Upload, Error> {
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
            .append(true)
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

    async fn push_body_data(&self, upload_rc: &Arc<RwLock<Upload>>, ctx: &Arc<AppCtx>, body: Body) -> Result<UploadStatus, ServerError> {

        let mut upload = upload_rc.write().await;

        let mut body_reader = StreamReader::new(body.into_data_stream().map_err(|err| io::Error::new(io::ErrorKind::Other, err)));

        let mut buf = [0u8; 131072];
        loop {
            use tokio::io::AsyncReadExt;
            let read_data = body_reader.read(&mut buf).await?;
            if read_data == 0 { break; }
            let new_data = &buf[..read_data];
            // Hash file data
            let hash_data = upload.hasher.write(new_data)?;
            // Write to temp file
            let write_data = upload.temp_file.write(new_data).await?;
            if read_data != write_data && read_data != hash_data {
                return Err(ServerError::msg(StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to write the right amount of data (expected {}, got {})", read_data, write_data)));
            }
            upload.byte_transferred += read_data;
            upload.status = UploadStatus::WaitingForData { transferred: upload.byte_transferred };

            if upload.byte_transferred > upload.expected_size() {
                return Err(ServerError::msg(StatusCode::INTERNAL_SERVER_ERROR, format!("Data overflow : {} > {}", upload.byte_transferred, upload.expected_size())));
            }
        }
        upload.temp_file.flush().await?;

        if upload.data_full() {
            // Check file integrity
            assert_eq!(upload.byte_transferred, upload.expected_size(), "Transferred data overflow : {} > {}", upload.byte_transferred, upload.expected_size());

            // Check for collisions
            let hash = upload.hasher.finalize().to_string();
            match self.get_colliding_objects(&ctx.database, &hash).await? {
                None => {
                    upload.store(&ctx.database, hash).await?;
                }
                Some(collisions) => {
                    upload.status = UploadStatus::DataHashCollision { remaining: collisions.len(), compared: 0.0 };

                    let temp_file_path = upload.temp_file_path.clone();
                    let ctx = ctx.clone();
                    let mut item = upload.item.clone();
                    let upload_rc = upload_rc.clone();

                    upload.compare_task = Some(tokio::task::spawn(async move {
                        for existing_object in &collisions {
                            // Hash collision, we need to investigate and compare the whole file
                            if Self::compare_with_file(&upload_rc, &Object::data_path(existing_object.id(), &ctx.database)).await? {
                                // On collision, remove the temp file and store
                                fs::remove_file(temp_file_path)?;
                                item.file.as_mut().unwrap().object = existing_object.id().clone();
                                DbItem::push(&mut item, &ctx.database).await?;
                                upload_rc.write().await.status = UploadStatus::Finished { item };
                                return Ok(());
                            }
                            upload_rc.write().await.status = UploadStatus::DataHashCollision { remaining: collisions.len(), compared: 0.0 };
                        }
                        let mut upload = upload_rc.write().await;
                        upload.store(&ctx.database, hash).await?;
                        Ok(())
                    }));
                }
            }
        }

        Ok(upload.status.clone())
    }

    async fn get_colliding_objects(&self, db: &Database, hash: &String) -> Result<Option<Vec<Object>>, Error> {
        // Check for object hash collision
        let hash_collisions = Object::from_hash(db, &hash).await?;
        if !hash_collisions.is_empty() {
            Ok(Some(hash_collisions))
        } else {
            Ok(None)
        }
    }


    async fn compare_with_file(upload: &Arc<RwLock<Upload>>, file: &PathBuf) -> Result<bool, Error> {
        let (uploaded_file, total_size) = {
            let upload = upload.read().await;
            let size = if let Some(file) = &upload.item.file {
                file.size
            } else {
                0
            };

            (upload.temp_file_path.clone(), size)
        };
        if !file.exists() {
            error!("The object {:?} is not pointing to a valid file", file);
            safe_rename(&uploaded_file, &file)?;
            return Ok(true);
        }

        let mut reader1 = BufReader::new(File::open(&uploaded_file).map_err(|err| Error::msg(format!("Cannot open object data : {err}")))?);
        let mut reader2 = BufReader::new(File::open(file).map_err(|err| Error::msg(format!("Cannot open tested file : {err}")))?);
        let mut buf1 = [0; 131072];
        let mut buf2 = [0; 131072];

        let mut compared = 0;

        use std::io::Read;
        while let Ok(n1) = reader1.read(&mut buf1) {
            if n1 > 0 {
                if let Ok(n2) = reader2.read(&mut buf2) {
                    if n1 == n2 && buf1 == buf2 {
                        compared += n1;
                        let mut upload_w = upload.write().await;
                        if let UploadStatus::DataHashCollision { remaining, .. } = upload_w.status {
                            upload_w.status = UploadStatus::DataHashCollision { remaining, compared: compared as f64 / total_size as f64 }
                        }
                        continue;
                    }
                    return Ok(false);
                }
            } else {
                break;
            }
        }

        println!("ah ouais");

        Ok(true)
    }
}

struct Upload {
    upload_id: UploadId,
    temp_file_path: PathBuf,
    item: Item,
    byte_transferred: usize,
    hasher: blake3::Hasher,
    status: UploadStatus,
    temp_file: BufWriter<tokio::fs::File>,
    compare_task: Option<tokio::task::JoinHandle<Result<(), ServerError>>>
}

impl Upload {

    fn data_full(&self) -> bool {
        self.byte_transferred == self.expected_size()
    }

    async fn store(&mut self, db: &Database, hash: String) -> Result<(), Error> {
        // Check for path collision
        if let Ok(mut existing_at_path) = DbItem::from_path(db, &self.item.absolute_path, &self.item.repository, Both).await {
            if existing_at_path.directory.is_some() {
                let error = format!("Cannot store item to path {} : a directory with the same path already exists", existing_at_path.absolute_path.plain()?);
                self.status = UploadStatus::Failed { error: error.clone() };
                Err(Error::msg(error))
            } else if let Some(file) = &mut existing_at_path.file {

                // Overwrite existing data with the new one
                let object = Object::insert(db, &self.temp_file_path, &hash).await?;
                file.object = object.id().clone();

                DbItem::push(&mut existing_at_path, db).await?;
                self.status = UploadStatus::Finished { item: existing_at_path.clone() };
                Ok(())
            } else {
                let error = format!("Cannot store item to path {} : the object conflicting at this path is neither a file or an object", existing_at_path.absolute_path.plain()?);
                self.status = UploadStatus::Failed { error: error.clone() };
                Err(Error::msg(error))
            }
        } else {
            // Register the new object
            let object = Object::insert(db, &self.temp_file_path, &hash).await?;

            self.item.file.as_mut().unwrap().object = object.id().clone();
            DbItem::push(&mut self.item, db).await?;
            self.status = UploadStatus::Finished { item: self.item.clone() };
            Ok(())
        }
    }

    fn expected_size(&self) -> usize {
        self.item.file.as_ref().unwrap().size as usize
    }
}