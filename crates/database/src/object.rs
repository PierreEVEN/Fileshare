use crate::Database;
use crate::{query_fmt, query_object, query_objects};
use anyhow::Error;
use postgres_from_row::FromRow;
use std::{fs};
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::Command;
use tracing::{error};
use types::database_ids::{ItemId, ObjectId};

#[derive(Debug, FromRow)]
pub struct Object {
    id: ObjectId,
    pub hash: String,
}

impl Object {
    pub fn data_path(object: &ObjectId, db: &Database) -> PathBuf {
        db.file_storage_path.join(object.to_string().as_str())
    }

    pub fn thumbnail_path(object: &ObjectId, db: &Database) -> PathBuf {
        db.static_cache_storage_path.join("thumbnails").join(object.to_string().as_str())
    }

    pub fn preview_path(object: &ObjectId, db: &Database) -> PathBuf {
        db.static_cache_storage_path.join("previews").join(object.to_string().as_str())
    }
    
    pub async fn from_id(db: &Database, id: &ObjectId) -> Result<Self, Error> {
        Ok(query_object!(db, Object, "SELECT * FROM SCHEMA_NAME.objects WHERE id = $1", id).unwrap())
    }

    pub async fn from_item(db: &Database, id: &ItemId) -> Result<Vec<Self>, Error> {
        Ok(query_objects!(db, Object, "SELECT * FROM SCHEMA_NAME.objects WHERE id = $1", id))
    }

    pub async fn from_hash(db: &Database, hash: &String) -> Result<Vec<Self>, Error> {
        Ok(query_objects!(db, Object, "SELECT * FROM SCHEMA_NAME.objects WHERE hash = $1", hash))
    }

    pub async fn insert(db: &Database, file: &Path, hash: &String) -> Result<Self, Error> {
        let new_object = query_object!(db, Self, "INSERT INTO SCHEMA_NAME.objects (hash) VALUES ($1) RETURNING *", hash).ok_or(Error::msg("Failed to insert object"))?;
        if !Object::data_path(new_object.id(), db).parent().unwrap().exists() {
            fs::create_dir_all(Object::data_path(new_object.id(), db).parent().unwrap())?;
        }
        if cfg!(unix) {
            match Command::new("mv").arg(file).arg(Object::data_path(new_object.id(), db)).output() {
                Ok(result) => {if !result.status.success() {
                    return Err(Error::msg(format!("Failed to store new object : {}", std::str::from_utf8(result.stderr.as_slice())?)));
                }}
                Err(err) => {
                    return Err(Error::msg(format!("Failed to store new object : {err}")));
                }
            }
        } else if let Err(err) = fs::rename(file, Object::data_path(new_object.id(), db)) {
            query_fmt!(db, r#"DELETE FROM SCHEMA_NAME.objects WHERE id = $1;"#, *new_object.id);
            error!("Failed to rename object from {} to {}", file.display(), Object::data_path(new_object.id(), db).display());
            let _ = fs::remove_file(file);
            return Err(Error::msg(format!("Failed to store new object : {err} (please see server logs for more details) ")));
        }
        Ok(new_object)
    }

    pub async fn delete(&self, db: &Database) -> Result<(), Error> {
        Self::delete_objects(db, &vec![self.id.clone()]).await
    }

    pub async fn delete_objects(db: &Database, objects: &Vec<ObjectId>) -> Result<(), Error> {
        for object in objects {
            if Object::data_path(object, db).exists() {
                fs::remove_file(Object::data_path(object, db))?;
            }
            if Object::thumbnail_path(object, db).exists() {
                fs::remove_file(Object::thumbnail_path(object, db))?;
            }
        }
        query_fmt!(db, r#"DELETE FROM SCHEMA_NAME.objects WHERE id = any($1);"#, objects);
        Ok(())
    }

    pub fn id(&self) -> &ObjectId {
        &self.id
    }


    pub async fn equals_to_file(&self, db: &Database, file: &PathBuf) -> Result<bool, Error> {
        if !Object::data_path(self.id(), db).exists() {
            error!("The object {:?} is not pointing to a valid file", self);
            //safe_rename(file, &Object::data_path(self.id(), db))?;
            return Ok(true);
        }

        let mut reader1 = BufReader::new(File::open(Object::data_path(self.id(), db)).map_err(|err| Error::msg(format!("Cannot open object data : {err}")))?);
        let mut reader2 = BufReader::new(File::open(file).map_err(|err| Error::msg(format!("Cannot open tested file : {err}")))?);
        let mut buf1 = [0; 131072];
        let mut buf2 = [0; 131072];

        while let Ok(n1) = reader1.read(&mut buf1) {
            if n1 > 0 {
                if let Ok(n2) = reader2.read(&mut buf2) {
                    if n1 == n2 && buf1 == buf2 {
                        continue;
                    }
                    return Ok(false);
                }
            } else {
                break;
            }
        }

        Ok(true)
    }
}
