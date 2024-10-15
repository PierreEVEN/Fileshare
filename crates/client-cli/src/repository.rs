use crate::content::connection::Connection;
use crate::content::diff::Action;
use crate::content::filesystem::{Filesystem, LocalFilesystem, RemoteFilesystem};
use crate::content::item::{Item, LocalItem, RemoteItem};
use crate::content::meta_dir::MetaDir;
use anyhow::Error;
use futures_util::StreamExt;
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use paris::{error, info};
use reqwest::Body;
use serde_derive::{Deserialize, Serialize};
use std::fs::File;
use std::io::Write;
use std::ops::Add;
use std::sync::{Arc, RwLock};
use std::time::{Duration, UNIX_EPOCH};
use std::{fs};
use std::path::Path;
use tokio_util::io::ReaderStream;
use types::enc_string::EncString;
use types::item::CreateDirectoryParams;

#[derive(Serialize, Deserialize, Debug, Clone)]
struct AuthToken {
    token: String,
    expiration_date: u64,
}

#[derive(Serialize, Deserialize, Default)]
pub struct Repository {
    #[serde(default = "empty_connection")]
    connection: Connection,

    #[serde(default = "empty_string")]
    editor_command: String,

    #[serde(skip_deserializing, skip_serializing)]
    scanned_content: Option<Arc<RwLock<LocalFilesystem>>>,

    #[serde(skip_deserializing, skip_serializing)]
    local_content: Option<Arc<RwLock<LocalFilesystem>>>,

    #[serde(skip_deserializing, skip_serializing)]
    remote_content: Option<Arc<RwLock<RemoteFilesystem>>>,
}

fn empty_connection() -> Connection {
    Connection::default()
}

fn empty_string() -> String {
    String::new()
}

impl Repository {
    pub fn new(metadata_directory: MetaDir) -> Result<Self, Error> {
        let config_path = metadata_directory.repository_config_path()?;
        let mut repository = if config_path.exists() {
            serde_json::from_str(fs::read_to_string(config_path)?.as_str())?
        } else {
            Self::default()
        };
        repository.connection = Connection::new(metadata_directory)?;
        Ok(repository)
    }

    pub fn set_editor_command(&mut self, new_editor_command: String) {
        self.editor_command = new_editor_command;
    }

    pub fn get_editor_command(&self) -> &str { self.editor_command.as_str() }

    pub fn connection(&self) -> &Connection {
        &self.connection
    }

    pub fn connection_mut(&mut self) -> &mut Connection {
        &mut self.connection
    }

    pub async fn fetch_remote_content(&mut self) -> Result<Arc<RwLock<RemoteFilesystem>>, Error> {
        match &self.remote_content {
            None => {}
            Some(remote_content) => { return Ok(remote_content.clone()); }
        }
        let response = self.connection.get(format!("/repository/content/{}/", self.connection.remote_id()?)).await?.send().await?;

        let data = self.connection.parse_result(response).await?
            .error_for_status()?
            .text().await?;
        let mut content: Vec<RemoteItem> = serde_json::from_str(data.as_str())?;
        let filesystem = Arc::new(RwLock::new(RemoteFilesystem::default()));
        for item in &mut content {
            item.set_filesystem(&filesystem);
            filesystem.write().unwrap().add_item(Arc::new(RwLock::new(item.clone())));
        }

        self.remote_content = Some(filesystem.clone());
        Ok(filesystem)
    }

    pub fn fetch_local_content(&mut self) -> Result<Arc<RwLock<LocalFilesystem>>, Error> {
        match &self.local_content {
            None => {}
            Some(local_content) => { return Ok(local_content.clone()); }
        }

        let db_path = self.connection.metadata_directory().local_database_path()?;
        self.local_content = Some(if db_path.exists() {
            let mut local_content = serde_json::from_str::<LocalFilesystem>(fs::read_to_string(db_path)?.as_str())?;
            local_content.post_deserialize();
            Arc::new(RwLock::new(local_content))
        } else {
            info!("Created new local database");
            Arc::new(RwLock::new(LocalFilesystem::default()))
        });
        match &self.local_content {
            None => { Err(Error::msg("Local content is not valid")) }
            Some(local_content) => { Ok(local_content.clone()) }
        }
    }

    pub fn scan_local_content(&mut self) -> Result<Arc<RwLock<LocalFilesystem>>, Error> {
        match &self.scanned_content {
            None => {}
            Some(scanned_content) => { return Ok(scanned_content.clone()); }
        }
        let filesystem = Arc::new(RwLock::new(LocalFilesystem::from_fileshare_root(&self.connection.metadata_directory().root()?)?));
        self.scanned_content = Some(filesystem.clone());
        Ok(filesystem)
    }

    pub async fn download_item(&mut self, item: Arc<RwLock<dyn Item>>) -> Result<(), Error> {
        let mut items_to_download = vec![item];
        while !items_to_download.is_empty() {
            match items_to_download.pop() {
                None => { return Err(Error::msg("Invalid behavior")); }
                Some(item) => {
                    match item.read() {
                        Ok(item) => {
                            let item = item.cast::<RemoteItem>();
                            if item.is_regular_file() {
                                let downloaded_path = self.connection.metadata_directory().tmp_download_dir()?.join(format!("download_{}", item.id()).as_str());
                                let mut data_file = File::create(downloaded_path.clone())?;
                                match self.download_file(item, &mut data_file).await {
                                    Ok(_) => {
                                        let final_path = self.connection.metadata_directory().root()?.join(item.path_from_root()?);

                                        fs::rename(downloaded_path, final_path.clone())?;

                                        let timestamp = item.timestamp();
                                        File::options().write(true).open(final_path)?.set_modified(UNIX_EPOCH.add(Duration::from_millis(timestamp)))?;
                                        let root = self.connection.metadata_directory().root()?.clone();
                                        self.update_local_item_state(&root, item as &dyn Item)?;
                                    }
                                    Err(err) => {
                                        if downloaded_path.exists() {
                                            fs::remove_file(downloaded_path)?;
                                        }
                                        return Err(err);
                                    }
                                }
                            } else {
                                let remote_content = self.fetch_remote_content().await?.clone();
                                match remote_content.read().unwrap().find_from_path(&item.path_from_root()?)? {
                                    None => {}
                                    Some(remote_item_data) => {
                                        let dir_path = self.connection.metadata_directory().root()?.join(item.path_from_root()?);
                                        if dir_path.exists() {
                                            if !dir_path.metadata()?.is_dir() {
                                                error!("Cannot create directory {} : a file with the same name already exists !", dir_path.display());
                                            }
                                        } else {
                                            fs::create_dir(dir_path.clone())?;
                                        }
                                        let root = self.connection.metadata_directory().root()?.clone();
                                        self.update_local_item_state(&root, item as &dyn Item)?;
                                        for child in remote_item_data.read().unwrap().get_children()? {
                                            items_to_download.push(child);
                                        }
                                    }
                                };
                            }
                        }
                        Err(err) => {
                            return Err(Error::msg(format!("Poison error : {}", err)));
                        }
                    }
                }
            }
        }
        Ok(())
    }

    fn resync_local_item_state(&mut self, item: &dyn Item) -> Result<(), Error> {
        let root = self.connection.metadata_directory().root()?.clone();
        self.update_local_item_state(&root, item)?;

        for child in item.get_children()? {
            self.resync_local_item_state(&*child.read().unwrap())?;
        }

        Ok(())
    }

    fn update_local_item_state(&mut self, root_dir: &Path, item: &dyn Item) -> Result<(), Error> {
        let item_path = root_dir.join(item.path_from_root()?);

        match self.fetch_local_content() {
            Ok(local_filesystem) => {
                let local_filesystem = &mut *local_filesystem.write().unwrap();
                match item.get_parent()? {
                    None => {
                        local_filesystem.update_item_from_filesystem(&Arc::new(RwLock::new(LocalItem::from_filesystem(&self.connection.metadata_directory().root()?, &item_path, None)?)))?;
                    }
                    Some(parent) => {
                        let found_parent = local_filesystem.find_from_path(&parent.read().unwrap().path_from_root()?)?.clone();
                        local_filesystem.update_item_from_filesystem(&Arc::new(RwLock::new(LocalItem::from_filesystem(&self.connection.metadata_directory().root()?, &item_path, found_parent)?)))?;
                    }
                }
                Ok(())
            }
            Err(err) => { Err(err) }
        }?;

        Ok(())
    }

    async fn download_file(&mut self, item: &RemoteItem, target_container: &mut File) -> Result<(), Error> {
        let mut stream = self.connection.get(format!("/item/get/{}/", item.id())).await?
            .send().await?
            .error_for_status()?
            .bytes_stream();

        let m = MultiProgress::new();
        let pb = m.add(ProgressBar::new(item.size()));
        pb.set_style(ProgressStyle::with_template("{elapsed} [{wide_bar:.yellow/red}] ({bytes} / {total_bytes}) {eta}")?.progress_chars("#>-"));
        pb.set_message(item.name.plain()?);
        let title_pb = m.add(ProgressBar::new(item.size()));
        title_pb.set_message(item.name.plain()?);
        title_pb.set_style(ProgressStyle::with_template("Downloading {msg} ({bytes_per_sec}) {spinner:.green} ")?);

        while let Some(chunk_result) = stream.next().await {
            let chunk_result = chunk_result?;
            pb.inc(chunk_result.len() as u64);
            title_pb.inc(chunk_result.len() as u64);
            target_container.write_all(chunk_result.as_ref())?;
        }
        target_container.flush()?;
        title_pb.finish_and_clear();
        pb.set_style(ProgressStyle::with_template(" ✅  {msg} ({total_bytes}) [{wide_bar:.green/red}] {elapsed}")?.progress_chars("->-"));
        pb.finish();
        Ok(())
    }


    pub async fn upload_item(&mut self, item_ref: Arc<RwLock<dyn Item>>) -> Result<(), Error> {
        let mut items_to_upload = vec![item_ref];
        while let Some(item_ref) = items_to_upload.pop() {
            match item_ref.read() {
                Ok(item) => {
                    let item = item.cast::<LocalItem>();

                    if item.is_regular_file() {
                        self.upload_file(item).await?;
                    } else {
                        self.create_remote_dir(item).await?;
                        for child in item.get_children()? {
                            items_to_upload.push(child);
                        }
                    }
                }
                Err(err) => { return Err(Error::msg(format!("{}", err))) }
            }
            let root = self.connection.metadata_directory().root()?.clone();
            self.update_local_item_state(&root, &*item_ref.read().unwrap())?;
        }
        Ok(())
    }

    async fn create_remote_dir(&mut self, item: &LocalItem) -> Result<(), Error> {
        match item.get_parent()? {
            None => {
                let dir_data = CreateDirectoryParams {
                    name: item.name(),
                    repository: self.connection.remote_id()?,
                    parent_item: None,
                };

                let result = self.connection.post("/item/new-directory/".to_string()).await?
                    .json(&vec![dir_data])
                    .send().await?;
                let new_dirs: Vec<RemoteItem> = self.connection.parse_result(result).await?.json().await?;
                let remote_content = self.fetch_remote_content().await?;
                let mut remote_content = remote_content.write().unwrap();
                for dir in new_dirs {
                    remote_content.add_item(Arc::new(RwLock::new(dir)));
                }
            }
            Some(parent) => {
                let remote_content = self.fetch_remote_content().await?;
                let mut remote_content = remote_content.write().unwrap();
                match remote_content.find_from_path(&parent.read().unwrap().path_from_root()?)? {
                    None => {
                        return Err(Error::msg("Failed to find parent item from path"));
                    }
                    Some(remote_parent) => {
                        let dir_data = CreateDirectoryParams {
                            name: item.name(),
                            repository: self.connection.remote_id()?,
                            parent_item: Some(remote_parent.read().unwrap().cast::<RemoteItem>().id().clone()),
                        };

                        let result = self.connection.post("/item/new-directory/".to_string()).await?
                            .json(&vec![dir_data])
                            .send().await?;
                        let new_dirs: Vec<RemoteItem> = self.connection.parse_result(result).await?.json().await?;

                        for dir in new_dirs {
                            remote_content.add_item(Arc::new(RwLock::new(dir)));
                        }
                    }
                }
            }
        }

        let root = self.connection.metadata_directory().root()?.clone();
        let new_dir = Arc::new(RwLock::new(LocalItem::from_filesystem(&root, &root.join(item.path_from_root()?), item.get_parent()?)?));
        match item.get_parent()? {
            None => {
                let local_content = self.scan_local_content()?;
                local_content.write().unwrap().add_to_root(new_dir);
            }
            Some(parent) => {
                parent.write().unwrap().cast_mut::<LocalItem>().add_child(new_dir);
            }
        }

        Ok(())
    }

    async fn upload_file(&mut self, item: &LocalItem) -> Result<(), Error> {
        let parent = match item.get_parent()? {
            None => { None }
            Some(parent) => {
                let remote_content = self.fetch_remote_content().await?;
                let remote_content = remote_content.read().unwrap();
                match remote_content.find_from_path(&parent.read().unwrap().path_from_root()?)? {
                    None => { return Err(Error::msg("Failed to find remote directory")) }
                    Some(parent) => { Some(parent.read().unwrap().cast::<RemoteItem>().id().clone()) }
                }
            }
        };

        #[derive(Deserialize, Debug)]
        struct UploadResult {
            message: Option<String>,
        }

        let mut path_string = path_clean::clean(item.path_from_root()?.parent().unwrap()).display().to_string();
        path_string = path_string.replace("\\", "/");
        path_string = path_string.replace("./", "");
        if path_string == "."
        {
            path_string = String::from("/")
        }
        let mut encoded_path = String::from("/");
        path_string.split("/").for_each(|item| {
            encoded_path += EncString::encode(item).encoded().as_str();
            encoded_path += "/";
        });

        let file = tokio::fs::File::open(self.connection.metadata_directory().root()?.join(item.path_from_root()?)).await?;

        let m = MultiProgress::new();
        let pb = m.add(ProgressBar::new(item.size()));
        pb.set_style(ProgressStyle::with_template("{elapsed} [{wide_bar:.yellow/red}] ({bytes} / {total_bytes}) {eta}")?.progress_chars("#>-"));
        pb.set_message(item.name().plain()?);
        let title_pb = m.add(ProgressBar::new(item.size()));
        title_pb.set_style(ProgressStyle::with_template(format!("{} {} {}", item.path_from_root()?.parent().unwrap().display(), "Upload {msg} to", "({bytes_per_sec}) {spinner:.green}").as_str())?);
        title_pb.set_message(item.name().plain()?);
        let total = item.size() as usize;
        let mut elapsed = 0;


        let mut reader_stream = ReaderStream::with_capacity(file, 1024 * 512);
        let async_stream = async_stream::stream! {
            while let Some(chunk) = reader_stream.next().await {
                if let Ok(chunk) = &chunk {
                    elapsed += chunk.len();
                    pb.set_position(elapsed as u64);
                    title_pb.set_position(elapsed as u64);

                    if elapsed >= total {
                        title_pb.finish_and_clear();
                        pb.set_style(ProgressStyle::with_template(" ✅  {msg} ({total_bytes}) [{wide_bar:.green/red}] {elapsed}").unwrap().progress_chars("-<-"));
                        pb.finish();
                    }
                }
                yield chunk;
            }
        };

        let mut request = self.connection.post("/item/send/".to_string()).await?
            .header("Content-Name", item.name().encoded().as_str())
            .header("Content-Size", item.size().to_string().as_str())
            .header("Content-Timestamp", item.timestamp().to_string().as_str())
            .header("Content-Mimetype", item.mime_type().encoded().as_str())
            .header("Content-Repository", self.connection.remote_id()?.to_string());
        if let Some(parent) = parent {
            request = request.header("Content-Parent", parent.to_string());
        }

        let json_data: UploadResult = self.connection_mut().parse_result(request
            .body(Body::wrap_stream(async_stream))
            .send().await?).await?
            .error_for_status()?
            .json().await?;


        if let Some(message) = json_data.message {
            if !message.is_empty() {
                error!("Upload failed : {}", message);
                return Ok(());
            }
        }

        Ok(())
    }

    async fn remove_local_item(&mut self, item_ref: &Arc<RwLock<dyn Item>>) -> Result<(), Error> {
        if let Ok(local_filesystem) = self.fetch_local_content() {
            let local_filesystem = &mut *local_filesystem.write().unwrap();
            let root = self.connection.metadata_directory().root()?.clone();
            local_filesystem.remove_item(&root, item_ref.read().unwrap().cast::<LocalItem>()).await?;
        }
        Ok(())
    }

    async fn remove_remote_item(&mut self, scanned_ref: &Arc<RwLock<dyn Item>>, remote_ref: &Arc<RwLock<dyn Item>>) -> Result<(), Error> {
        let result = self.connection.post(format!("{}move-to-trash/", "todo"))
            .await?.json(&vec![remote_ref.read().unwrap().cast::<RemoteItem>().id()])
            .send().await?;
        self.connection_mut().parse_result(result).await?;
        self.remove_local_item(scanned_ref).await?;
        Ok(())
    }

    pub async fn apply_actions(&mut self, actions: &Vec<Action>) -> Result<(), Error> {
        if actions.is_empty() {
            info!("Nothing to do !");
        }

        for action in actions {
            match action {
                Action::ResyncLocal(scanned) => {
                    self.resync_local_item_state(&*scanned.read().unwrap())?;
                }
                Action::ConflictAddLocalNewer(_scanned, _remote) => {
                    todo!()
                }
                Action::ErrorRemoteDowngraded(_scanned, _remote) => {
                    todo!()
                }
                Action::LocalUpgraded(scanned, _remote) => {
                    self.upload_item(scanned.clone()).await?;
                }
                Action::ConflictBothDowngraded(_scanned, _local, _remote) => {
                    todo!()
                }
                Action::ConflictBothUpgraded(_scanned, _local, _remote) => {
                    todo!()
                }
                Action::ConflictLocalUpgradedRemoteDowngraded(_scanned, _local, _remote) => {
                    todo!()
                }
                Action::ConflictAddRemoteNewer(_scanned, _remote) => {
                    todo!()
                }
                Action::RemoteUpgraded(_, remote) => {
                    self.download_item(remote.clone()).await?;
                }
                Action::ErrorLocalDowngraded(_scanned, _remote) => {
                    todo!()
                }
                Action::ConflictLocalDowngradedRemoteUpgraded(_scanned, _local, _remote) => {
                    todo!()
                }
                Action::RemoteRemoved(scanned) => {
                    self.remove_local_item(scanned).await?;
                }
                Action::LocalAdded(scanned) => {
                    self.upload_item(scanned.clone()).await?;
                }
                Action::LocalRemoved(local, remote) => {
                    self.remove_remote_item(local, remote).await?;
                }
                Action::RemoteAdded(remote) => {
                    self.download_item(remote.clone()).await?;
                }
                Action::RemovedOnBothSides(local) => {
                    self.remove_local_item(local).await?
                }
            }
        }

        Ok(())
    }
}

impl Drop for Repository {
    fn drop(&mut self) {
        if let Some(local_content) = &self.local_content {
            match serde_json::to_string(&*local_content.read().unwrap()) {
                Ok(local_db_string) => {
                    match fs::write(self.connection.metadata_directory().local_database_path().unwrap(), local_db_string.as_str()) {
                        Ok(_) => {}
                        Err(_err) => { panic!("Failed to serialize local database : {_err}") }
                    };
                }
                Err(_err) => { panic!("Failed to serialize local database : {_err}") }
            }
        }

        let serialized = serde_json::to_string(self).expect("Failed to serialize configuration data");
        fs::write(self.connection.metadata_directory().repository_config_path().unwrap(), serialized).expect("Unable to write configuration lock file");
    }
}