use std::io::Write;
use anyhow::Error;
use postgres_from_row::FromRow;
use tokio::fs::File;
use tokio::io::AsyncReadExt;
use tracing::info;
use types::database_ids::{ObjectId};
use crate::{query_fmt, query_objects, Database};
use crate::object::Object;

pub struct RehashFiles;
impl RehashFiles {
    pub async fn run(db: &Database) -> Result<(), Error> {
        let mut last_percents = 0;
        let objects = query_objects!(db, ObjectId, "SELECT id FROM SCHEMA_NAME.objects");
        for (i, object) in objects.iter().enumerate() {
            let data = Object::data_path(&object, db);
            let mut hasher = blake3::Hasher::new();
            let mut f = File::open(&data).await.map_err(|err| { Error::msg(format!("Failed to find file {} : {err}", data.display())) })?;
            let mut buffer = [0u8; 4096];

            loop {
                let read = f.read(&mut buffer).await?;
                if read == 0 { break; }
                assert_eq!(hasher.write(&buffer[..read])?, read);
            }

            let percent = (i as f64 / objects.len() as f64 * 1000f64) as i64;
            if percent != last_percents {
                last_percents = percent;
                info!("hash : {}%", percent as f32 / 10f32);
            }

            query_fmt!(db, "UPDATE SCHEMA_NAME.objects SET hash = $2 WHERE id = $1", object, hasher.finalize().to_string());
        }
        info!("Fixed hash !");


        Ok(())
    }
}