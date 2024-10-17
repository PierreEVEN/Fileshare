use std::fs;
use std::path::PathBuf;
use std::str::FromStr;
use anyhow::{Error};
use tokio::net::TcpStream;
use tokio_postgres::{Client, Config, Connection};
use tokio_postgres::tls::NoTlsStream;
use tracing::info;
use utils::config::{BackendConfig};

pub mod item;
pub mod object;
pub mod repository;
pub mod user;
pub mod subscription;
pub mod async_zip;
pub mod upgrades;

pub struct Database {
    db: Client,
    pub schema_name: String,
    pub file_storage_path: PathBuf,
    pub thumbnail_storage_path: PathBuf,
}

async fn connect_raw(s: &str) -> Result<(Client, Connection<TcpStream, NoTlsStream>), Error> {
    let socket = TcpStream::connect("127.0.0.1:5432").await?;
    let config = s.parse::<Config>()?;
    Ok(config.connect_raw(socket, tokio_postgres::NoTls).await?)
}

async fn connect(s: &str) -> Result<Client, Error> {
    let (client, connection) = connect_raw(s).await?;
    tokio::spawn(connection);
    Ok(client)
}

impl Database {
    pub async fn new(config: &BackendConfig) -> Result<Self, Error> {
        let db = connect(format!("host={} port={} user={} password={} dbname={} sslmode={}", config.postgres.url, config.postgres.port, config.postgres.username, config.postgres.secret, config.postgres.database, if config.postgres.ssl_mode { "enable" } else { "disable" }).as_str()).await?;
        let database = Self { db, schema_name: config.postgres.scheme_name.to_string(), file_storage_path: config.file_storage_path.clone(), thumbnail_storage_path: config.thumbnail_storage_path.clone() };
        database.migrate(PathBuf::from("./migrations"), config.postgres.scheme_name.as_str()).await?;
        Ok(database)
    }


    pub async fn migrate(&self, migrations_dir: PathBuf, schema_name: &str) -> Result<(), Error> {
        let mut entries = vec![];
        for entry in fs::read_dir(migrations_dir)? { entries.push(entry?); }

        entries.sort_by(|a, b| {
            let a = a.file_name();
            let b = b.file_name();
            let mut a_split = a.to_str().unwrap().split("_");
            let mut b_split = b.to_str().unwrap().split("_");

            if let Some(a) = a_split.next() {
                if let Some(b) = b_split.next() {
                    if let Ok(a) = i32::from_str(a) {
                        if let Ok(b) = i32::from_str(b) {
                            return a.cmp(&b);
                        }
                    }
                }
            }
            a.cmp(&b)
        });

        for entry in entries {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(std::ffi::OsStr::to_str) == Some("sql") {
                let sql = fs::read_to_string(path)?.replace("SCHEMA_NAME", schema_name);

                match self.db
                    .simple_query(&sql,
                    ).await {
                    Ok(_) => {
                        info!("Successfully executed migrations {}", entry.file_name().to_str().unwrap());
                    }
                    Err(error) => {
                        return Err(Error::msg(format!("Failed run migration migrate {} : {}", entry.file_name().to_str().unwrap(), error)));
                    }
                };
            }
        }

        Ok(())
    }

    pub fn db(&self) -> &Client {
        &self.db
    }
}

#[macro_export]
macro_rules! query_fmt {
    ($db:expr, $query:expr) => {{
        $db.db().query(&$query.replace("SCHEMA_NAME", &$db.schema_name), &[]).await?
    }};

    ($db:expr, $query:expr, $( $bound_values:expr),*) => {{
        let params: &[&(dyn postgres_types::ToSql + Sync)] = &[$(&$bound_values,)*];
        $db.db().query(&$query.replace("SCHEMA_NAME", &$db.schema_name), params).await?
    }};
}

#[macro_export]
macro_rules! query_objects {
    ($db:expr, $StructType:ty, $query:expr) => {{
        let query = $db.db().query(&$query.replace("SCHEMA_NAME", &$db.schema_name), &[]).await?;
        let mut rows = Vec::with_capacity(query.len());
        for row in query {
            rows.push(<$StructType>::try_from_row(&row)?);
        }
        rows
    }};
    ($db:expr, $StructType:ty, $query:expr, $( $bound_values:expr),*) => {{
        let params: &[&(dyn postgres_types::ToSql + Sync)] = &[$(&$bound_values,)*];
        let query = $db.db().query(&$query.replace("SCHEMA_NAME", &$db.schema_name), params).await?;
        let mut rows = Vec::with_capacity(query.len());
        for row in query {
            rows.push(<$StructType>::try_from_row(&row)?);
        }
        rows
    }}
}

#[macro_export]
macro_rules! query_object {
    ($db:expr, $StructType:ty, $query:expr) => {{
        let mut query = $db.db().query(&$query.replace("SCHEMA_NAME", &$db.schema_name), &[]).await?;
        if query.len() > 1 {
            return Err(Error::msg("Received more than one expected item"))
        }
        match query.pop() {
            Some(item) => { Some(<$StructType>::try_from_row(&item)?) }
            None => { None }
        }
    }};
    ($db:expr, $StructType:ty, $query:expr, $( $bound_values:expr),*) => {{
        let params: &[&(dyn postgres_types::ToSql + Sync)] = &[$(&$bound_values,)*];
        let mut query = $db.db().query(&$query.replace("SCHEMA_NAME", &$db.schema_name), params).await?;
        if query.len() > 1 {
            return Err(Error::msg("Received more than one expected item"))
        }
        match query.pop() {
            Some(item) => { Some(<$StructType>::try_from_row(&item)?) }
            None => { None }
        }
    }}
}
