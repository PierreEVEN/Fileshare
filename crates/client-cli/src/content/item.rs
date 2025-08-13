use crate::content::filesystem::RemoteFilesystem;
use crate::serialization_utils::vec_arc_rwlock_serde;
use anyhow::Error;
use std::any::Any;
use std::ffi::OsString;
use std::fmt::{Debug, Formatter};
use std::ops::Deref;
#[cfg(target_os = "windows")]
use std::os::windows::fs::MetadataExt;
#[cfg(target_os = "linux")]
use std::os::linux::fs::MetadataExt;
use std::sync::{Arc, RwLock, Weak};
use std::time::UNIX_EPOCH;
use std::{fs};
use std::path::{Path, PathBuf};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use types::enc_string::EncString;

pub trait ItemCast: 'static {
    fn as_any(&self) -> &dyn Any;
    fn as_any_mut(&mut self) -> &mut dyn Any;
}

impl<T: 'static> ItemCast for T {
    fn as_any(&self) -> &dyn Any {
        self
    }
    fn as_any_mut(&mut self) -> &mut dyn Any {
        self
    }
}

pub trait Item: ItemCast + Send + Sync + 'static {
    fn is_regular_file(&self) -> bool;
    fn name(&self) -> EncString;
    fn size(&self) -> u64;
    fn timestamp(&self) -> u64;
    fn mime_type(&self) -> EncString;
    fn get_parent(&self) -> Result<Option<Arc<RwLock<dyn Item>>>, Error>;
    fn get_children(&self) -> Result<Vec<Arc<RwLock<dyn Item>>>, Error>;
    fn path_from_root(&self) -> Result<PathBuf, Error>;
}

impl dyn Item {
    pub fn cast<U: Item + 'static>(&self) -> &U {
        self.as_any().downcast_ref::<U>().unwrap()
    }
    pub fn cast_mut<U: Item + 'static>(&mut self) -> &mut U {
        self.as_any_mut().downcast_mut::<U>().unwrap()
    }
}

impl Debug for dyn Item {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_str(format!("'{}' - {} ({}o - {})",
                            self.name().plain().unwrap_or(String::from("Invalid/Name")),
                            self.timestamp(),
                            self.size(),
                            self.mime_type().plain().unwrap_or(String::from("invalid-mimetype")),
        ).as_str())
    }
}

#[derive(Default, Debug, Clone)]
pub struct RemoteItem {
    item: types::item::Item,
    filesystem: Option<Weak<RwLock<RemoteFilesystem>>>,
}

impl Serialize for RemoteItem {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.item.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for RemoteItem {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let mut item = Self::default();
        item.item = types::item::Item::deserialize(deserializer)?;
        Ok(item)
    }
}

impl RemoteItem {
    pub fn set_filesystem(&mut self, filesystem: &Arc<RwLock<RemoteFilesystem>>) {
        self.filesystem = Some(Arc::downgrade(filesystem));
    }
}

impl Deref for RemoteItem {
    type Target = types::item::Item;

    fn deref(&self) -> &Self::Target {
        &self.item
    }
}

impl Item for RemoteItem {
    fn is_regular_file(&self) -> bool {
        self.item.file.is_some()
    }

    fn name(&self) -> EncString {
        self.item.name.clone()
    }

    fn size(&self) -> u64 {
        if let Some(file) = &self.file {
            file.size as u64
        } else { 0 }
    }

    fn timestamp(&self) -> u64 {
        if let Some(file) = &self.file {
            file.timestamp as u64
        } else { 0 }
    }

    fn mime_type(&self) -> EncString {
        if let Some(file) = &self.file {
            file.mimetype.clone()
        } else { EncString::from("null/null") }
    }

    fn get_parent(&self) -> Result<Option<Arc<RwLock<dyn Item>>>, Error> {
        match &self.parent_item {
            None => {
                Ok(None)
            }
            Some(parent_item) => {
                match &self.filesystem {
                    None => { Err(Error::msg("Filesystem have not been defined")) }
                    Some(filesystem) => {
                        Ok(Some(filesystem.upgrade().ok_or(Error::msg("Invalid filesystem"))?
                            .read().unwrap()
                            .find_item(parent_item).ok_or(Error::msg("Parent item not found"))?.clone()))
                    }
                }
            }
        }
    }

    fn get_children(&self) -> Result<Vec<Arc<RwLock<dyn Item>>>, Error> {
        match &self.filesystem {
            None => { Err(Error::msg("Filesystem have not been defined")) }
            Some(filesystem) => {
                match &filesystem.upgrade().ok_or(Error::msg("Invalid filesystem"))?
                    .read() {
                    Ok(filesystem) => {
                        let mut children = vec![];
                        for child in &filesystem.get_children(&self.id())? {
                            let item: Arc<RwLock<dyn Item>> = child.clone();

                            children.push(item);
                        }
                        Ok(children)
                    }
                    Err(_) => { Err(Error::msg("Invalid filesystem")) }
                }
            }
        }
    }

    fn path_from_root(&self) -> Result<PathBuf, Error> {
        let mut path_string = OsString::from(".");
        path_string.push(PathBuf::from(self.absolute_path.plain()?.as_str()).into_os_string());
        Ok(PathBuf::from(path_string))
    }
}

#[derive(Serialize, Deserialize, Default, Debug, Clone)]
pub struct LocalItem {
    name: EncString,
    is_regular_file: bool,
    timestamp: u64,
    mime_type: Option<EncString>,
    size: u64,
    relative_path: PathBuf,

    #[serde(skip_deserializing, skip_serializing)]
    parent: Option<Weak<RwLock<dyn Item>>>,

    #[serde(with = "vec_arc_rwlock_serde")]
    children: Vec<Arc<RwLock<LocalItem>>>,
}

impl LocalItem {
    pub fn from_filesystem(root_dir: &Path, path: &Path, parent: Option<Arc<RwLock<dyn Item>>>) -> Result<Self, Error> {
        let metadata = fs::metadata(path)?;
        Ok(Self {
            name: EncString::from_os_string(path.file_name().ok_or(Error::msg("Invalid file name"))?),
            is_regular_file: metadata.is_file(),
            timestamp: metadata.modified()?.duration_since(UNIX_EPOCH)?.as_millis() as u64,
            mime_type: if metadata.is_file() {
                let mime_type = mime_guess::from_path(path);
                mime_type.first().map(|mime| EncString::from(mime.essence_str()))
            } else {
                None
            },
            #[cfg(target_os = "windows")]
            size: metadata.file_size(),
            #[cfg(target_os = "linux")]
            size: metadata.st_size(),
            relative_path: pathdiff::diff_paths(path, root_dir).ok_or(Error::msg("Failed to get relative path"))?,
            parent: parent.map(|parent| Arc::downgrade(&parent)),
            children: vec![],
        })
    }

    pub fn add_child(&mut self, new_child: Arc<RwLock<LocalItem>>) {
        self.children.push(new_child);
    }

    pub fn children(&self) -> &Vec<Arc<RwLock<LocalItem>>> {
        &self.children
    }

    pub fn remove_child(&mut self, name: &EncString) -> Result<(), Error> {
        for (i, child) in self.children.iter().enumerate() {
            if child.read().unwrap().name.plain()? == name.plain()? {
                self.children.remove(i);
                return Ok(());
            }
        }
        Err(Error::msg("File not found"))
    }

    pub fn set_parent(&mut self, parent: &Arc<RwLock<dyn Item>>) {
        self.parent = Some(Arc::downgrade(parent));
    }
}

impl Item for LocalItem {
    fn is_regular_file(&self) -> bool {
        self.is_regular_file
    }

    fn name(&self) -> EncString {
        self.name.clone()
    }

    fn size(&self) -> u64 {
        self.size
    }

    fn timestamp(&self) -> u64 {
        self.timestamp
    }

    fn mime_type(&self) -> EncString {
        match &self.mime_type {
            None => { EncString::default() }
            Some(string) => { string.clone() }
        }
    }

    fn get_parent(&self) -> Result<Option<Arc<RwLock<dyn Item>>>, Error> {
        match &self.parent {
            None => {
                Ok(None)
            }
            Some(parent) => {
                Ok(parent.upgrade())
            }
        }
    }

    fn get_children(&self) -> Result<Vec<Arc<RwLock<dyn Item>>>, Error> {
        let mut children = vec![];
        for child in &self.children {
            let child: Arc<RwLock<dyn Item>> = child.clone();
            children.push(child)
        }
        Ok(children)
    }

    fn path_from_root(&self) -> Result<PathBuf, Error> {
        Ok(PathBuf::from("./").join(&self.relative_path))
    }
}