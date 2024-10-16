use std::fmt::Formatter;
use anyhow::Error;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use serde::de::{MapAccess, Visitor};
use serde::ser::SerializeStruct;
use crate::database_ids::{DatabaseIdTrait, ItemId, ObjectId, RepositoryId, UserId};
use crate::enc_path::EncPath;
use crate::enc_string::EncString;

#[cfg(feature = "tokio-postgres")]
use postgres_from_row::FromRow;
#[cfg(feature = "tokio-postgres")]
use tokio_postgres::Row;

#[cfg_attr(feature = "tokio-postgres", derive(FromRow))]
#[derive(Debug, Serialize, Clone, Default)]
pub struct FileData {
    pub size: i64,
    pub mimetype: EncString,
    pub timestamp: i64,
    pub object: ObjectId,
}

#[cfg_attr(feature = "tokio-postgres", derive(FromRow))]
#[derive(Debug, Serialize, Clone, Default)]
pub struct DirectoryData {
    pub open_upload: bool,
    pub num_items: i64,
    pub content_size: i64,
}

#[derive(Debug, Default, Clone)]
pub struct Item {
    id: ItemId,
    pub repository: RepositoryId,
    pub owner: UserId,
    pub name: EncString,
    pub description: Option<EncString>,
    pub parent_item: Option<ItemId>,
    pub absolute_path: EncPath,
    pub in_trash: bool,
    pub directory: Option<DirectoryData>,
    pub file: Option<FileData>,
}

impl Item {
    pub fn set_id(&mut self, id: ItemId) -> Result<(), Error> {
        if self.id.is_valid() {
            Err(Error::msg("Cannot override a valid id"))
        } else {
            self.id = id;
            Ok(())
        }
    }
    pub fn clear_id(&mut self) -> ItemId {
        let old_id = self.id.clone();
        self.id = Default::default();
        old_id
    }
    pub fn id(&self) -> &ItemId {
        &self.id
    }
}


#[cfg(feature = "tokio-postgres")]
impl FromRow for Item {
    fn from_row(row: &Row) -> Self {
        let mut item = Self {
            id: row.get::<&str, ItemId>("id"),
            repository: row.get::<&str, RepositoryId>("repository"),
            owner: row.get::<&str, UserId>("owner"),
            name: row.get::<&str, EncString>("name"),
            description: if let Ok(description) = row.try_get::<&str, EncString>("description") { Some(description) } else { None },
            parent_item: if let Ok(parent_item) = row.try_get::<&str, ItemId>("parent_item") { Some(parent_item) } else { None },
            absolute_path: row.get::<&str, EncPath>("absolute_path"),
            in_trash: row.get::<&str, bool>("in_trash"),
            directory: None,
            file: None,
        };
        if let Ok(size) = row.try_get::<&str, i64>("size") {
            item.file = Some(FileData {
                size,
                mimetype: row.get::<&str, EncString>("mimetype"),
                timestamp: row.get::<&str, i64>("timestamp"),
                object: row.get::<&str, ObjectId>("object"),
            })
        } else if let Ok(open_upload) = row.try_get::<&str, bool>("open_upload") {
            item.directory = Some(DirectoryData {
                open_upload,
                num_items: row.get::<&str, i64>("num_items"),
                content_size: row.get::<&str, i64>("content_size"),
            });
        } else {
            panic!("Parsed item is neither a file or a directory : missing data");
        }
        item
    }

    fn try_from_row(row: &Row) -> Result<Self, tokio_postgres::Error> {
        let mut item = Self {
            id: row.try_get::<&str, ItemId>("id")?,
            repository: row.try_get::<&str, RepositoryId>("repository")?,
            owner: row.try_get::<&str, UserId>("owner")?,
            name: row.try_get::<&str, EncString>("name")?,
            description: if let Ok(description) = row.try_get::<&str, EncString>("description") { Some(description) } else { None },
            parent_item: if let Ok(parent_item) = row.try_get::<&str, ItemId>("parent_item") { Some(parent_item) } else { None },
            absolute_path: row.try_get::<&str, EncPath>("absolute_path")?,
            in_trash: row.try_get::<&str, bool>("in_trash")?,
            directory: None,
            file: None,
        };

        if let Ok(size) = row.try_get::<&str, i64>("size") {
            item.file = Some(FileData {
                size,
                mimetype: row.get::<&str, EncString>("mimetype"),
                timestamp: row.get::<&str, i64>("timestamp"),
                object: row.get::<&str, ObjectId>("object"),
            })
        } else if let Ok(open_upload) = row.try_get::<&str, bool>("open_upload") {
            item.directory = Some(DirectoryData {
                open_upload,
                num_items: row.try_get::<&str, i64>("num_items")?,
                content_size: row.try_get::<&str, i64>("content_size")?,
            });
        }
        Ok(item)
    }
}

impl Serialize for Item {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("Item", 3)?;

        state.serialize_field("id", &self.id)?;
        state.serialize_field("repository", &self.repository)?;
        state.serialize_field("owner", &self.owner)?;
        state.serialize_field("name", &self.name)?;
        if let Some(description) = &self.description {
            state.serialize_field("description", description)?;
        }
        if let Some(parent_item) = &self.parent_item {
            state.serialize_field("parent_item", parent_item)?;
        }
        state.serialize_field("absolute_path", &self.absolute_path)?;
        state.serialize_field("in_trash", &self.in_trash)?;
        if let Some(directory) = &self.directory {
            state.serialize_field("open_upload", &directory.open_upload)?;
            state.serialize_field("content_size", &directory.content_size)?;
            state.serialize_field("num_items", &directory.num_items)?;
            state.serialize_field("is_regular_file", &false)?;
        } else {
            match &self.file {
                None => {
                    return Err(serde::ser::Error::custom("Missing file data : this item is neither a file or a directory."))
                }
                Some(file) => {
                    state.serialize_field("is_regular_file", &true)?;
                    state.serialize_field("timestamp", &file.timestamp)?;
                    state.serialize_field("mimetype", &file.mimetype)?;
                    state.serialize_field("size", &file.size)?;
                }
            };
        }
        state.end()
    }
}

impl<'de> Deserialize<'de> for Item {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct ItemVisitor;

        impl<'de> Visitor<'de> for ItemVisitor {
            type Value = Item;

            fn expecting(&self, formatter: &mut Formatter) -> std::fmt::Result {
                formatter.write_str("Item data")
            }

            fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
            where
                A: MapAccess<'de>,
            {
                let mut item = Item::default();
                item.file = Some(FileData::default());
                item.directory = Some(DirectoryData::default());

                while let Some(key) = map.next_key()? {
                    match key {
                        "id" => { item.id = map.next_value()? }
                        "repository" => { item.repository = map.next_value()? }
                        "owner" => { item.owner = map.next_value()? }
                        "name" => { item.name = map.next_value()? }
                        "description" => { item.description = map.next_value()? }
                        "parent_item" => { item.parent_item = map.next_value()? }
                        "absolute_path" => { item.absolute_path = map.next_value()? }
                        "in_trash" => { item.in_trash = map.next_value()? }
                        "is_regular_file" => {
                            if map.next_value()? {
                                item.directory = None;
                            } else {
                                item.file = None;
                            }
                        }
                        "open_upload" => { if let Some(directory) = &mut item.directory { directory.open_upload = map.next_value()? } }
                        "content_size" => { if let Some(directory) = &mut item.directory { directory.content_size = map.next_value()? } }
                        "num_items" => { if let Some(directory) = &mut item.directory { directory.num_items = map.next_value()? } }
                        "timestamp" => { if let Some(file) = &mut item.file { file.timestamp = map.next_value()? } }
                        "mimetype" => { if let Some(file) = &mut item.file { file.mimetype = map.next_value()? } }
                        "size" => { if let Some(file) = &mut item.file { file.size = map.next_value()? } }
                        _ => {}
                    }
                }
                Ok(item)
            }
        }
        const FIELDS: &[&str] = &["id", "repository", "owner", "name", "description", "parent_item", "absolute_path", "in_trash", "open_upload", "content_size", "num_items", "is_regular_file", "timestamp", "mimetype", "size"];
        deserializer.deserialize_struct("Item", FIELDS, ItemVisitor)
    }
}

#[derive(Deserialize, Serialize)]
pub struct CreateDirectoryParams {
    pub name: EncString,
    pub repository: RepositoryId,
    pub parent_item: Option<ItemId>,
}
