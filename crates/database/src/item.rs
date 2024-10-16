use crate::object::{Object};
use crate::{Database};
use types::enc_path::EncPath;
use types::enc_string::EncString;
use crate::{query_fmt, query_object, query_objects};
use anyhow::Error;
use postgres_from_row::FromRow;
use serde::{Deserialize};
use std::fmt::{Display, Formatter};
use types::database_ids::{DatabaseIdTrait, ItemId, ObjectId, RepositoryId, UserId};
use types::item::Item;

pub enum Trash {
    Yes,
    No,
    Both,
}

impl Display for Trash {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Trash::Yes => { "AND in_trash" }
            Trash::No => { "AND NOT in_trash" }
            Trash::Both => { "" }
        })
    }
}

#[derive(Deserialize, Debug)]
pub struct ItemSearchRepositoryField {
    pub repository: RepositoryId,
    pub root_items: Vec<ItemId>,
}

#[derive(Deserialize, Debug)]
pub struct ItemSearchData {
    pub repositories: Vec<ItemSearchRepositoryField>,
    pub name_filter: Option<EncString>,
    pub before: Option<i64>,
    pub after: Option<i64>,
    pub max_size: Option<i64>,
    pub  min_size: Option<i64>,
    pub mime_type: Option<EncString>,
    pub owners: Option<Vec<UserId>>,
}

pub struct DbItem;
impl DbItem {
    pub async fn from_id(db: &Database, id: &ItemId, filter: Trash) -> Result<Item, Error> {
        query_object!(db, Item, format!("SELECT * FROM SCHEMA_NAME.item_full_view WHERE id = $1 {filter}"), id).ok_or(Error::msg("Failed to find item from id"))
    }

    pub async fn from_path(db: &Database, path: &EncPath, repository: &RepositoryId, filter: Trash) -> Result<Item, Error> {
        query_object!(db, Item, format!("SELECT * FROM SCHEMA_NAME.item_full_view WHERE absolute_path = $1 AND repository = $2 {filter}"), path, repository).ok_or(Error::msg(format!("Failed to find item from path : {path}")))
    }

    pub async fn from_repository(db: &Database, id: &RepositoryId, filter: Trash) -> Result<Vec<Item>, Error> {
        Ok(query_objects!(db, Item, format!("SELECT * FROM SCHEMA_NAME.item_full_view WHERE repository = $1 {filter}"), id))
    }

    pub async fn from_user(db: &Database, id: &UserId, filter: Trash) -> Result<Vec<Item>, Error> {
        Ok(query_objects!(db, Item, format!("SELECT * FROM SCHEMA_NAME.item_full_view WHERE owner = $1 {filter}"), id))
    }

    pub async fn from_object(db: &Database, id: &ObjectId, filter: Trash) -> Result<Vec<Item>, Error> {
        Ok(query_objects!(db, Item, format!("SELECT * FROM SCHEMA_NAME.item_full_view WHERE id IN (SELECT id FROM SCHEMA_NAME.files WHERE object = $1) {filter}"), id))
    }

    pub async fn from_parent(db: &Database, parent_directory: &ItemId, filter: Trash) -> Result<Vec<Item>, Error> {
        Ok(query_objects!(db, Item, format!("SELECT * FROM SCHEMA_NAME.item_full_view WHERE parent_item = $1 {filter}"), parent_directory))
    }

    pub async fn repository_root(db: &Database, repository: &RepositoryId, filter: Trash) -> Result<Vec<Item>, Error> {
        Ok(query_objects!(db, Item, format!("SELECT * FROM SCHEMA_NAME.item_full_view WHERE parent_item IS NULL and repository = $1 {filter}"), repository))
    }

    pub async fn repository_trash_root(db: &Database, repository: &RepositoryId) -> Result<Vec<Item>, Error> {
        Ok(query_objects!(db, Item, "SELECT * FROM SCHEMA_NAME.item_full_view WHERE in_trash AND repository = $1 AND (parent_item IS NULL OR parent_item IN (SELECT id FROM SCHEMA_NAME.item_full_view WHERE repository = $1 AND NOT in_trash))", repository))
    }
    
    pub async fn search(db: &Database, filter: ItemSearchData) -> Result<Vec<Item>, Error> {

        if filter.repositories.is_empty() {
            Err(Error::msg("No repository specified"))?;
        }

        let mut repository_req = String::new();
        for repository in filter.repositories {
            repository_req += format!("repository = {} AND ", repository.repository).as_str();
            let mut item_req = String::new();
            for (i, item) in repository.root_items.iter().enumerate() {
                item_req += format!("STARTS_WITH(absolute_path, SELECT(absolute_path FROM item WHERE id = {item}))").as_str();
                if i != repository.root_items.len() - 1 { item_req += " OR " }
            }
            repository_req += format!("({item_req}) AND").as_str();
        }

        let name = if let Some(name) = filter.name_filter {
            format!("LOWER(name) LIKE '%' || LOWER('{name}') || '%' AND")
        } else { String::new() };

        let before = if let Some(before) = filter.before {
            format!("timestamp <= {before} AND")
        } else { String::new() };

        let after = if let Some(after) = filter.after {
            format!("timestamp >= {after} AND")
        } else { String::new() };

        let max_size = if let Some(max_size) = filter.max_size {
            format!("size <= {max_size} AND")
        } else { String::new() };

        let min_size = if let Some(min_size) = filter.min_size {
            format!("size >= {min_size} AND")
        } else { String::new() };

        let mimetype = if let Some(mimetype) = filter.mime_type {
            format!("LOWER(mimetype) LIKE '%' || LOWER('{}') || '%' AND", mimetype.encoded())
        } else { String::new() };

        let owners = if let Some(owners) = filter.owners {
            let mut owner_req = String::new();
            for owner in owners { owner_req += format!("owner = {owner} AND").as_str() }
            owner_req
        } else { String::new() };

        Ok(query_objects!(&db, Item, format!("SELECT * FROM SCHEMA_NAME.item_full_view WHERE {repository_req} {name} {before} {after} {max_size} {min_size} {mimetype} {owners} is_regular_file")))
    }

    pub async fn delete(item: &Item, db: &Database) -> Result<(), Error> {
        let childs = query_objects!(db, ObjectId, r#"SELECT UNNEST(SCHEMA_NAME.remove_item($1)) AS id GROUP BY id;"#, item.id());
        Object::delete_objects(db, &childs).await?;
        Ok(())
    }

    pub async fn push(item: &mut Item, db: &Database) -> Result<(), Error> {
        if item.directory.is_none() && item.file.is_none() {
            return Err(Error::msg("Cannot push : neither a file or a directory"));
        }

        if item.id().is_valid() {
            query_fmt!(db, "INSERT INTO SCHEMA_NAME.items
                        (id, repository, owner, name, is_regular_file, description, parent_item, absolute_path, in_trash) VALUES
                        ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        ON CONFLICT(id) DO UPDATE SET
                        id = $1, repository = $2, owner = $3, name = $4, is_regular_file = $5, description = $6, parent_item = $7, absolute_path = $8, in_trash = $9;",
                item.id(), item.repository, item.owner, item.name, item.file.is_some(), item.description, item.parent_item, item.absolute_path, item.in_trash);
        } else {
            let res = query_object!(db, ItemId, "INSERT INTO SCHEMA_NAME.items
                        (repository, owner, name, is_regular_file, description, parent_item, in_trash) VALUES
                        ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
                item.repository, item.owner, item.name, item.file.is_some(), item.description, item.parent_item, item.in_trash);
            if let Some(res) = res {
                item.set_id(res)?;
            }
        }

        if let Some(file) = &item.file {
            query_fmt!(db, "INSERT INTO SCHEMA_NAME.files
                        (id, size, mimetype, timestamp, object) VALUES
                        ($1, $2, $3, $4, $5)
                        ON CONFLICT(id) DO UPDATE SET
                        id = $1, size = $2, mimetype = $3, timestamp = $4, object = $5;",
                item.id(), file.size, file.mimetype, file.timestamp, file.object);
        } else if let Some(directory) = &item.directory {
            query_fmt!(db, "INSERT INTO SCHEMA_NAME.directories
                        (id, open_upload) VALUES
                        ($1, $2)
                        ON CONFLICT(id) DO UPDATE SET
                        id = $1, open_upload = $2;",
                item.id(), directory.open_upload);
        }
        Ok(())
    }
}