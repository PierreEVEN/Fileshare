use anyhow::Error;
use postgres_from_row::FromRow;
use tracing::info;
use types::database_ids::{ItemId, RepositoryId, UserId};
use types::enc_string::EncString;
use crate::{query_fmt, query_objects, Database};

pub struct FixEncodedStrings;

fn enc(string: &String) -> Result<String, Error> {
    Ok(EncString::from(EncString::decode_encoded(string.as_str())?).encoded().clone())
}

impl FixEncodedStrings {
    pub async fn run(db: &Database) -> Result<(), Error> {
        #[derive(FromRow)]
        struct User {
            id: UserId,
            email: String,
            name: String,
            login: String,
        }
        for user in query_objects!(db, User, "SELECT * FROM SCHEMA_NAME.users") {
            query_fmt!(db, "UPDATE SCHEMA_NAME.users SET (email, name, login) = ($2, $3, $4) WHERE id = $1", user.id, enc(&user.email)?, enc(&user.name)?, enc(&user.login)?);
        }
        info!("Fixed users !");

        #[derive(FromRow)]
        struct Repository {
            id: RepositoryId,
            url_name: String,
            description: Option<String>,
            display_name: String,
        }
        for repository in query_objects!(db, Repository, "SELECT * FROM SCHEMA_NAME.repository") {
            query_fmt!(db, "UPDATE SCHEMA_NAME.repository SET (url_name, description, display_name) = ($2, $3, $4) WHERE id = $1", repository.id, enc(&repository.url_name)?, if let Some(desc) = repository.description {Some(enc(&desc)?)}else {None}, enc(&repository.display_name)?);
        }
        info!("Fixed repositories !");

        #[derive(FromRow)]
        struct Item {
            id: ItemId,
            name: String,
            description: Option<String>,
        }
        for item in query_objects!(db, Item, "SELECT * FROM SCHEMA_NAME.items") {
            query_fmt!(db, "UPDATE SCHEMA_NAME.items SET (name, description) = ($2, $3) WHERE id = $1", item.id, enc(&item.name)?, if let Some(desc) = item.description {Some(enc(&desc)?)}else {None});
        }
        info!("Fixed items !");


        #[derive(FromRow)]
        struct File {
            id: ItemId,
            mimetype: String,
        }
        for file in query_objects!(db, File, "SELECT * FROM SCHEMA_NAME.files") {
            query_fmt!(db, "UPDATE SCHEMA_NAME.files SET mimetype = $2 WHERE id = $1", file.id, enc(&file.mimetype)?);
        }
        info!("Fixed files !");

        Ok(())
    }
}